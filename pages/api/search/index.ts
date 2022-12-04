import { ObjectId } from 'bson';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDifficultyRangeFromName } from '../../../components/difficultyDisplay';
import LevelDataType from '../../../constants/levelDataType';
import TimeRange from '../../../constants/timeRange';
import apiWrapper from '../../../helpers/apiWrapper';
import { enrichLevels } from '../../../helpers/enrich';
import { FilterSelectOption } from '../../../helpers/filterSelectOptions';
import { logger } from '../../../helpers/logger';
import dbConnect from '../../../lib/dbConnect';
import { getUserFromToken } from '../../../lib/withAuth';
import Level from '../../../models/db/level';
import { LevelModel, StatModel, UserModel } from '../../../models/mongoose';
import { BlockFilterMask, SearchQuery } from '../../search';

function cleanInput(input: string) {
  return input.replace(/[^-a-zA-Z0-9_' ]/g, '.*');
}

export async function doQuery(query: SearchQuery, userId = '', projection = '') {
  await dbConnect();

  const { block_filter, difficulty_filter, max_steps, min_steps, page, search, searchAuthor, searchAuthorId, show_filter, sort_by, sort_dir, time_range } = query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchObj = { 'isDraft': false } as { [key: string]: any };
  const limit = 20;

  if (search && search.length > 0) {
    searchObj['name'] = {
      $regex: cleanInput(search),
      $options: 'i',
    };
  }

  if (searchAuthor && searchAuthor.length > 0) {
    const searchAuthorStr = cleanInput(searchAuthor);
    const user = await UserModel.findOne({ 'name': searchAuthorStr }, {}, { lean: true });

    if (user) {
      searchObj['userId'] = user._id;
    }
  } else if (searchAuthorId) {
    if (ObjectId.isValid(searchAuthorId)) {
      searchObj['userId'] = searchAuthorId;
    }
  }

  if (min_steps && max_steps) {
    searchObj['leastMoves'] = {
      $gte: parseInt(min_steps),
      $lte: parseInt(max_steps),
    };
  }

  if (time_range) {
    if (time_range === TimeRange[TimeRange.Day]) {
      searchObj['ts'] = {};
      searchObj['ts']['$gte'] = new Date(Date.now() - 24 * 60 * 60 * 1000).getTime() / 1000;
    }
    else if (time_range === TimeRange[TimeRange.Week]) {
      searchObj['ts'] = {};
      searchObj['ts']['$gte'] = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).getTime() / 1000;
    }
    else if (time_range === TimeRange[TimeRange.Month]) {
      searchObj['ts'] = {};
      searchObj['ts']['$gte'] = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime() / 1000;
    }
    else if (time_range === TimeRange[TimeRange.Year]) {
      searchObj['ts'] = {};
      searchObj['ts']['$gte'] = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).getTime() / 1000;
    }
  }

  const sort_direction = (sort_dir === 'asc') ? 1 : -1;

  const sortObj = [] as [string, number][];

  if (sort_by) {
    if (sort_by === 'name') {
      sortObj.push(['name', sort_direction]);
    }
    else if (sort_by === 'least_moves') {
      sortObj.push(['leastMoves', sort_direction]);
    }
    else if (sort_by === 'ts') {
      sortObj.push(['ts', sort_direction]);
    }
    else if (sort_by === 'reviews_score') {
      sortObj.push(['calc_reviews_score_laplace', sort_direction], ['calc_reviews_score_avg', sort_direction], ['calc_reviews_count', sort_direction]);

      searchObj['calc_reviews_score_avg'] = { $gte: 0 };
    }
    else if (sort_by === 'total_reviews') {
      sortObj.push(['calc_reviews_count', sort_direction]);
    }
    else if (sort_by === 'players_beaten') {
      sortObj.push(['calc_stats_players_beaten', sort_direction]);
    }
    else if (sort_by === 'calc_difficulty_estimate') {
      sortObj.push(['calc_difficulty_estimate', sort_direction]);
      // don't show pending levels when sorting by difficulty
      searchObj['calc_difficulty_estimate'] = { $gte: 0 };
    }
  }

  sortObj.push(['_id', sort_direction]);

  let skip = 0;

  if (page) {
    skip = ((Math.abs(parseInt(page))) - 1) * limit;
  }

  if (show_filter === FilterSelectOption.HideWon) {
    // get all my level completions
    const all_completions = await StatModel.find({ userId: userId, complete: true }, { levelId: 1 }, { lean: true });

    searchObj['_id'] = { $nin: all_completions.map(c => c.levelId) };
  } else if (show_filter === FilterSelectOption.ShowInProgress) {
    const all_completions = await StatModel.find({ userId: userId, complete: false }, { levelId: 1 }, { lean: true });

    searchObj['_id'] = { $in: all_completions.map(c => c.levelId) };
  }

  if (difficulty_filter) {
    if (difficulty_filter === 'Pending') {
      searchObj['calc_difficulty_estimate'] = { $eq: -1 };
    } else {
      const difficulty = getDifficultyRangeFromName(difficulty_filter);
      const minValue = difficulty[0] as number;
      const maxValue = difficulty[1] as number;

      searchObj['calc_difficulty_estimate'] = {
        $gte: minValue,
        $lt: maxValue,
      };
    }
  }

  // NB: skip regex for NONE for more efficient query
  if (block_filter !== undefined && Number(block_filter) !== BlockFilterMask.NONE) {
    const blockFilterMask = Number(block_filter);
    let mustNotContain = '';

    if (blockFilterMask & BlockFilterMask.BLOCK) {
      mustNotContain += LevelDataType.Block;
    }

    if (blockFilterMask & BlockFilterMask.HOLE) {
      mustNotContain += LevelDataType.Hole;
    }

    if (blockFilterMask & BlockFilterMask.RESTRICTED) {
      mustNotContain += '6-9A-J';
    }

    const mustNotContainRegex = mustNotContain !== '' ? `(?!.*[${mustNotContain}])` : '';

    searchObj['data'] = { $regex: new RegExp(`^(${mustNotContainRegex}[0-9A-J\n]+)$`, 'g') };
  }

  try {
    const [levels, totalRows] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      LevelModel.find<Level>(searchObj, projection).sort(sortObj as { [key: string]: any })
        .populate('userId', 'name').skip(skip).limit(limit),
      LevelModel.find<Level>(searchObj).countDocuments(),
    ]);

    const user = userId ? await UserModel.findById(userId) : null;
    const enrichedLevels = await enrichLevels(levels, user);

    return { levels: enrichedLevels, totalRows: totalRows };
  } catch (e) {
    logger.error(e);

    return null;
  }
}

export default apiWrapper({ GET: {} }, async (req: NextApiRequest, res: NextApiResponse) => {
  await dbConnect();
  const token = req?.cookies?.token;
  const reqUser = token ? await getUserFromToken(token, req) : null;
  const query = await doQuery(req.query as SearchQuery, reqUser?._id.toString());

  if (!query) {
    return res.status(500).json({
      error: 'Error querying Levels',
    });
  }

  return res.status(200).json(query);
});
