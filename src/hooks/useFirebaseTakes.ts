import { useState, useEffect, useCallback } from 'react';
import { Take, TakeSubmission } from '../types/Take';
import {
  getApprovedTakes,
  subscribeToApprovedTakes,
  submitTake,
} from '../services/takeService';
import {
  submitVote,
  getUserVoteForTake,
} from '../services/voteService';
import { 
  incrementUserSubmissionCount,
  incrementUserVoteCount,
} from '../services/userService';
import { useAuth } from './useAuth';

interface UseFirebaseTakesResult {
  takes: Take[];
  loading: boolean;
  error: string | null;
  submitVote: (takeId: string, vote: 'hot' | 'not') => Promise<void>;
  submitNewTake: (takeData: TakeSubmission) => Promise<void>;
  getUserVoteForTake: (takeId: string) => Promise<'hot' | 'not' | null>;
  refreshTakes: () => Promise<void>;
}

export const useFirebaseTakes = (): UseFirebaseTakesResult => {
  const { user } = useAuth();
  const [takes, setTakes] = useState<Take[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial takes and set up real-time subscription
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initializeTakes = async () => {
      try {
        setLoading(true);
        setError(null);

        // First, load takes immediately
        const initialTakes = await getApprovedTakes();
        setTakes(initialTakes);

        // Then set up real-time subscription
        unsubscribe = subscribeToApprovedTakes((updatedTakes) => {
          setTakes(updatedTakes);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load takes');
        console.error('Error initializing takes:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeTakes();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Submit a vote
  const handleSubmitVote = useCallback(async (
    takeId: string,
    vote: 'hot' | 'not'
  ): Promise<void> => {
    if (!user) {
      throw new Error('User must be signed in to vote');
    }

    try {
      // Submit the vote to Firebase
      await submitVote(takeId, user.uid, vote);
      
      // Update user's vote count
      await incrementUserVoteCount(user.uid);
      
      // Update local state optimistically
      setTakes(prevTakes => 
        prevTakes.map(take => {
          if (take.id === takeId) {
            return {
              ...take,
              hotVotes: vote === 'hot' ? take.hotVotes + 1 : take.hotVotes,
              notVotes: vote === 'not' ? take.notVotes + 1 : take.notVotes,
              totalVotes: take.totalVotes + 1,
            };
          }
          return take;
        })
      );
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to submit vote');
    }
  }, [user]);

  // Submit a new take
  const handleSubmitNewTake = useCallback(async (
    takeData: TakeSubmission
  ): Promise<void> => {
    if (!user) {
      throw new Error('User must be signed in to submit takes');
    }

    try {
      // Submit the take to Firebase
      const takeId = await submitTake(takeData, user.uid);
      
      // Update user's submission count
      await incrementUserSubmissionCount(user.uid, takeId);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to submit take');
    }
  }, [user]);

  // Get user's vote for a specific take
  const handleGetUserVoteForTake = useCallback(async (
    takeId: string
  ): Promise<'hot' | 'not' | null> => {
    if (!user) {
      return null;
    }

    try {
      const vote = await getUserVoteForTake(takeId, user.uid);
      return vote?.vote || null;
    } catch (err) {
      console.error('Error getting user vote:', err);
      return null;
    }
  }, [user]);

  // Refresh takes manually
  const refreshTakes = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const freshTakes = await getApprovedTakes();
      setTakes(freshTakes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh takes');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    takes,
    loading,
    error,
    submitVote: handleSubmitVote,
    submitNewTake: handleSubmitNewTake,
    getUserVoteForTake: handleGetUserVoteForTake,
    refreshTakes,
  };
};