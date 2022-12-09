import { Emitter } from '@socket.io/mongo-emitter';
import { Server } from 'socket.io';
import getUsersFromIds from '../../helpers/getUsersFromIds';
import { logger } from '../../helpers/logger';
import User from '../../models/db/user';
import { MultiplayerMatchModel } from '../../models/mongoose';
import { enrichMultiplayerMatch } from '../../models/schemas/multiplayerMatchSchema';
import { checkForFinishedMatch, getAllMatches } from '../../pages/api/match';
import { getMatch } from '../../pages/api/match/[matchId]';

const GlobalMatchTimers = {} as { [matchId: string]: {
  start: NodeJS.Timeout;
  end: NodeJS.Timeout;
} };

export async function broadcastMatches(emitter: Emitter) {
  const matches = await getAllMatches();

  matches.forEach(match => {
    enrichMultiplayerMatch(match);
  });
  emitter?.to('LOBBY').emit('matches', matches);
}

/**
 * @TODO: Should we keep track of the setTimeouts so we can clear them when someone leaves a match?
 * @param matchId
 * @param date
 */
export async function scheduleBroadcastMatch(emitter: Emitter, matchId: string) {
  // broadcast match when started
  //  const hash = matchId + '_' + date.getTime();
  const match = await MultiplayerMatchModel.findOne({ matchId: matchId });

  const timeoutStart = setTimeout(async () => {
    await checkForFinishedMatch(matchId);
    await broadcastMatch(emitter, matchId);
  }, 1 + new Date(match.startTime).getTime() - Date.now()); // @TODO: the +1 is kind of hacky, we need to make sure websocket server and mongodb are on same time
  const timeoutEnd = setTimeout(async () => {
    await checkForFinishedMatch(matchId);
    await broadcastMatch(emitter, matchId);
  }, 1 + new Date(match.endTime).getTime() - Date.now()); // @TODO: the +1 is kind of hacky, we need to make sure websocket server and mongodb are on same time

  GlobalMatchTimers[matchId] = {
    start: timeoutStart,
    end: timeoutEnd,
  };
}

export function clearAllSchedules() {
  for (const matchId in GlobalMatchTimers) {
    clearTimeout(GlobalMatchTimers[matchId].start);
    clearTimeout(GlobalMatchTimers[matchId].end);
  }
}

export async function clearBroadcastMatchSchedule(matchId: string) {
  if (GlobalMatchTimers[matchId]) {
    clearTimeout(GlobalMatchTimers[matchId].start);
    clearTimeout(GlobalMatchTimers[matchId].end);
    delete GlobalMatchTimers[matchId];
  }
}

export async function broadcastConnectedPlayers(emitter: Server) {
  // return an array of all the connected players

  const clientsMap = await emitter?.fetchSockets();
  // clientsMap is a map of socketId -> socket, let's just get the array of sockets
  const clients = Array.from(clientsMap.values());
  const connectedUserIds = clients.map((client) => {
    return client.data._id;
  });

  // we have all the connected user ids now... so let's get all of them
  const users = await getUsersFromIds(connectedUserIds);
  // remove users with hideStatus: true
  const filteredUsers = users.filter(user => !user.hideStatus);

  emitter?.emit('connectedPlayers', filteredUsers);
}

export async function broadcastMatch(emitter: Emitter, matchId: string) {
  const match = await getMatch(matchId);

  if (!match) {
    logger.error('cant find match to broadcast to');

    return;
  }

  for (const player of match.players) {
    const matchClone = JSON.parse(JSON.stringify(match));

    enrichMultiplayerMatch(matchClone, player._id.toString());
    emitter?.to(player._id.toString()).emit('match', matchClone);
  }

  enrichMultiplayerMatch(match);
  // emit to everyone in the room except the players in the match since we already emitted to them
  emitter?.to(matchId).except(match.players.map((player: User) => player._id.toString())).emit('match', match);
}