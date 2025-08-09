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

interface UseFirebaseTakesOptions {
  category?: string;
}

// Global cache to preserve takes across category switches
const globalTakesCache = new Map<string, Take[]>();
const categoryStateCache = new Map<string, {
  takes: Take[];
  currentIndex: number;
  interactedIds: string[];
}>();

export const useFirebaseTakes = (options: UseFirebaseTakesOptions = {}): UseFirebaseTakesResult => {
  const { user } = useAuth();
  const { category = 'all' } = options;
  const [takes, setTakes] = useState<Take[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactedTakeIds, setInteractedTakeIds] = useState<string[]>([]);
  const [allTakes, setAllTakes] = useState<Take[]>([]);

  // Helper function to ensure variety in "all categories" mode
  const ensureCategoryVariety = (takes: Take[]): Take[] => {
    if (!takes || takes.length <= 2) return takes;
    
    const result: Take[] = [];
    const remaining = [...takes];
    let lastCategory: string | null = null;
    let sameCount = 0;
    
    console.log(`🎯 Starting category variety for ${takes.length} takes`);
    
    while (remaining.length > 0) {
      let nextIndex = 0;
      
      // If we would have 3 consecutive of the same category, MUST find a different one
      if (sameCount >= 2 && lastCategory && remaining[0].category === lastCategory) {
        console.log(`⚠️ Would have ${sameCount + 1} consecutive ${lastCategory}, forcing variety`);
        const differentIndex = remaining.findIndex(take => take.category !== lastCategory);
        if (differentIndex !== -1) {
          nextIndex = differentIndex;
          console.log(`✅ Found different category at index ${differentIndex}: ${remaining[differentIndex].category}`);
        } else {
          console.log(`⚠️ No different categories available, using first available`);
          // If no different category available, just take the first one
          nextIndex = 0;
        }
      }
      
      // Take the selected item
      const [selected] = remaining.splice(nextIndex, 1);
      result.push(selected);
      
      // Update tracking - this is the key fix!
      if (selected.category === lastCategory) {
        sameCount++;
      } else {
        lastCategory = selected.category;
        sameCount = 1; // Reset to 1 (not 0) because we just added one of this category
      }
      
      console.log(`📊 Added ${selected.category} (count: ${sameCount})`);
    }
    
    // Final verification - count consecutive categories
    let consecutive = 0;
    let currentCat = '';
    let maxConsecutive = 0;
    
    result.forEach((take, index) => {
      if (take.category === currentCat) {
        consecutive++;
      } else {
        maxConsecutive = Math.max(maxConsecutive, consecutive);
        currentCat = take.category;
        consecutive = 1;
      }
    });
    maxConsecutive = Math.max(maxConsecutive, consecutive);
    
    console.log(`✅ Category variety complete: ${result.length} takes, max consecutive: ${maxConsecutive}`);
    
    // Log first 10 categories for verification
    const first10 = result.slice(0, 10).map(t => t.category).join(' -> ');
    console.log(`🔍 First 10 categories: ${first10}`);
    
    return result;
  };

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
        
        // Cache all takes globally
        globalTakesCache.set('all', initialTakes);

        // Set up real-time subscription for all takes
        unsubscribe = subscribeToApprovedTakes((updatedTakes) => {
          setAllTakes(updatedTakes);
          globalTakesCache.set('all', updatedTakes);
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
  }, [user]); // Remove category from dependencies

  // Apply category filtering and preserve local state (with debouncing)
  useEffect(() => {
    if (allTakes.length === 0) {
      setTakes([]);
      return;
    }

    // Debounce rapid successive calls (common during swipes)
    const timeoutId = setTimeout(() => {
      console.log(`🔄 Filtering ${allTakes.length} takes for category: ${category}`);
      console.log(`🎯 User has interacted with ${interactedTakeIds.length} takes total`);
      
      // Clear cache to ensure fresh data when switching categories
      categoryStateCache.clear();
      
      // Apply fresh filtering (inline to avoid dependency issues)
      let filteredTakes = allTakes.filter(take => !interactedTakeIds.includes(take.id));
      const removedByInteraction = allTakes.length - filteredTakes.length;
      if (removedByInteraction > 0) {
        console.log(`⚠️ Filtered out ${removedByInteraction} takes due to prior interactions`);
      }
      
      // Apply category filter if specified (skip 'all' category)
      if (category && category !== 'all') {
        filteredTakes = filteredTakes.filter(take => take.category === category);
      } else if (category === 'all') {
        // Ensure variety when showing all categories
        filteredTakes = ensureCategoryVariety(filteredTakes);
      }
      
      setTakes(filteredTakes);
      
      console.log(`✅ Filtered to ${filteredTakes.length} takes for category: ${category}`);
    }, 50); // 50ms debounce to prevent double calls

    return () => clearTimeout(timeoutId);
  }, [allTakes, category, interactedTakeIds]);

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
      
      // Add take to interacted list (filtering effect will handle takes update)
      setInteractedTakeIds(prev => [...prev, takeId]);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to submit vote');
    }
  }, [user, category, interactedTakeIds]);

  // Skip a take
  const handleSkipTake = useCallback(async (takeId: string): Promise<void> => {
    if (!user) {
      throw new Error('User must be signed in to skip takes');
    }

    try {
      // Record the skip in Firebase
      await skipTake(takeId, user.uid);
      
      // Add take to interacted list (filtering effect will handle takes update)
      setInteractedTakeIds(prev => [...prev, takeId]);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to skip take');
    }
  }, [user, category, interactedTakeIds]);

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

  // Refresh takes manually (preserves current view)
  const refreshTakes = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const freshTakes = await getApprovedTakes();
      setAllTakes(freshTakes);
      
      // Clear cache for current category to force refresh
      categoryStateCache.delete(category);
      
      // Apply filtering with fresh data (inline to match main effect)
      let filteredFreshTakes = freshTakes.filter(take => !interactedTakeIds.includes(take.id));
      
      // Apply category filter if specified (skip 'all' category)
      if (category && category !== 'all') {
        filteredFreshTakes = filteredFreshTakes.filter(take => take.category === category);
      } else if (category === 'all') {
        // Ensure variety when showing all categories
        filteredFreshTakes = ensureCategoryVariety(filteredFreshTakes);
      }
      
      // Smart refresh: append new takes without disrupting current view
      setTakes(currentTakes => {
        if (currentTakes.length === 0) {
          return filteredFreshTakes;
        }
        
        // In "all categories" mode, don't preserve cards - use the full variety algorithm result
        if (category === 'all') {
          console.log('🔄 All categories refresh: Using full variety algorithm result');
          return filteredFreshTakes;
        }
        
        // For specific categories, keep first two cards unchanged
        const preservedCards = currentTakes.slice(0, 2);
        const preservedIds = new Set(preservedCards.map(t => t.id));
        
        // Get only new takes that aren't already preserved
        const newTakes = filteredFreshTakes.filter(t => !preservedIds.has(t.id));
        
        const result = [...preservedCards, ...newTakes];
        
        // Update cache with new result
        categoryStateCache.set(category, {
          takes: result,
          currentIndex: 0,
          interactedIds: interactedTakeIds
        });
        
        return result;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh takes');
    } finally {
      setLoading(false);
    }
  }, [category, interactedTakeIds]);

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