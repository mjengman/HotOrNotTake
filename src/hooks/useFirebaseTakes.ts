import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Take, TakeSubmission } from '../types/Take';
import {
  submitTake,
  requestGeneratedTakes,
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
  updateUserEngagementAfterVote,
} from '../services/userService';
import { useAuth } from './useAuth';
import { StreakUpdateResult } from '../types/User';

interface UseFirebaseTakesResult {
  takes: Take[];
  loading: boolean;
  error: string | null;
  submitVote: (
    takeId: string,
    vote: 'hot' | 'not',
    options?: { countDailyEngagement?: boolean }
  ) => Promise<StreakUpdateResult | null>;
  skipTake: (takeId: string) => Promise<void>;
  submitNewTake: (takeData: TakeSubmission) => Promise<void>;
  getUserVoteForTake: (takeId: string) => Promise<'hot' | 'not' | null>;
  refreshTakes: () => Promise<void>;
  loadMore: (count?: number, force?: boolean, background?: boolean) => Promise<void>;
  hasMore: boolean;
  prependTake: (take: Take) => void;
}

interface UseFirebaseTakesOptions {
  category?: string;
}

const FEED_CACHE_VERSION = 'v1';
const FEED_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FEED_CACHE_BATCH_SIZE = 30;
const FEED_CACHE_PREFIX = `feed-cache:${FEED_CACHE_VERSION}`;
const LOCAL_VOTED_PREFIX = `local-voted:${FEED_CACHE_VERSION}`;

type CachedTake = Omit<Take, 'createdAt' | 'submittedAt' | 'approvedAt' | 'rejectedAt'> & {
  createdAt: string;
  submittedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
};

interface FeedCacheRecord {
  savedAt: number;
  takes: CachedTake[];
}

const getCategoryCacheSlug = (category: string) => (category || 'all').toLowerCase();

const getFeedCacheKey = (userId: string, category: string) =>
  `${FEED_CACHE_PREFIX}:${userId}:${getCategoryCacheSlug(category)}`;

const getLocalVotedKey = (userId: string) => `${LOCAL_VOTED_PREFIX}:${userId}`;

const serializeTake = (take: Take): CachedTake => ({
  ...take,
  createdAt: take.createdAt.toISOString(),
  submittedAt: take.submittedAt.toISOString(),
  approvedAt: take.approvedAt?.toISOString(),
  rejectedAt: take.rejectedAt?.toISOString(),
});

const parseDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const deserializeTake = (take: CachedTake): Take => ({
  ...take,
  createdAt: parseDate(take.createdAt) ?? new Date(),
  submittedAt: parseDate(take.submittedAt) ?? new Date(),
  approvedAt: parseDate(take.approvedAt),
  rejectedAt: parseDate(take.rejectedAt),
});

const readLocalVotedIds = async (userId: string): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(getLocalVotedKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch (error) {
    console.warn('Unable to read local voted IDs:', error);
    return [];
  }
};

const writeLocalVotedIds = async (userId: string, votedIds: string[]) => {
  try {
    await AsyncStorage.setItem(
      getLocalVotedKey(userId),
      JSON.stringify(Array.from(new Set(votedIds)))
    );
  } catch (error) {
    console.warn('Unable to write local voted IDs:', error);
  }
};

const addLocalVotedId = async (userId: string, takeId: string) => {
  const votedIds = await readLocalVotedIds(userId);
  if (!votedIds.includes(takeId)) {
    await writeLocalVotedIds(userId, [...votedIds, takeId]);
  }
};

const removeLocalVotedId = async (userId: string, takeId: string) => {
  const votedIds = await readLocalVotedIds(userId);
  await writeLocalVotedIds(userId, votedIds.filter(id => id !== takeId));
};

