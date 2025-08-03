import { useState, useEffect, useCallback } from 'react';
import { Take, TakeSubmission } from '../types/Take';
import {
  getApprovedTakes,
  subscribeToApprovedTakes,
  submitTake,
  getUserInteractedTakeIds,
  skipTake,
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
  skipTake: (takeId: string) => Promise<void>;
  submitNewTake: (takeData: TakeSubmission) => Promise<void>;
  getUserVoteForTake: (takeId: string) => Promise<'hot' | 'not' | null>;
  refreshTakes: () => Promise<void>;
}

export const useFirebaseTakes = (): UseFirebaseTakesResult => {
  const { user } = useAuth();
  const [takes, setTakes] = useState<Take[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactedTakeIds, setInteractedTakeIds] = useState<string[]>([]);

  // Helper function to filter out interacted takes
  const filterTakes = useCallback((allTakes: Take[]) => {
    return allTakes.filter(take => !interactedTakeIds.includes(take.id));
  }, [interactedTakeIds]);

  // Load user's interaction history
  useEffect(() => {
    const loadUserInteractions = async () => {
      if (!user) {
        setInteractedTakeIds([]);
        return;
      }

      try {
        const interactedIds = await getUserInteractedTakeIds(user.uid);
        setInteractedTakeIds(interactedIds);
      } catch (err) {
        console.error('Error loading user interactions:', err);
        // Don't set error for this, just continue with empty array
        setInteractedTakeIds([]);
      }
    };

    loadUserInteractions();
  }, [user]);

  // Load initial takes and set up real-time subscription
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initializeTakes = async () => {
      try {
        setLoading(true);
        setError(null);

        // First, load takes immediately
        const initialTakes = await getApprovedTakes();
        const filteredTakes = filterTakes(initialTakes);
        setTakes(filteredTakes);

        // Then set up real-time subscription
        unsubscribe = subscribeToApprovedTakes((updatedTakes) => {
          const filteredUpdatedTakes = filterTakes(updatedTakes);
          setTakes(filteredUpdatedTakes);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load takes');
        console.error('Error initializing takes:', err);
      } finally {
        setLoading(false);
      }
    };

    // Only initialize takes if we have the interaction data or user is null
    if (user === null || interactedTakeIds !== null) {
      initializeTakes();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, filterTakes]);

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
      
      // Add take to interacted list and remove from current takes
      setInteractedTakeIds(prev => [...prev, takeId]);
      setTakes(prevTakes => prevTakes.filter(take => take.id !== takeId));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to submit vote');
    }
  }, [user]);

  // Skip a take
  const handleSkipTake = useCallback(async (takeId: string): Promise<void> => {
    if (!user) {
      throw new Error('User must be signed in to skip takes');
    }

    try {
      // Record the skip in Firebase
      await skipTake(takeId, user.uid);
      
      // Add take to interacted list and remove from current takes
      setInteractedTakeIds(prev => [...prev, takeId]);
      setTakes(prevTakes => prevTakes.filter(take => take.id !== takeId));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to skip take');
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
      const filteredFreshTakes = filterTakes(freshTakes);
      setTakes(filteredFreshTakes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh takes');
    } finally {
      setLoading(false);
    }
  }, [filterTakes]);

  return {
    takes,
    loading,
    error,
    submitVote: handleSubmitVote,
    skipTake: handleSkipTake,
    submitNewTake: handleSubmitNewTake,
    getUserVoteForTake: handleGetUserVoteForTake,
    refreshTakes,
  };
};