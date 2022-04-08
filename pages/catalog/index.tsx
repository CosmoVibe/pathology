import Level from '../../models/db/level';
import { LevelModel } from '../../models/mongoose';
import Page from '../../components/page';
import React from 'react';
import Select from '../../components/select';
import SelectOption from '../../models/selectOption';
import StatsHelper from '../../helpers/statsHelper';
import { Types } from 'mongoose';
import User from '../../models/db/user';
import { UserModel } from '../../models/mongoose';
import dbConnect from '../../lib/dbConnect';
import { useCallback } from 'react';
import useStats from '../../hooks/useStats';

export async function getStaticProps() {
  await dbConnect();

  const [creators, levels] = await Promise.all([
    UserModel.find<User>({ isCreator: true }, '_id isOfficial name'),
    LevelModel.find<Level>({}, '_id userId'),
  ]);

  if (!creators) {
    throw new Error('Error finding Users');
  }

  if (!levels) {
    throw new Error('Error finding Levels');
  }

  creators.sort((a: User, b: User) => {
    if (a.isOfficial === b.isOfficial) {
      return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
    }

    return a.isOfficial ? -1 : 1;
  });

  const creatorsToLevelIds: {[userId: string]: Types.ObjectId[]} = {};

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const userId = level.userId.toString();

    if (!(userId in creatorsToLevelIds)) {
      creatorsToLevelIds[userId] = [];
    }

    creatorsToLevelIds[userId].push(level._id);
  }

  return {
    props: {
      creators: JSON.parse(JSON.stringify(creators)),
      creatorsToLevelIds: JSON.parse(JSON.stringify(creatorsToLevelIds)),
    } as CatalogProps,
  };
}

interface CatalogProps {
  creators: User[];
  creatorsToLevelIds: {[userId: string]: Types.ObjectId[]};
}

export default function Catalog({ creators, creatorsToLevelIds }: CatalogProps) {
  const { stats } = useStats();

  const getOptions = useCallback(() => {
    const options = [];
    const creatorStats = StatsHelper.creatorStats(creators, creatorsToLevelIds, stats);

    for (let i = 0; i < creators.length; i++) {
      const creator = creators[i];

      options.push(new SelectOption(
        creator.name,
        `/creator/${creator._id.toString()}`,
        creatorStats[i],
      ));

      // add space between official and custom levels
      if (creator.isOfficial && !creators[i + 1].isOfficial) {
        options.push(undefined);
      }
    }

    return options;
  }, [creators, creatorsToLevelIds, stats]);

  return (
    <Page title={'Catalog'}>
      <Select options={getOptions()}/>
    </Page>
  );
}
