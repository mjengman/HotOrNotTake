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

export const useFirebaseTakes = (options: UseFirebaseTakesOptions = {}): UseFirebaseTakesResult => {
  const { user } = useAuth();
  const { category } = options;
  const [takes, setTakes] = useState<Take[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactedTakeIds, setInteractedTakeIds] = useState<string[]>([]);

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
      
      // If we've had 2 consecutive of the same category, MUST find a different one
      if (sameCount >= 2 && lastCategory) {
        console.log(`⚠️ Had ${sameCount} consecutive ${lastCategory}, forcing variety`);
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

  // Helper function to filter out interacted takes and apply category filter
  const filterTakes = useCallback((allTakes: Take[]) => {
    let filteredTakes = allTakes.filter(take => !interactedTakeIds.includes(take.id));
    
    // Apply category filter if specified (skip 'all' category)
    if (category && category !== 'all') {
      filteredTakes = filteredTakes.filter(take => take.category === category);
    } else if (category === 'all') {
      // Ensure variety when showing all categories
      filteredTakes = ensureCategoryVariety(filteredTakes);
    }
    
    return filteredTakes;
  }, [interactedTakeIds, category]);

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
          
          // Smart update: preserve current and next card to prevent shuffling
          setTakes(currentTakes => {
            if (currentTakes.length === 0) {
              // If no takes currently, just set the new ones
              return filteredUpdatedTakes;
            }
            
            // Keep first two cards (current and next) unchanged
            const preservedCards = currentTakes.slice(0, 2);
            const preservedIds = new Set(preservedCards.map(t => t.id));
            
            // Filter out preserved cards from new takes
            const newTakes = filteredUpdatedTakes.filter(t => !preservedIds.has(t.id));
            
            // Combine: preserved cards + new takes
            const combinedTakes = [...preservedCards, ...newTakes];
            
            // If we're in "all categories" mode, we need to re-apply variety to the new portion
            if (category === 'all' && newTakes.length > 0) {
              // Apply variety algorithm to just the new takes, then combine
              const varietyNewTakes = ensureCategoryVariety(newTakes);
              return [...preservedCards, ...varietyNewTakes];
            }
            
            return combinedTakes;
          });
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
  }, [user, filterTakes, category]); // Add category as dependency

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
      setTakes(prevTakes => {
        // Remove the voted card (should be the first one)
        const remainingTakes = prevTakes.filter(take => take.id !== takeId);
        return remainingTakes;
      });
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
      setTakes(prevTakes => {
        // Remove the skipped card (should be the first one)
        const remainingTakes = prevTakes.filter(take => take.id !== takeId);
        return remainingTakes;
      });
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

  // Refresh takes manually (preserves current view)
  const refreshTakes = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const freshTakes = await getApprovedTakes();
      const filteredFreshTakes = filterTakes(freshTakes);
      
      // Smart refresh: append new takes without disrupting current view
      setTakes(currentTakes => {
        if (currentTakes.length === 0) {
          return filteredFreshTakes;
        }
        
        // Keep first two cards unchanged
        const preservedCards = currentTakes.slice(0, 2);
        const preservedIds = new Set(preservedCards.map(t => t.id));
        
        // Get only new takes that aren't already preserved
        const newTakes = filteredFreshTakes.filter(t => !preservedIds.has(t.id));
        
        return [...preservedCards, ...newTakes];
      });
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