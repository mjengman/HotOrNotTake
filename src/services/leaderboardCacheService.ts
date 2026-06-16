import AsyncStorage from '@react-native-async-storage/async-storage';
import { Take } from '../types';
import {
  getHottestTakesByCategory,
  getMostDivisiveTakesByCategory,
  getMostSkippedTakesByCategory,
  getNottestTakesByCategory,
} from './takeService';

type TakeLeaderboard = Record<string, Take[]>;
type SkippedLeaderboard = Record<string, { take: Take; skipCount: number }[]>;

type LeaderboardCache = {
  savedAt: number;
  hottest: TakeLeaderboard;
  nottest: TakeLeaderboard;
  divisive: TakeLeaderboard;
  skipped: SkippedLeaderboard;
  skippedLoadFailed: boolean;
};

const LEADERBOARD_CACHE_VERSION = 'v1';
const LEADERBOARD_CACHE_KEY = `leaderboards-cache:${LEADERBOARD_CACHE_VERSION}`;
const LEADERBOARD_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const emptyCache = (): LeaderboardCache => ({
  savedAt: 0,
  hottest: {},
  nottest: {},
  divisive: {},
  skipped: {},
  skippedLoadFailed: false,
});

const readCache = async (): Promise<LeaderboardCache> => {
  try {
    const raw = await AsyncStorage.getItem(LEADERBOARD_CACHE_KEY);
    if (!raw) return emptyCache();

    return {
      ...emptyCache(),
      ...JSON.parse(raw),
    };
  } catch (error) {
    console.warn('Unable to read leaderboard prefetch cache:', error);
    return emptyCache();
  }
};

export const prefetchLeaderboardCache = async () => {
  const existing = await readCache();
  const isFresh = existing.savedAt && Date.now() - existing.savedAt < LEADERBOARD_CACHE_TTL_MS;

  if (isFresh) {
    return;
  }

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

  await AsyncStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(nextCache));
};
