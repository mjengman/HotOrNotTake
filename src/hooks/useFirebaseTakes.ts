import { useState, useEffect, useCallback, useMemo } from 'react';
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

interface UseFirebaseTakesOptions {
  category?: string;
}

// Cache to preserve takes across category switches
const categoryStateCache = new Map<string, {
  takes: Take[];
  interactedIds: string[];
}>();

export const useFirebaseTakes = (options: UseFirebaseTakesOptions = {}): UseFirebaseTakesResult => {
  const { user } = useAuth();
  const { category = 'all' } = options;
  // Removed takes state - will use useMemo instead
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactedTakeIds, setInteractedTakeIds] = useState<string[]>([]);
  const [allTakes, setAllTakes] = useState<Take[]>([]);

  // Simplified category variety algorithm - O(n) complexity
  const ensureCategoryVariety = useCallback((takesArray: Take[]): Take[] => {
    if (category !== 'all' || takesArray.length <= 2) return takesArray;
    
    const result: Take[] = [];
    const availableTakes = [...takesArray];
    let lastCategory: string | null = null;
    let consecutiveCount = 0;
    const maxConsecutive = 2;
    
    while (availableTakes.length > 0) {
      // Check if we need variety (already have 2 consecutive of same category)
      const needsVariety = lastCategory && consecutiveCount >= maxConsecutive;
      
      let nextTakeIndex = 0;
      if (needsVariety) {
        // Try to find a different category
        const differentIndex = availableTakes.findIndex(t => t.category !== lastCategory);
        if (differentIndex !== -1) {
          nextTakeIndex = differentIndex;
        } else {
          // No different categories available, just warn once and continue
          if (consecutiveCount === maxConsecutive) {
            console.log(`⚠️ Only ${lastCategory} remains, allowing consecutive takes`);
          }
        }
      }
      
      // Take the selected item
      const nextTake = availableTakes[nextTakeIndex];
      availableTakes.splice(nextTakeIndex, 1);
      result.push(nextTake);
      
      // Update tracking
      if (nextTake.category === lastCategory) {
        consecutiveCount++;
      } else {
        lastCategory = nextTake.category;
        consecutiveCount = 1;
      }
    }
    
    // Log summary
    const categories = result.slice(0, 10).map(t => t.category);
    console.log(`✅ Category variety: ${result.length} takes, first 10: ${categories.join(' → ')}`);
    
    return result;
  }, [category]);

  // Filtering logic is now inlined in effects to prevent circular dependencies

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

  // Load all takes and set up real-time subscription (category-independent)
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initializeTakes = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load all takes (no category filtering here)
        const initialTakes = await getApprovedTakes();
        setAllTakes(initialTakes);
        console.log(`✅ Loaded ${initialTakes.length} approved takes`);

        // Set up real-time subscription for all takes
        unsubscribe = subscribeToApprovedTakes((updatedTakes) => {
          setAllTakes(updatedTakes);
          console.log(`🔄 Real-time update: ${updatedTakes.length} takes`);
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
  }, [user]);

  // Memoized filtering - replaces the old useEffect with proper memoization
  const takes = useMemo(() => {
    if (allTakes.length === 0) return [];

    // Check cache first
    const cacheKey = `${category}-${interactedTakeIds.join(',')}`;
    const cached = categoryStateCache.get(cacheKey);
    if (cached && JSON.stringify(cached.interactedIds) === JSON.stringify(interactedTakeIds)) {
      console.log(`🗳️ Using cached takes for ${category}: ${cached.takes.length} takes`);
      return cached.takes;
    }

    console.log(`🔄 Filtering ${allTakes.length} takes for category: ${category}`);
    
    // Apply filtering
    let filteredTakes = allTakes.filter(take => !interactedTakeIds.includes(take.id));
    const removedByInteraction = allTakes.length - filteredTakes.length;
    if (removedByInteraction > 0) {
      console.log(`⚠️ Filtered out ${removedByInteraction} takes due to prior interactions`);
    }
    
    // Apply category filter
    if (category && category !== 'all') {
      filteredTakes = filteredTakes.filter(take => take.category === category);
    } else if (category === 'all') {
      filteredTakes = ensureCategoryVariety(filteredTakes);
    }
    
    // Update cache
    categoryStateCache.set(cacheKey, { takes: filteredTakes, interactedIds: interactedTakeIds });
    console.log(`✅ Filtered to ${filteredTakes.length} takes for category: ${category}`);
    
    return filteredTakes;
  }, [allTakes, category, interactedTakeIds, ensureCategoryVariety]);

  // Submit a vote
  const handleSubmitVote = useCallback(async (
    takeId: string,
    vote: 'hot' | 'not'
  ): Promise<void> => {
    if (!user) {
      throw new Error('User must be signed in to vote');
    }

    try {
      // Immediately update interacted IDs to prevent race conditions
      setInteractedTakeIds(prev => {
        if (prev.includes(takeId)) return prev;
        return [...prev, takeId];
      });
      
      // Submit the vote to Firebase
      await submitVote(takeId, user.uid, vote);
      
      // Update user's vote count
      await incrementUserVoteCount(user.uid);
      
      console.log(`🗳️ Voted ${vote} on take ${takeId}`);
    } catch (err) {
      // Rollback on error
      setInteractedTakeIds(prev => prev.filter(id => id !== takeId));
      throw new Error(err instanceof Error ? err.message : 'Failed to submit vote');
    }
  }, [user]);

  // Skip a take
  const handleSkipTake = useCallback(async (takeId: string): Promise<void> => {
    if (!user) {
      throw new Error('User must be signed in to skip takes');
    }

    try {
      // Immediately update interacted IDs to prevent race conditions
      setInteractedTakeIds(prev => {
        if (prev.includes(takeId)) return prev;
        return [...prev, takeId];
      });
      
      // Record the skip in Firebase
      await skipTake(takeId, user.uid);
      
      console.log(`⏭️ Skipped take ${takeId}`);
    } catch (err) {
      // Rollback on error
      setInteractedTakeIds(prev => prev.filter(id => id !== takeId));
      console.error('❌ Skip failed in hook:', err);
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
      // Submit the take to Firebase (includes AI moderation)
      const takeId = await submitTake(takeData, user.uid);
      
      // Update user's submission count
      await incrementUserSubmissionCount(user.uid, takeId);
      
      // Force refresh takes list to show new submission immediately
      // Add a small delay to ensure the database write has propagated
      await new Promise(resolve => setTimeout(resolve, 500));
      const freshTakes = await getApprovedTakes();
      setAllTakes(freshTakes);
      
      console.log(`✅ Take submitted, approved, and list refreshed - new take should appear`);
    } catch (err) {
      // If the error message contains "Take rejected:", it's a moderation rejection
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit take';
      
      if (errorMessage.startsWith('Take rejected:')) {
        // Extract just the reason part
        const reason = errorMessage.replace('Take rejected: ', '');
        throw new Error(`Your take was not approved: ${reason}`);
      } else {
        throw new Error(errorMessage);
      }
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
      setAllTakes(freshTakes);
      
      // Clear cache to force re-filtering with fresh data
      categoryStateCache.clear();
      console.log(`🔄 Refreshed ${freshTakes.length} takes for category: ${category}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh takes');
    } finally {
      setLoading(false);
    }
  }, [category]);

  return {
    takes, // Now computed via useMemo
    loading,
    error,
    submitVote: handleSubmitVote,
    skipTake: handleSkipTake,
    submitNewTake: handleSubmitNewTake,
    getUserVoteForTake: handleGetUserVoteForTake,
    refreshTakes,
  };
};