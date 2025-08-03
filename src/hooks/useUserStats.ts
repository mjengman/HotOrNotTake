import { useState, useEffect, useCallback } from 'react';
import { UserStats } from '../types/User';
import { getUserStats } from '../services/userService';
import { useAuth } from './useAuth';

interface UseUserStatsResult {
  stats: UserStats;
  loading: boolean;
  error: string | null;
  refreshStats: () => Promise<void>;
}

export const useUserStats = (): UseUserStatsResult => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats>({
    totalVotes: 0,
    hotVotesGiven: 0,
    notVotesGiven: 0,
    takesSubmitted: 0,
    votingStreak: 0,
    favoriteCategories: [],
    joinedAt: new Date(),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user stats
  const loadStats = useCallback(async () => {
    if (!user) {
      setStats({
        totalVotes: 0,
        hotVotesGiven: 0,
        notVotesGiven: 0,
        takesSubmitted: 0,
        votingStreak: 0,
        favoriteCategories: [],
        joinedAt: new Date(),
      });
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const userStats = await getUserStats(user.uid);
      setStats(userStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
      console.error('Error loading user stats:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load stats when user changes
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    error,
    refreshStats: loadStats,
  };
};