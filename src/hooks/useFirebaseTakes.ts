import { useState, useEffect, useCallback, useMemo } from 'react';
import { Take, TakeSubmission } from '../types/Take';
import {
  submitTake,
  getUserVotedAndSkippedTakeIds,
  skipTake,
  fetchMoreTakesFilled,
  resetFeedCursor,
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
  loadMore: (count?: number) => Promise<void>;
  hasMore: boolean;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactedTakeIds, setInteractedTakeIds] = useState<string[]>([]);
  const [feed, setFeed] = useState<Take[]>([]);
  const [hasMore, setHasMore] = useState(true);

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

  // Load user's interaction history (only voted, not skipped)
  useEffect(() => {
    const loadUserInteractions = async () => {
      if (!user) {
        setInteractedTakeIds([]);
        return;
      }

      try {
        // Only get voted takes, not skipped ones
        // This allows users to see skipped takes again
        const { voted } = await getUserVotedAndSkippedTakeIds(user.uid);
        setInteractedTakeIds(voted);
        console.log(`📊 User has voted on ${voted.length} takes`);
      } catch (err) {
        console.error('Error loading user interactions:', err);
        // Don't set error for this, just continue with empty array
        setInteractedTakeIds([]);
      }
    };

    loadUserInteractions();
  }, [user]);

  // Reset feed when category or user changes and load initial content
  useEffect(() => {
    const initializeFeed = async () => {
      setFeed([]);
      setHasMore(true);
      resetFeedCursor(category);
      setError(null);
      setLoading(true);

      try {
        const interacted = new Set(interactedTakeIds);
        const { items, gotAny } = await fetchMoreTakesFilled({
          category,
          targetCount: 30,
          pageSize: 50,
          interactedIds: interacted,
        });
        
        setFeed(items);
        setHasMore(gotAny && items.length > 0);
        console.log(`✅ Initial feed loaded: ${items.length} takes, hasMore: ${gotAny}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load takes');
        console.error('Error initializing feed:', err);
      } finally {
        setLoading(false);
      }
    };

    // Initialize when we have user data (or confirmed no user)
    if (user !== undefined) {
      initializeFeed();
    }
  }, [category, user, interactedTakeIds]);

  // Load more takes function
  const loadMore = useCallback(async (count: number = 20) => {
    if (!hasMore || loading) return;

    try {
      setLoading(true);
      const interacted = new Set(interactedTakeIds);
      
      // Also exclude what's already in feed to avoid duplicates
      for (const take of feed) {
        interacted.add(take.id);
      }

      const { items, gotAny } = await fetchMoreTakesFilled({
        category,
        targetCount: count,
        pageSize: 50,
        interactedIds: interacted,
      });

      setFeed(prev => ensureCategoryVariety([...prev, ...items]));
      setHasMore(gotAny && items.length > 0);
      console.log(`📝 Loaded ${items.length} more takes, hasMore: ${gotAny}, total feed: ${feed.length + items.length}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more takes');
      console.error('Error in loadMore:', err);
    } finally {
      setLoading(false);
    }
  }, [category, feed, hasMore, loading, interactedTakeIds, ensureCategoryVariety]);

  // Memoized takes with category variety applied
  const takes = useMemo(() => {
    if (feed.length === 0) return [];
    
    // Apply category variety algorithm
    return ensureCategoryVariety(feed);
  }, [feed, ensureCategoryVariety]);

  // Submit a vote
  const handleSubmitVote = useCallback(async (
    takeId: string,
    vote: 'hot' | 'not'
  ): Promise<void> => {
    if (!user) {
      throw new Error('User must be signed in to vote');
    }

    try {
      // Optimistically update interacted IDs and remove from feed
      setInteractedTakeIds(prev => {
        if (prev.includes(takeId)) return prev;
        return [...prev, takeId];
      });
      setFeed(prev => prev.filter(take => take.id !== takeId));
      
      // Submit the vote to Firebase
      await submitVote(takeId, user.uid, vote);
      
      // Update user's vote count
      await incrementUserVoteCount(user.uid);
      
      // Auto-load more if getting low
      if (feed.length < 10 && hasMore) {
        loadMore(20).catch(console.error);
      }
      
      console.log(`🗳️ Voted ${vote} on take ${takeId}`);
    } catch (err) {
      // Rollback on error
      setInteractedTakeIds(prev => prev.filter(id => id !== takeId));
      throw new Error(err instanceof Error ? err.message : 'Failed to submit vote');
    }
  }, [user, feed.length, hasMore, loadMore]);

  // Skip a take
  const handleSkipTake = useCallback(async (takeId: string): Promise<void> => {
    if (!user) {
      throw new Error('User must be signed in to skip takes');
    }

    try {
      // Remove from feed immediately (but don't add to interactedTakeIds since skips can reappear)
      setFeed(prev => prev.filter(take => take.id !== takeId));
      
      // Record the skip in Firebase
      await skipTake(takeId, user.uid);
      
      // Auto-load more if getting low
      if (feed.length < 10 && hasMore) {
        loadMore(20).catch(console.error);
      }
      
      console.log(`⏭️ Skipped take ${takeId}`);
    } catch (err) {
      console.error('❌ Skip failed in hook:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to skip take');
    }
  }, [user, feed.length, hasMore, loadMore]);

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
      setError(null);
      
      // Reset the feed and cursor
      setFeed([]);
      setHasMore(true);
      resetFeedCursor(category);
      categoryStateCache.clear();
      
      // Load fresh content
      const interacted = new Set(interactedTakeIds);
      const { items, gotAny } = await fetchMoreTakesFilled({
        category,
        targetCount: 30,
        pageSize: 50,
        interactedIds: interacted,
      });
      
      setFeed(items);
      setHasMore(gotAny && items.length > 0);
      console.log(`🔄 Refreshed feed: ${items.length} takes, hasMore: ${gotAny}`);
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
    loadMore,
    hasMore,
  };
};