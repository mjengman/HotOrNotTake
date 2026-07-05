import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';
import { persistVoteToFirebase } from './voteService';
import { updateUserEngagementAfterVote } from './userService';
import { VoteEngagementContext } from '../types/User';

const VOTE_OUTBOX_KEY = 'vote-outbox:v1';
const MAX_OUTBOX_SIZE = 120;
const MAX_OUTBOX_ATTEMPTS = 5;

export interface QueuedVoteWrite {
  id: string;
  userId: string;
  takeId: string;
  vote: 'hot' | 'not';
  category?: string;
  countDailyEngagement: boolean;
  voteContext?: VoteEngagementContext;
  createdAt: string;
  attempts: number;
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushPromise: Promise<void> | null = null;
let queueOperation: Promise<void> = Promise.resolve();

const createQueueId = (userId: string, takeId: string) =>
  `${userId}:${takeId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

const readQueue = async (): Promise<QueuedVoteWrite[]> => {
  try {
    const raw = await AsyncStorage.getItem(VOTE_OUTBOX_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Unable to read vote outbox:', error);
    return [];
  }
};

export const getQueuedVoteTakeIds = async (userId?: string): Promise<string[]> => {
  const queue = await readQueue();
  return Array.from(new Set(
    queue
      .filter(entry => !userId || entry.userId === userId)
      .map(entry => entry.takeId)
      .filter((takeId): takeId is string => typeof takeId === 'string' && takeId.length > 0)
  ));
};

const writeQueue = async (queue: QueuedVoteWrite[]) => {
  const trimmed = queue.slice(-MAX_OUTBOX_SIZE);
  await AsyncStorage.setItem(VOTE_OUTBOX_KEY, JSON.stringify(trimmed));
};

const runQueueOperation = async <T>(operation: () => Promise<T>): Promise<T> => {
  const previous = queueOperation;
  let release: () => void = () => {};
  queueOperation = new Promise<void>(resolve => {
    release = resolve;
  });

  await previous.catch(() => undefined);

  try {
    return await operation();
  } finally {
    release();
  }
};

const persistQueuedVote = async (entry: QueuedVoteWrite) => {
  const wroteVote = await persistVoteToFirebase(entry.takeId, entry.userId, entry.vote);

  if (wroteVote) {
    await updateUserEngagementAfterVote(entry.userId, {
      category: entry.category,
      countDailyEngagement: entry.countDailyEngagement,
      voteContext: entry.voteContext,
    });
  }
};

export const flushVoteOutbox = async (): Promise<void> => {
  if (flushPromise) {
    return flushPromise;
  }

  flushPromise = (async () => {
    await runQueueOperation(async () => {
      let queue = await readQueue();

      while (queue.length > 0) {
        const [entry, ...rest] = queue;

        try {
          await persistQueuedVote(entry);
          queue = rest;
          await writeQueue(queue);
        } catch (error) {
          const attempts = entry.attempts + 1;

          if (attempts >= MAX_OUTBOX_ATTEMPTS) {
            console.warn('Dropping vote outbox entry after repeated failures:', {
              takeId: entry.takeId,
              userId: entry.userId,
              attempts,
              error: error instanceof Error ? error.message : String(error),
            });
            queue = rest;
            await writeQueue(queue);
            continue;
          }

          const retryEntry = {
            ...entry,
            attempts,
          };
          await writeQueue([retryEntry, ...rest]);
          console.warn('Vote outbox flush paused:', error);
          break;
        }
      }
    });
  })().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
};

export const scheduleVoteOutboxFlush = (delayMs = 900) => {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    InteractionManager.runAfterInteractions(() => {
      flushVoteOutbox().catch(error => {
        console.warn('Unable to flush vote outbox:', error);
      });
    });
  }, delayMs);
};

export const enqueueVoteWrite = async (
  entry: Omit<QueuedVoteWrite, 'id' | 'createdAt' | 'attempts'>
) => {
  await runQueueOperation(async () => {
    const queue = await readQueue();
    const alreadyQueued = queue.some(
      queued => queued.userId === entry.userId && queued.takeId === entry.takeId
    );

    if (!alreadyQueued) {
      await writeQueue([
        ...queue,
        {
          ...entry,
          id: createQueueId(entry.userId, entry.takeId),
          createdAt: new Date().toISOString(),
          attempts: 0,
        },
      ]);
    }
  });

  scheduleVoteOutboxFlush();
};

export const removeQueuedVotesForTake = async (userId: string, takeId: string) => {
  await runQueueOperation(async () => {
    const queue = await readQueue();
    const nextQueue = queue.filter(
      entry => !(entry.userId === userId && entry.takeId === takeId)
    );

    if (nextQueue.length !== queue.length) {
      await writeQueue(nextQueue);
    }
  });
};