const readFeedCache = async (
  userId: string,
  category: string,
  votedIds: Set<string>
): Promise<Take[]> => {
  try {
    const raw = await AsyncStorage.getItem(getFeedCacheKey(userId, category));
    if (!raw) return [];

    const record = JSON.parse(raw) as FeedCacheRecord;
    if (
      !record ||
      typeof record.savedAt !== 'number' ||
      !Array.isArray(record.takes) ||
      Date.now() - record.savedAt > FEED_CACHE_TTL_MS
    ) {
      return [];
    }

    return record.takes
      .map(deserializeTake)
      .filter(take =>
        !votedIds.has(take.id) &&
        (take.isApproved === true || take.status === 'approved')
      );
  } catch (error) {
    console.warn('Unable to read feed cache:', error);
    return [];
  }
};

const writeFeedCache = async (userId: string, category: string, takes: Take[]) => {
  try {
    const approvedTakes = takes
      .filter(take => take.isApproved === true || take.status === 'approved')
      .slice(0, FEED_CACHE_BATCH_SIZE);

    if (approvedTakes.length === 0) {
      await AsyncStorage.removeItem(getFeedCacheKey(userId, category));
      return;
    }

    const record: FeedCacheRecord = {
      savedAt: Date.now(),
      takes: approvedTakes.map(serializeTake),
    };

    await AsyncStorage.setItem(getFeedCacheKey(userId, category), JSON.stringify(record));
  } catch (error) {
    console.warn('Unable to write feed cache:', error);
  }
};

const mergeLiveFeedWithVisibleDeck = (
  visibleTakes: Take[],
  liveTakes: Take[],
  votedIds: Set<string>
): Take[] => {
  const liveById = new Map(liveTakes.map(take => [take.id, take]));
  const merged: Take[] = [];
  const usedIds = new Set<string>();

  visibleTakes.forEach((take) => {
    if (votedIds.has(take.id) || usedIds.has(take.id)) {
      return;
    }

    const refreshedTake = liveById.get(take.id);
    if (!refreshedTake) {
      return;
    }

    merged.push(refreshedTake);
    usedIds.add(take.id);
  });

  liveTakes.forEach((take) => {
    if (!votedIds.has(take.id) && !usedIds.has(take.id)) {
      merged.push(take);
      usedIds.add(take.id);
    }
  });

  return merged;
};

