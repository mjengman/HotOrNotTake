import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StreakUpdateResult, UserStats } from '../types/User';
import { getFreshDailyChallenge, getUserStats } from '../services/userService';
import { useAuth } from './useAuth';

interface UseUserStatsResult {
  stats: UserStats;
  loading: boolean;
  hydrated: boolean;
  error: string | null;
  refreshStats: () => Promise<void>;
  applyEngagementUpdate: (update: StreakUpdateResult) => void;
}

const getTodayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultDailyChallenge = (userId?: string) =>
  getFreshDailyChallenge(getTodayKey(), userId);

const USER_STATS_CACHE_VERSION = 'v1';
const USER_STATS_CACHE_PREFIX = `user-stats-cache:${USER_STATS_CACHE_VERSION}`;

const getUserStatsCacheKey = (userId: string) => `${USER_STATS_CACHE_PREFIX}:${userId}`;

const getDefaultStats = (userId?: string): UserStats => ({
  totalVotes: 0,
  hotVotesGiven: 0,
  notVotesGiven: 0,
  takesSubmitted: 0,
  votingStreak: 0,
  longestVotingStreak: 0,
  totalStreakDays: 0,
  streakUpdatedToday: false,
  dailyChallenge: getDefaultDailyChallenge(userId),
  favoriteCategories: [],
  joinedAt: new Date(),
});

const normalizeCachedStats = (stats: UserStats, userId?: string): UserStats => {
  const todayKey = getTodayKey();

  return {
    ...stats,
    streakUpdatedToday: stats.lastStreakDate === todayKey,
    dailyChallenge: stats.dailyChallenge?.date === todayKey
      ? stats.dailyChallenge
      : getDefaultDailyChallenge(userId),
  };
};

const isServerStatsBehindLocal = (incoming: UserStats, current: UserStats): boolean => {
  if ((incoming.totalVotes || 0) < (current.totalVotes || 0)) {
    return true;
  }

  if (
    current.streakUpdatedToday &&
    current.lastStreakDate &&
    incoming.lastStreakDate !== current.lastStreakDate
  ) {
    return true;
  }

  const sameChallengeDate = incoming.dailyChallenge?.date === current.dailyChallenge?.date;
  if (sameChallengeDate) {
    if ((incoming.dailyChallenge?.progress || 0) < (current.dailyChallenge?.progress || 0)) {
      return true;
    }

    if (current.dailyChallenge?.completed && !incoming.dailyChallenge?.completed) {
      return true;
    }
  }

  return false;
};

const readCachedStats = async (userId: string): Promise<UserStats | null> => {
  try {
    const raw = await AsyncStorage.getItem(getUserStatsCacheKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return normalizeCachedStats({
      ...parsed,
      joinedAt: parsed.joinedAt ? new Date(parsed.joinedAt) : new Date(),
      dailyChallenge: {
        ...parsed.dailyChallenge,
        completedAt: parsed.dailyChallenge?.completedAt
          ? new Date(parsed.dailyChallenge.completedAt)
          : undefined,
      },
    }, userId);
  } catch (error) {
    console.warn('Unable to read user stats cache:', error);
    return null;
  }
};

const writeCachedStats = async (userId: string, stats: UserStats) => {
  try {
    await AsyncStorage.setItem(
      getUserStatsCacheKey(userId),
      JSON.stringify({
        ...stats,
        joinedAt: stats.joinedAt.toISOString(),
        dailyChallenge: {
          ...stats.dailyChallenge,
          completedAt: stats.dailyChallenge.completedAt?.toISOString(),
        },
      })
    );
  } catch (error) {
    console.warn('Unable to write user stats cache:', error);
  }
};

export const useUserStats = (): UseUserStatsResult => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats>(getDefaultStats);
  const statsRef = useRef<UserStats>(stats);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  // Load user stats
  const loadStats = useCallback(async () => {
    if (!user) {
      setStats(getDefaultStats());
      setHydrated(false);
      return;
    }

    try {
      setLoading(true);
      setHydrated(false);
      setError(null);

      const cachedStats = await readCachedStats(user.uid);
      if (cachedStats) {
        if (!isServerStatsBehindLocal(cachedStats, statsRef.current)) {
          statsRef.current = cachedStats;
          setStats(cachedStats);
        }
        setHydrated(true);
      } else {
        const defaultStats = getDefaultStats(user.uid);
        if (!isServerStatsBehindLocal(defaultStats, statsRef.current)) {
          statsRef.current = defaultStats;
          setStats(defaultStats);
        }
        setHydrated(true);
      }

      const userStats = await getUserStats(user.uid);
      if (!isServerStatsBehindLocal(userStats, statsRef.current)) {
        statsRef.current = userStats;
        setStats(userStats);
        writeCachedStats(user.uid, userStats);
      }
      setHydrated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
      console.error('Error loading user stats:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const applyEngagementUpdate = useCallback((update: StreakUpdateResult) => {
    setHydrated(true);
    setStats(prevStats => {
      const nextStats: UserStats = {
        ...prevStats,
        totalVotes: update.totalVotes ?? prevStats.totalVotes,
        votingStreak: update.currentStreak,
        longestVotingStreak: update.longestVotingStreak,
        totalStreakDays: update.totalStreakDays,
        lastStreakDate: update.lastStreakDate,
        streakUpdatedToday: true,
        dailyChallenge: update.dailyChallenge || prevStats.dailyChallenge,
      };

      statsRef.current = nextStats;

      if (user) {
        writeCachedStats(user.uid, nextStats);
      }

      return nextStats;
    });
  }, [user]);

  // Load stats when user changes
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    hydrated,
    error,
    refreshStats: loadStats,
    applyEngagementUpdate,
  };
};
