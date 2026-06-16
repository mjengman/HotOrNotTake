import AsyncStorage from '@react-native-async-storage/async-storage';
import { Take } from '../types';
import {
  getHottestTakesByCategory,
  getMostDivisiveTakesByCategory,
  getMostSkippedTakesByCategory,
  getNottestTakesByCategory,
} from './takeService';

export type TakeLeaderboard = Record<string, Take[]>;
export type SkippedLeaderboard = Record<string, { take: Take; skipCount: number }[]>;

export type LeaderboardCache = {
  savedAt: number;
  hottest: TakeLeaderboard;
  nottest: TakeLeaderboard;
  divisive: TakeLeaderboard;
  skipped: SkippedLeaderboard;
  skippedLoadFailed: boolean;
};

const LEADERBOARD_CACHE_VERSION = 'v1';
const LEADERBOARD_CACHE_KEY = `leaderboards-cache:${LEADERBOARD_CACHE_VERSION}`;
let prefetchPromise: Promise<void> | null = null;
let memoryCache: LeaderboardCache | null = null;

const emptyCache = (): LeaderboardCache => ({
  savedAt: 0,
  hottest: {},
  nottest: {},
  divisive: {},
  skipped: {},
  skippedLoadFailed: false,
});

const reviveDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const reviveTake = (take: Take): Take => ({
  ...take,
  createdAt: reviveDate(take.createdAt) || new Date(),
  submittedAt: reviveDate(take.submittedAt) || new Date(),
  approvedAt: reviveDate(take.approvedAt),
  rejectedAt: reviveDate(take.rejectedAt),
});

const reviveTakeLeaderboard = (data: TakeLeaderboard = {}): TakeLeaderboard =>
  Object.fromEntries(
    Object.entries(data).map(([category, takes]) => [
      category,
      Array.isArray(takes) ? takes.map(reviveTake) : [],
    ])
  );

const reviveSkippedLeaderboard = (data: SkippedLeaderboard = {}): SkippedLeaderboard =>
  Object.fromEntries(
    Object.entries(data).map(([category, items]) => [
      category,
      Array.isArray(items)
        ? items.map(item => ({
            ...item,
            take: reviveTake(item.take),
          }))
        : [],
    ])
  );

const reviveCache = (cache: Partial<LeaderboardCache>): LeaderboardCache => ({
  ...emptyCache(),
  ...cache,
  hottest: reviveTakeLeaderboard(cache.hottest),
  nottest: reviveTakeLeaderboard(cache.nottest),
  divisive: reviveTakeLeaderboard(cache.divisive),
  skipped: reviveSkippedLeaderboard(cache.skipped),
  skippedLoadFailed: Boolean(cache.skippedLoadFailed),
});

export const getLeaderboardCacheSnapshot = (): LeaderboardCache | null => memoryCache;

export const readLeaderboardCache = async (): Promise<LeaderboardCache | null> => {
  if (memoryCache) {
    return memoryCache;
  }

  try {
    const raw = await AsyncStorage.getItem(LEADERBOARD_CACHE_KEY);
    if (!raw) return null;

    memoryCache = reviveCache(JSON.parse(raw));
    return memoryCache;
  } catch (error) {
    console.warn('Unable to read leaderboard prefetch cache:', error);
    return null;
  }
};

export const writeLeaderboardCache = async (cache: LeaderboardCache) => {
  memoryCache = reviveCache(cache);
  await AsyncStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(memoryCache));
};

export const prefetchLeaderboardCache = async () => {
  if (prefetchPromise) {
    return prefetchPromise;
  }

  prefetchPromise = refreshLeaderboardCache();

  try {
    await prefetchPromise;
  } finally {
    prefetchPromise = null;
  }
};

const refreshLeaderboardCache = async () => {
  const existing = (await readLeaderboardCache()) || emptyCache();

  const [hottestResult, nottestResult, divisiveResult, skippedResult] = await Promise.allSettled([
    getHottestTakesByCategory(),
    getNottestTakesByCategory(),
    getMostDivisiveTakesByCategory(),
    getMostSkippedTakesByCategory(),
  ]);

  const nextCache: LeaderboardCache = {
    ...existing,
    savedAt: Date.now(),
    hottest: hottestResult.status === 'fulfilled' ? hottestResult.value : existing.hottest,
    nottest: nottestResult.status === 'fulfilled' ? nottestResult.value : existing.nottest,
    divisive: divisiveResult.status === 'fulfilled' ? divisiveResult.value : existing.divisive,
    skipped: skippedResult.status === 'fulfilled' ? skippedResult.value : existing.skipped,
    skippedLoadFailed: skippedResult.status === 'rejected' ? true : false,
  };

  await writeLeaderboardCache(nextCache);
};