export const useFirebaseTakes = (options: UseFirebaseTakesOptions = {}): UseFirebaseTakesResult => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid;
  const { category = 'all' } = options;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactedTakeIds, setInteractedTakeIds] = useState<string[]>([]);
  const [feed, setFeed] = useState<Take[]>([]);
  const [hasMore, setHasMore] = useState(true);

  // Atomic guard against concurrent duplicate submits
  const inFlightVotesRef = useRef<Set<string>>(new Set());
  const generationInFlightRef = useRef(false);
  const generationTriggeredForRef = useRef<string | null>(null);
  const initialLoadRequestRef = useRef(0);

  // Stable category variety algorithm - freezes prefix to prevent reshuffling
  const ensureCategoryVariety = useCallback((takesArray: Take[], freezePrefixCount: number = 0): Take[] => {
    // Don't touch the already-present prefix
    const prefix = takesArray.slice(0, freezePrefixCount);
    const tail = takesArray.slice(freezePrefixCount);
    if (category !== 'all' || tail.length <= 2) return takesArray;

    const result: Take[] = [...prefix];
    const availableTakes = [...tail];
    let lastCategory: string | null = prefix.length ? prefix[prefix.length - 1]?.category ?? null : null;
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
    console.log(`✅ Category variety: ${result.length} takes, first 10: ${categories.join(' → ')}, froze prefix: ${freezePrefixCount}`);
    
    return result;
  }, [category]);

  // Reset feed when category or user changes and load initial content
  useEffect(() => {
    const requestId = ++initialLoadRequestRef.current;
    let isActive = true;
    const isCurrentRequest = () => isActive && initialLoadRequestRef.current === requestId;

    if (authLoading || !userId) {
      setFeed([]);
      setHasMore(true);
      setError(null);
      setLoading(true);
      setInteractedTakeIds([]);
      return () => {
        isActive = false;
      };
    }

    const initializeFeed = async () => {
      setHasMore(true);
      resetFeedCursor(category);
      setError(null);
      setLoading(true);
      let renderedCache = false;

      try {
        const localVotedIds = await readLocalVotedIds(userId);
        if (!isCurrentRequest()) {
          return;
        }

        const localVotedSet = new Set(localVotedIds);
        const cachedTakes = await readFeedCache(userId, category, localVotedSet);

        if (!isCurrentRequest()) {
          return;
        }

        if (cachedTakes.length > 0) {
          const orderedCached = category === 'all'
            ? ensureCategoryVariety(cachedTakes, cachedTakes.length)
            : cachedTakes;

          setFeed(orderedCached);
          setInteractedTakeIds(localVotedIds);
          setHasMore(true);
          setLoading(false);
          renderedCache = true;
          console.log(`⚡ Warm-started ${orderedCached.length} cached takes for ${userId}:${category}`);
        } else {
          setFeed([]);
        }

        const { voted } = await getUserVotedAndSkippedTakeIds(userId);
        if (!isCurrentRequest()) {
          return;
        }
        const freshInteractedIds = new Set(voted);
        setInteractedTakeIds(voted);
        writeLocalVotedIds(userId, voted).catch(console.warn);
        console.log(`🔄 Refreshed user interactions: ${voted.length} voted takes`);

        const { items, gotAny } = await fetchMoreTakesFilled({
          category,
          targetCount: 30,
          pageSize: 50,
          interactedIds: freshInteractedIds,
        });
        if (!isCurrentRequest()) {
          return;
        }
        
        // Double-check filtering: ensure no voted takes made it through
        const doubleFiltered = items.filter(take => {
          const isVoted = freshInteractedIds.has(take.id);
          if (isVoted) {
            console.warn(`⚠️ Filtering out already-voted take that slipped through: ${take.id}`);
          }
          return !isVoted;
        });
        
        // Apply variety once on initial load
        const ordered = category === 'all' ? ensureCategoryVariety(doubleFiltered, 0) : doubleFiltered;
        setFeed(prev => {
          const merged = renderedCache
            ? mergeLiveFeedWithVisibleDeck(prev, ordered, freshInteractedIds)
            : ordered;
          const finalFeed = category === 'all' && renderedCache
            ? ensureCategoryVariety(merged, prev.length)
            : merged;
          writeFeedCache(userId, category, finalFeed).catch(console.warn);
          return finalFeed;
        });
        setHasMore(gotAny && ordered.length > 0);
        console.log(`✅ Initial feed loaded: ${doubleFiltered.length} takes (filtered from ${items.length}), hasMore: ${gotAny}`);
      } catch (err) {
        if (!isCurrentRequest()) {
          return;
        }
        if (!renderedCache) {
          setError(err instanceof Error ? err.message : 'Failed to load takes');
        }
        console.error('Error initializing feed:', err);
      } finally {
        if (isCurrentRequest()) {
          setLoading(false);
        }
      }
    };

    initializeFeed();

    return () => {
      isActive = false;
    };
  }, [authLoading, category, userId, ensureCategoryVariety]);

  // Load more takes function
  const loadMore = useCallback(async (
    count: number = 20,
    force: boolean = false,
    background: boolean = false
  ) => {
    if (!userId || (!force && !hasMore) || loading) return;

    try {
      if (!background) {
        setLoading(true);
      }
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

      // Double-check filtering: ensure no interacted takes made it through
      const doubleFiltered = items.filter(take => {
        const isInteracted = interacted.has(take.id);
        if (isInteracted) {
          console.warn(`⚠️ LoadMore: Filtering out already-interacted take that slipped through: ${take.id}`);
        }
        return !isInteracted;
      });

      setFeed(prev => {
        const combined = [...prev, ...doubleFiltered];
        if (category !== 'all') {
          writeFeedCache(userId, category, combined).catch(console.warn);
          return combined;
        }
        // Freeze the existing length so we only variety-shuffle the newly appended tail
        const ordered = ensureCategoryVariety(combined, prev.length);
        writeFeedCache(userId, category, ordered).catch(console.warn);
        return ordered;
      });
      setHasMore(gotAny && doubleFiltered.length > 0);
      console.log(`📝 Loaded ${doubleFiltered.length} more takes (filtered from ${items.length}), hasMore: ${gotAny}, total feed: ${feed.length + doubleFiltered.length}`);
    } catch (err) {
      if (!background) {
        setError(err instanceof Error ? err.message : 'Failed to load more takes');
      }
      console.error('Error in loadMore:', err);
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, [category, feed, hasMore, loading, interactedTakeIds, ensureCategoryVariety, userId]);

  // Return feed directly - variety is applied once during load, not on every render
  const takes = feed;

  useEffect(() => {
    if (!userId || loading) {
      return;
    }

    const generationKey = `${userId}:${category}`;
    if (takes.length > 3) {
      if (generationTriggeredForRef.current === generationKey) {
        generationTriggeredForRef.current = null;
      }
      return;
    }

    if (
      generationInFlightRef.current ||
      generationTriggeredForRef.current === generationKey
    ) {
      return;
    }

    generationInFlightRef.current = true;
    generationTriggeredForRef.current = generationKey;

    requestGeneratedTakes(category)
      .then((result) => {
        if (result.addedCount > 0) {
          resetFeedCursor(category);
          loadMore(20, true, true).catch((err) => {
            console.log('Background feed refill failed:', err);
          });
        }
      })
      .catch((err) => {
        console.log('AI take generation skipped:', err instanceof Error ? err.message : err);
      })
      .finally(() => {
        generationInFlightRef.current = false;
      });
  }, [category, loadMore, loading, takes.length, userId]);

  // Submit a vote
  const handleSubmitVote = useCallback(async (
    takeId: string,
    vote: 'hot' | 'not',
    options: { countDailyEngagement?: boolean } = {}
  ): Promise<StreakUpdateResult | null> => {
    if (!userId) {
      throw new Error('User must be signed in to vote');
    }

    // Atomic guard against concurrent duplicate submits
    if (inFlightVotesRef.current.has(takeId)) {
      console.log('⚠️ Vote already in progress for take:', takeId);
      return null; // Silent return, don't throw
    }

    try {
      // Check if we've already voted on this take
      if (interactedTakeIds.includes(takeId)) {
        console.warn('⚠️ Duplicate vote prevented - take already voted:', takeId);
        // Silently return instead of throwing to prevent crashes
        // Remove from feed if somehow still there
        setFeed(prev => prev.filter(take => take.id !== takeId));
        return null;
      }

      // Mark as in-flight
      inFlightVotesRef.current.add(takeId);

      // Optimistically update interacted IDs and remove from feed
      setInteractedTakeIds(prev => {
        console.log('🗳️ Adding take to voted list:', takeId);
        return [...prev, takeId];
      });
      setFeed(prev => {
        console.log('🗑️ Removing take from feed:', takeId, 'Feed length before:', prev.length);
        const newFeed = prev.filter(take => take.id !== takeId);
        console.log('🗑️ Feed length after:', newFeed.length);
        writeFeedCache(userId, category, newFeed).catch(console.warn);
        return newFeed;
      });
      
      // Submit the vote to Firebase
      await submitVote(takeId, userId, vote);
      await addLocalVotedId(userId, takeId);

      let streakUpdate: StreakUpdateResult | null = null;
      try {
        const votedTake = feed.find(take => take.id === takeId);
        streakUpdate = await updateUserEngagementAfterVote(userId, {
          category: votedTake?.category,
          countDailyEngagement: options.countDailyEngagement !== false,
        });
      } catch (streakError) {
        console.warn('Vote engagement update failed:', streakError);
      }
      
      // Auto-load more if getting low
      if (feed.length < 10 && hasMore) {
        loadMore(20).catch(console.error);
      }
      
      console.log(`🗳️ Voted ${vote} on take ${takeId}`);
      return streakUpdate;
    } catch (err) {
      // Rollback on error
      setInteractedTakeIds(prev => prev.filter(id => id !== takeId));
      console.error('Vote error, but handled gracefully:', err);
      // Don't throw - just log to prevent crashes
      return null;
    } finally {
      // Always clear in-flight flag
      inFlightVotesRef.current.delete(takeId);
    }
  }, [userId, category, feed, hasMore, loadMore, interactedTakeIds]);

  // Skip a take
  const handleSkipTake = useCallback(async (takeId: string): Promise<void> => {
    if (!userId) {
      throw new Error('User must be signed in to skip takes');
    }

    try {
      // Remove from feed immediately (but don't add to interactedTakeIds since skips can reappear)
      setFeed(prev => {
        const newFeed = prev.filter(take => take.id !== takeId);
        writeFeedCache(userId, category, newFeed).catch(console.warn);
        return newFeed;
      });
      
      // Record the skip in Firebase
      await skipTake(takeId, userId);
      
      // Auto-load more if getting low
      if (feed.length < 10 && hasMore) {
        loadMore(20).catch(console.error);
      }
      
      console.log(`⏭️ Skipped take ${takeId}`);
    } catch (err) {
      console.error('❌ Skip failed in hook:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to skip take');
    }
  }, [userId, category, feed.length, hasMore, loadMore]);

  // Submit a new take
  const handleSubmitNewTake = useCallback(async (
    takeData: TakeSubmission
  ): Promise<void> => {
    if (!userId) {
      throw new Error('User must be signed in to submit takes');
    }

    try {
      // Submit the take through the server moderation function
      const takeId = await submitTake(takeData, userId);
      
      // Update user's submission count
      await incrementUserSubmissionCount(userId, takeId);
      
      // Approved takes are live immediately; moderation failures are queued
      // as pending and remain visible only to the submitting user.
      console.log(`✅ Take submitted successfully`);
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
  }, [userId]);

  // Get user's vote for a specific take
  const handleGetUserVoteForTake = useCallback(async (
    takeId: string
  ): Promise<'hot' | 'not' | null> => {
    if (!userId) {
      return null;
    }

    try {
      const vote = await getUserVoteForTake(takeId, userId);
      return vote?.vote || null;
    } catch (err) {
      console.error('Error getting user vote:', err);
      return null;
    }
  }, [userId]);

  // Refresh takes manually
  const refreshTakes = useCallback(async (): Promise<void> => {
    if (!userId) {
      setFeed([]);
      setHasMore(true);
      setLoading(true);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Reset the feed and cursor
      setFeed([]);
      setHasMore(true);
      resetFeedCursor(category);

      const { voted } = await getUserVotedAndSkippedTakeIds(userId);
      const freshInteractedIds = new Set(voted);
      setInteractedTakeIds(voted);
      writeLocalVotedIds(userId, voted).catch(console.warn);
      
      // Load fresh content
      const { items, gotAny } = await fetchMoreTakesFilled({
        category,
        targetCount: 30,
        pageSize: 50,
        interactedIds: freshInteractedIds,
      });
      
      // Apply variety once to the fresh list
      const ordered = category === 'all' ? ensureCategoryVariety(items, 0) : items;
      setFeed(ordered);
      writeFeedCache(userId, category, ordered).catch(console.warn);
      setHasMore(gotAny && ordered.length > 0);
      console.log(`🔄 Refreshed feed: ${items.length} takes, hasMore: ${gotAny}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh takes');
    } finally {
      setLoading(false);
    }
  }, [category, ensureCategoryVariety, userId]);

  // Prepend a take to the front of the deck (used for vote changes)
  const prependTake = useCallback((take: Take) => {
    if (userId) {
      removeLocalVotedId(userId, take.id).catch(console.warn);
    }

    // Remove the take from interacted IDs so it can be voted on again
    setInteractedTakeIds(prev => prev.filter(id => id !== take.id));
    
    // Add the take to the front of the feed
    setFeed(prev => {
      // Remove the take if it already exists in the feed
      const filtered = prev.filter(existingTake => existingTake.id !== take.id);
      // Add it to the front
      const nextFeed = [take, ...filtered];
      if (userId) {
        writeFeedCache(userId, category, nextFeed).catch(console.warn);
      }
      return nextFeed;
    });
    
    console.log(`🔄 Prepended take ${take.id} to front of deck for re-voting`);
  }, [category, userId]);

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
    prependTake,
  };
};
