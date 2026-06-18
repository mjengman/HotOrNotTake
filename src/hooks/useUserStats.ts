import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StreakUpdateResult, UserStats } from '../types/User';
import { getUserStats } from '../services/userService';
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

const getDefaultDailyChallenge = () => ({
  date: getTodayKey(),
  type: 'vote_count' as const,
  title: 'Daily heat check',
  description: 'Vote on 20 takes today.',
  goal: 20,
  progress: 0,
  completed: false,
});

const USER_STATS_CACHE_VERSION = 'v1';
const USER_STATS_CACHE_PREFIX = `user-stats-cache:${USER_STATS_CACHE_VERSION}`;

const getUserStatsCacheKey = (userId: string) => `${USER_STATS_CACHE_PREFIX}:${userId}`;

const getDefaultStats = (): UserStats => ({
  totalVotes: 0,
  hotVotesGiven: 0,
  notVotesGiven: 0,
  takesSubmitted: 0,
  votingStreak: 0,
  longestVotingStreak: 0,
  totalStreakDays: 0,
  streakUpdatedToday: false,
  dailyChallenge: getDefaultDailyChallenge(),
  favoriteCategories: [],
  joinedAt: new Date(),
});

const normalizeCachedStats = (stats: UserStats): UserStats => {
  const todayKey = getTodayKey();

  return {
    ...stats,
    streakUpdatedToday: stats.lastStreakDate === todayKey,
    dailyChallenge: stats.dailyChallenge?.date === todayKey
      ? stats.dailyChallenge
      : getDefaultDailyChallenge(),
  };
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
    });
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
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setStats(cachedStats);
        setHydrated(true);
      }

      const userStats = await getUserStats(user.uid);
      setStats(userStats);
      setHydrated(true);
      writeCachedStats(user.uid, userStats);
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
