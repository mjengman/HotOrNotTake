import { useState, useEffect, useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Take, TakeSubmission } from '../types/Take';
import {
  submitTake,
  requestGeneratedTakes,
  getUserVotedAndSkippedTakeIds,
  getUserSkippedTakes,
  getStarterDeckTakes,
  skipTake,
  fetchMoreTakesFilled,
  resetFeedCursor,
} from '../services/takeService';
import {
  getUserVoteForTake,
} from '../services/voteService';
import { 
  incrementUserSubmissionCount,
  getUserStats,
} from '../services/userService';
import { enqueueVoteWrite, getQueuedVoteTakeIds } from '../services/voteOutboxService';
import { useAuth } from './useAuth';
import { StreakUpdateResult } from '../types/User';
import { MY_SKIPS_CATEGORY, isMySkipsCategory } from '../constants';
import { orderTakesByCommunityWeight } from '../utils/feedOrdering';

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
  loadMore: (
    count?: number,
    force?: boolean,
    background?: boolean,
    freezePrefixCount?: number | 'all'
  ) => Promise<void>;
  hasMore: boolean;
  prependTake: (take: Take) => void;
  removeTakeLocally: (takeId: string) => void;
}

interface UseFirebaseTakesOptions {
  category?: string;
}

const FEED_CACHE_VERSION = 'v1';
const FEED_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FEED_CACHE_BATCH_SIZE = 30;
const LIVE_FEED_RECONCILE_DELAY_MS = 2500;
const LOCAL_ID_HYDRATION_SKELETON_MS = 150;
const RECENT_TEXT_GUARD_SIZE = 10;
const RECENT_TEXT_SIMILARITY_THRESHOLD = 0.7;
const VISIBLE_DECK_STABILITY_COUNT = 2;
const STARTER_DECK_PRIORITY_TOTAL_VOTE_LIMIT = 50;
const FEED_CACHE_PREFIX = `feed-cache:${FEED_CACHE_VERSION}`;
const LOCAL_VOTED_PREFIX = `local-voted:${FEED_CACHE_VERSION}`;
const LOCAL_SKIPPED_PREFIX = `local-skipped:${FEED_CACHE_VERSION}`;

type CachedTake = Omit<
  Take,
  | 'createdAt'
  | 'submittedAt'
  | 'approvedAt'
  | 'rejectedAt'
  | 'deprioritizedAt'
  | 'deprioritizedUntil'
  | 'curatedAt'
> & {
  createdAt: string;
  submittedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  deprioritizedAt?: string;
  deprioritizedUntil?: string;
  curatedAt?: string;
};

interface FeedCacheRecord {
  savedAt: number;
  takes: CachedTake[];
}

const getCategoryCacheSlug = (category: string) => (category || 'all').toLowerCase();

const getFeedCacheKey = (userId: string, category: string) =>
  `${FEED_CACHE_PREFIX}:${userId}:${getCategoryCacheSlug(category)}`;

const getLocalVotedKey = (userId: string) => `${LOCAL_VOTED_PREFIX}:${userId}`;
const getLocalSkippedKey = (userId: string) => `${LOCAL_SKIPPED_PREFIX}:${userId}`;

const getTakeTextFingerprint = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getCharTrigrams = (normalizedText: string): Set<string> => {
  if (normalizedText.length <= 3) {
    return normalizedText ? new Set([normalizedText]) : new Set();
  }

  const trigrams = new Set<string>();
  for (let index = 0; index <= normalizedText.length - 3; index += 1) {
    trigrams.add(normalizedText.slice(index, index + 3));
  }

  return trigrams;
};

const getJaccardSimilarity = <T>(first: Set<T>, second: Set<T>): number => {
  if (first.size === 0 && second.size === 0) {
    return 1;
  }

  let intersection = 0;
  first.forEach((value) => {
    if (second.has(value)) {
      intersection += 1;
    }
  });

  return intersection / (first.size + second.size - intersection);
};

const getRecentTextSimilarity = (firstText: string, secondText: string): number => {
  const first = getTakeTextFingerprint(firstText);
  const second = getTakeTextFingerprint(secondText);

  if (!first || !second) {
    return 0;
  }

  if (first === second) {
    return 1;
  }

  return getJaccardSimilarity(getCharTrigrams(first), getCharTrigrams(second));
};

const hasSimilarRecentText = (take: Take, recentTexts: string[]): boolean =>
  recentTexts.some(
    recentText => getRecentTextSimilarity(take.text, recentText) >= RECENT_TEXT_SIMILARITY_THRESHOLD
  );

const appendRecentText = (recentTexts: string[], take: Take): string[] => {
  const fingerprint = getTakeTextFingerprint(take.text);
  if (!fingerprint) {
    return recentTexts;
  }

  return [...recentTexts, fingerprint].slice(-RECENT_TEXT_GUARD_SIZE);
};

const isActiveDeprioritizedTake = (take: Take, now: number = Date.now()): boolean =>
  take.deprioritized === true &&
  (!take.deprioritizedUntil || take.deprioritizedUntil.getTime() >= now);

const isStarterDeckTake = (take: Take): boolean => take.editorialTier === 'starter';

const getStarterDeckRank = (take: Take): number =>
  typeof take.starterDeckRank === 'number'
    ? take.starterDeckRank
    : Number.POSITIVE_INFINITY;

const orderStarterDeckTakes = (takes: Take[]): Take[] =>
  [...takes].sort((first, second) => {
    const rankDelta = getStarterDeckRank(first) - getStarterDeckRank(second);
    return rankDelta || first.id.localeCompare(second.id);
  });

const shouldPrioritizeStarterDeck = (totalVotes: number): boolean =>
  totalVotes < STARTER_DECK_PRIORITY_TOTAL_VOTE_LIMIT;

const cacheCanLeadStarterDeck = (
  cachedTakes: Take[],
  prioritizeStarterDeck: boolean
): boolean =>
  !prioritizeStarterDeck || cachedTakes.some(isStarterDeckTake);

const filterUniqueTakes = (
  takes: Take[],
  options: {
    excludedIds?: Set<string>;
    excludedTextFingerprints?: Set<string>;
  } = {}
): Take[] => {
  const seenIds = new Set(options.excludedIds ?? []);
  const seenTextFingerprints = new Set(options.excludedTextFingerprints ?? []);
  const uniqueTakes: Take[] = [];

  takes.forEach((take) => {
    const textFingerprint = getTakeTextFingerprint(take.text);
    if (
      seenIds.has(take.id) ||
      (textFingerprint && seenTextFingerprints.has(textFingerprint))
    ) {
      return;
    }

    seenIds.add(take.id);
    if (textFingerprint) {
      seenTextFingerprints.add(textFingerprint);
    }
    uniqueTakes.push(take);
  });

  return uniqueTakes;
};

const serializeTake = (take: Take): CachedTake => ({
  ...take,
  createdAt: take.createdAt.toISOString(),
  submittedAt: take.submittedAt.toISOString(),
  approvedAt: take.approvedAt?.toISOString(),
  rejectedAt: take.rejectedAt?.toISOString(),
  deprioritizedAt: take.deprioritizedAt?.toISOString(),
  deprioritizedUntil: take.deprioritizedUntil?.toISOString(),
  curatedAt: take.curatedAt?.toISOString(),
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
  deprioritizedAt: parseDate(take.deprioritizedAt),
  deprioritizedUntil: parseDate(take.deprioritizedUntil),
  curatedAt: parseDate(take.curatedAt),
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

const readLocalSkippedIds = async (userId: string): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(getLocalSkippedKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch (error) {
    console.warn('Unable to read local skipped IDs:', error);
    return [];
  }
};

const writeLocalSkippedIds = async (userId: string, skippedIds: string[]) => {
  try {
    await AsyncStorage.setItem(
      getLocalSkippedKey(userId),
      JSON.stringify(Array.from(new Set(skippedIds)))
    );
  } catch (error) {
    console.warn('Unable to write local skipped IDs:', error);
  }
};

const addLocalVotedId = async (userId: string, takeId: string) => {
  const votedIds = await readLocalVotedIds(userId);
  if (!votedIds.includes(takeId)) {
    await writeLocalVotedIds(userId, [...votedIds, takeId]);
  }
};

const addLocalSkippedId = async (userId: string, takeId: string) => {
  const skippedIds = await readLocalSkippedIds(userId);
  if (!skippedIds.includes(takeId)) {
    await writeLocalSkippedIds(userId, [...skippedIds, takeId]);
  }
};

const removeLocalSkippedId = async (userId: string, takeId: string) => {
  const skippedIds = await readLocalSkippedIds(userId);
  await writeLocalSkippedIds(userId, skippedIds.filter(id => id !== takeId));
};

const removeLocalVotedId = async (userId: string, takeId: string) => {
  const votedIds = await readLocalVotedIds(userId);
  await writeLocalVotedIds(userId, votedIds.filter(id => id !== takeId));
};

const prependTakeToFeedCache = async (
  userId: string,
  category: string,
  take: Take
) => {
  const cachedTakes = await readFeedCache(userId, category, new Set());
  const nextTakes = [
    take,
    ...cachedTakes.filter(cachedTake => cachedTake.id !== take.id),
  ];
  await writeFeedCache(userId, category, nextTakes);
};

const removeTakeFromFeedCache = async (
  userId: string,
  category: string,
  takeId: string
) => {
  const cachedTakes = await readFeedCache(userId, category, new Set());
  await writeFeedCache(
    userId,
    category,
    cachedTakes.filter(take => take.id !== takeId)
  );
};

const readFeedCache = async (
  userId: string,
  category: string,
  hiddenIds: Set<string>
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
        !hiddenIds.has(take.id) &&
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
  const viewingMySkips = isMySkipsCategory(category);
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
  const sessionHiddenTakeIdsRef = useRef<Set<string>>(new Set());
  const sessionHiddenFromMySkipsRef = useRef<Set<string>>(new Set());
  const sessionRecentTextFingerprintsRef = useRef<string[]>([]);
  const userTotalVotesRef = useRef(0);
  const starterDeckPriorityEnabledRef = useRef(false);

  useEffect(() => {
    sessionHiddenTakeIdsRef.current.clear();
    sessionHiddenFromMySkipsRef.current.clear();
    sessionRecentTextFingerprintsRef.current = [];
  }, [userId]);

  const rememberSeenTakeText = useCallback((take?: Take) => {
    if (!take) {
      return;
    }

    const textFingerprint = getTakeTextFingerprint(take.text);
    if (textFingerprint) {
      sessionRecentTextFingerprintsRef.current = appendRecentText(
        sessionRecentTextFingerprintsRef.current,
        take
      );
    }
  }, []);

  const orderFeedForFreshness = useCallback((
    takesArray: Take[],
    freezePrefixCount: number = 0,
    options: { prioritizeStarterDeck?: boolean } = {}
  ): Take[] => {
    const prefix = takesArray.slice(0, freezePrefixCount);
    const tail = takesArray.slice(freezePrefixCount);
    if (tail.length <= 1) return takesArray;

    const now = Date.now();
    const weightedTail = orderTakesByCommunityWeight(tail, 'soft');
    const normalTail = weightedTail.filter(take => !isActiveDeprioritizedTake(take, now));
    const lastResortTail = weightedTail.filter(take => isActiveDeprioritizedTake(take, now));
    const starterTail = options.prioritizeStarterDeck
      ? orderStarterDeckTakes(normalTail.filter(isStarterDeckTake))
      : [];
    const standardTail = options.prioritizeStarterDeck
      ? normalTail.filter(take => !isStarterDeckTake(take))
      : normalTail;
    const result: Take[] = [...prefix];
    let recentTexts = sessionRecentTextFingerprintsRef.current.slice(-RECENT_TEXT_GUARD_SIZE);
    let lastCategory: string | null = prefix.length ? prefix[prefix.length - 1]?.category ?? null : null;

    prefix.forEach((take) => {
      recentTexts = appendRecentText(recentTexts, take);
    });

    const appendBucket = (bucket: Take[]) => {
      const availableTakes = [...bucket];

      while (availableTakes.length > 0) {
        const canAvoidCategoryRepeat =
          category === 'all' &&
          Boolean(lastCategory) &&
          availableTakes.some(take => take.category !== lastCategory);

        let nextTakeIndex = availableTakes.findIndex(take => {
          const categoryOk = !canAvoidCategoryRepeat || take.category !== lastCategory;
          return categoryOk && !hasSimilarRecentText(take, recentTexts);
        });

        if (nextTakeIndex === -1 && canAvoidCategoryRepeat) {
          nextTakeIndex = availableTakes.findIndex(take => take.category !== lastCategory);
        }

        if (nextTakeIndex === -1) {
          nextTakeIndex = availableTakes.findIndex(take => !hasSimilarRecentText(take, recentTexts));
        }

        if (nextTakeIndex === -1) {
          nextTakeIndex = 0;
        }

        const nextTake = availableTakes[nextTakeIndex];
        availableTakes.splice(nextTakeIndex, 1);
        result.push(nextTake);
        lastCategory = nextTake.category;
        recentTexts = appendRecentText(recentTexts, nextTake);
      }
    };

    appendBucket(starterTail);
    appendBucket(standardTail);
    appendBucket(lastResortTail);

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
        const hydrationTimer = setTimeout(() => {
          if (isCurrentRequest()) {
            setFeed([]);
            setLoading(true);
          }
        }, LOCAL_ID_HYDRATION_SKELETON_MS);

        const [localVotedIds, localSkippedIds, queuedVoteIds, userStats] = await Promise.all([
          readLocalVotedIds(userId),
          readLocalSkippedIds(userId),
          getQueuedVoteTakeIds(userId),
          getUserStats(userId),
        ]);
        clearTimeout(hydrationTimer);

        if (!isCurrentRequest()) {
          return;
        }

        userTotalVotesRef.current = userStats.totalVotes;
        starterDeckPriorityEnabledRef.current = shouldPrioritizeStarterDeck(userStats.totalVotes);
        const prioritizeStarterDeck = starterDeckPriorityEnabledRef.current;

        const localHiddenSet = new Set([
          ...localVotedIds,
          ...queuedVoteIds,
          ...(viewingMySkips ? [] : localSkippedIds),
          ...(viewingMySkips
            ? sessionHiddenFromMySkipsRef.current
            : sessionHiddenTakeIdsRef.current),
        ]);
        const cachedTakes = filterUniqueTakes(
          await readFeedCache(userId, category, localHiddenSet),
          { excludedIds: localHiddenSet }
        );

        if (!isCurrentRequest()) {
          return;
        }

        if (cachedTakes.length > 0 && cacheCanLeadStarterDeck(cachedTakes, prioritizeStarterDeck)) {
          const orderedCached = orderFeedForFreshness(cachedTakes, 0, { prioritizeStarterDeck });

          setFeed(orderedCached);
          setInteractedTakeIds(Array.from(localHiddenSet));
          setHasMore(true);
          setLoading(false);
          renderedCache = true;
        } else {
          setFeed([]);
        }

        if (renderedCache) {
          await new Promise(resolve => setTimeout(resolve, LIVE_FEED_RECONCILE_DELAY_MS));
          if (!isCurrentRequest()) {
            return;
          }
        }

        const { voted, skipped } = await getUserVotedAndSkippedTakeIds(userId);
        if (!isCurrentRequest()) {
          return;
        }
        writeLocalVotedIds(userId, voted).catch(console.warn);
        writeLocalSkippedIds(userId, skipped).catch(console.warn);

        if (viewingMySkips) {
          const skippedTakes = filterUniqueTakes(
            await getUserSkippedTakes(userId),
            {
              excludedIds: new Set([...voted, ...queuedVoteIds, ...sessionHiddenFromMySkipsRef.current]),
            }
          );

          if (!isCurrentRequest()) {
            return;
          }

          setInteractedTakeIds(Array.from(new Set([...voted, ...queuedVoteIds])));
          setFeed(prev => {
            const mergedSkippedTakes = filterUniqueTakes(
              [...prev, ...skippedTakes],
              {
                excludedIds: new Set([...voted, ...queuedVoteIds, ...sessionHiddenFromMySkipsRef.current]),
              }
            );
            writeFeedCache(userId, category, mergedSkippedTakes).catch(console.warn);
            return mergedSkippedTakes;
          });
          setHasMore(false);
          return;
        }

        const freshInteractedIds = new Set([
          ...voted,
          ...skipped,
          ...queuedVoteIds,
          ...sessionHiddenTakeIdsRef.current,
        ]);
        setInteractedTakeIds(Array.from(freshInteractedIds));

        const [{ items, gotAny }, starterTakes] = await Promise.all([
          fetchMoreTakesFilled({
            category,
            targetCount: 30,
            pageSize: 50,
            interactedIds: freshInteractedIds,
          }),
          prioritizeStarterDeck
            ? getStarterDeckTakes({ category, interactedIds: freshInteractedIds })
            : Promise.resolve([]),
        ]);
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
        const orderedItems = filterUniqueTakes([...starterTakes, ...doubleFiltered], {
          excludedIds: freshInteractedIds,
        });
        const ordered = orderFeedForFreshness(orderedItems, 0, { prioritizeStarterDeck });
        setFeed(prev => {
          const merged = renderedCache
            ? mergeLiveFeedWithVisibleDeck(prev, ordered, freshInteractedIds)
            : ordered;
          const uniqueMerged = filterUniqueTakes(merged, {
            excludedIds: freshInteractedIds,
          });
          const finalFeed = orderFeedForFreshness(
            uniqueMerged,
            renderedCache ? prev.length : 0,
            { prioritizeStarterDeck }
          );
          writeFeedCache(userId, category, finalFeed).catch(console.warn);
          return finalFeed;
        });
        setHasMore(gotAny && ordered.length > 0);
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
  }, [authLoading, category, userId, orderFeedForFreshness, viewingMySkips]);

  // Load more takes function
  const loadMore = useCallback(async (
    count: number = 20,
    force: boolean = false,
    background: boolean = false,
    freezePrefixCount: number | 'all' = 'all'
  ) => {
    if (viewingMySkips) {
      setHasMore(false);
      return;
    }

    if (!userId || (!force && !hasMore) || loading) return;

    try {
      if (!background) {
        setLoading(true);
      }
      const interacted = new Set([
        ...interactedTakeIds,
        ...sessionHiddenTakeIdsRef.current,
      ]);
      const excludedTextFingerprints = new Set<string>();
      
      // Also exclude what's already in feed to avoid duplicates
      for (const take of feed) {
        interacted.add(take.id);
        const textFingerprint = getTakeTextFingerprint(take.text);
        if (textFingerprint) {
          excludedTextFingerprints.add(textFingerprint);
        }
      }

      const prioritizeStarterDeck = starterDeckPriorityEnabledRef.current;
      const [{ items, gotAny }, starterTakes] = await Promise.all([
        fetchMoreTakesFilled({
          category,
          targetCount: count,
          pageSize: 50,
          interactedIds: interacted,
        }),
        prioritizeStarterDeck
          ? getStarterDeckTakes({ category, interactedIds: interacted })
          : Promise.resolve([]),
      ]);

      // Double-check filtering: ensure no interacted takes made it through
      const doubleFiltered = [...starterTakes, ...items].filter(take => {
        const isInteracted = interacted.has(take.id);
        if (isInteracted) {
          console.warn(`⚠️ LoadMore: Filtering out already-interacted take that slipped through: ${take.id}`);
        }
        return !isInteracted;
      });
      const uniqueFreshTakes = filterUniqueTakes(doubleFiltered, {
        excludedIds: interacted,
        excludedTextFingerprints,
      });

      setFeed(prev => {
        const combined = filterUniqueTakes([...prev, ...uniqueFreshTakes], {
          excludedIds: sessionHiddenTakeIdsRef.current,
        });
        const stablePrefixCount =
          freezePrefixCount === 'all'
            ? prev.length
            : Math.min(prev.length, Math.max(0, freezePrefixCount));
        if (category !== 'all') {
          const ordered = orderFeedForFreshness(combined, stablePrefixCount, {
            prioritizeStarterDeck,
          });
          writeFeedCache(userId, category, ordered).catch(console.warn);
          return ordered;
        }
        // Keep visible cards stable; generation refreshes can reorder the tail behind them.
        const ordered = orderFeedForFreshness(combined, stablePrefixCount, {
          prioritizeStarterDeck,
        });
        writeFeedCache(userId, category, ordered).catch(console.warn);
        return ordered;
      });
      setHasMore(gotAny && uniqueFreshTakes.length > 0);
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
  }, [category, feed, hasMore, loading, interactedTakeIds, orderFeedForFreshness, userId, viewingMySkips]);

  // Return feed directly - variety is applied once during load, not on every render
  const takes = feed;
  const normalTakeCount = takes.filter(take => !isActiveDeprioritizedTake(take)).length;

  useEffect(() => {
    if (!userId || loading || viewingMySkips) {
      return;
    }

    const generationKey = `${userId}:${category}`;
    if (normalTakeCount > 3) {
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
          loadMore(20, true, true, VISIBLE_DECK_STABILITY_COUNT).catch((err) => {
          });
        }
      })
      .catch((err) => {
      })
      .finally(() => {
        generationInFlightRef.current = false;
      });
  }, [category, loadMore, loading, normalTakeCount, userId, viewingMySkips]);

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
      const votedTake = feed.find(take => take.id === takeId);
      sessionHiddenTakeIdsRef.current.add(takeId);
      sessionHiddenFromMySkipsRef.current.add(takeId);
      rememberSeenTakeText(votedTake);

      // Optimistically update interacted IDs and remove from feed
      setInteractedTakeIds(prev => Array.from(new Set([...prev, takeId])));
      setFeed(prev => {
        const newFeed = prev.filter(take => take.id !== takeId);
        writeFeedCache(userId, category, newFeed).catch(console.warn);
        return newFeed;
      });
      
      const hotVotesAfter = votedTake
        ? votedTake.hotVotes + (vote === 'hot' ? 1 : 0)
        : undefined;
      const notVotesAfter = votedTake
        ? votedTake.notVotes + (vote === 'not' ? 1 : 0)
        : undefined;
      const totalVotesAfter =
        hotVotesAfter !== undefined && notVotesAfter !== undefined
          ? hotVotesAfter + notVotesAfter
          : undefined;

      await enqueueVoteWrite({
        takeId,
        userId,
        vote,
        category: votedTake?.category,
        countDailyEngagement: options.countDailyEngagement !== false,
        voteContext: {
          category: votedTake?.category,
          totalVotesBefore: votedTake?.totalVotes,
          hotVotesAfter,
          notVotesAfter,
          totalVotesAfter,
        },
      });
      await addLocalVotedId(userId, takeId);
      await removeLocalSkippedId(userId, takeId);
      await removeTakeFromFeedCache(userId, MY_SKIPS_CATEGORY, takeId);
      if (options.countDailyEngagement !== false) {
        userTotalVotesRef.current += 1;
        starterDeckPriorityEnabledRef.current = shouldPrioritizeStarterDeck(userTotalVotesRef.current);
      }
      
      // Auto-load more if getting low
      if (!viewingMySkips && feed.length < 10 && hasMore) {
        setTimeout(() => {
          InteractionManager.runAfterInteractions(() => {
            loadMore(20).catch(console.error);
          });
        }, 800);
      }
      
      return null;
    } catch (err) {
      // Rollback on error
      setInteractedTakeIds(prev => prev.filter(id => id !== takeId));
      sessionHiddenTakeIdsRef.current.delete(takeId);
      sessionHiddenFromMySkipsRef.current.delete(takeId);
      console.error('Vote error, but handled gracefully:', err);
      // Don't throw - just log to prevent crashes
      return null;
    } finally {
      // Always clear in-flight flag
      inFlightVotesRef.current.delete(takeId);
    }
  }, [userId, category, feed, hasMore, loadMore, interactedTakeIds, rememberSeenTakeText, viewingMySkips]);

  // Skip a take
  const handleSkipTake = useCallback(async (takeId: string): Promise<void> => {
    if (!userId) {
      throw new Error('User must be signed in to skip takes');
    }

    try {
      const skippedTake = feed.find(take => take.id === takeId);
      if (viewingMySkips) {
        sessionHiddenFromMySkipsRef.current.add(takeId);
      } else {
        sessionHiddenTakeIdsRef.current.add(takeId);
      }
      rememberSeenTakeText(skippedTake);

      setInteractedTakeIds(prev => Array.from(new Set([...prev, takeId])));

      // Remove from this deck immediately; normal feeds treat skips as hidden,
      // while My Skips lets users intentionally revisit them later.
      setFeed(prev => {
        const newFeed = prev.filter(take => take.id !== takeId);
        writeFeedCache(userId, category, newFeed).catch(console.warn);
        return newFeed;
      });
      
      if (!viewingMySkips) {
        await addLocalSkippedId(userId, takeId);
        if (skippedTake) {
          await prependTakeToFeedCache(userId, MY_SKIPS_CATEGORY, skippedTake);
        }
        // Record the skip in Firebase
        await skipTake(takeId, userId);
      }
      
      // Auto-load more if getting low
      if (!viewingMySkips && feed.length < 10 && hasMore) {
        setTimeout(() => {
          InteractionManager.runAfterInteractions(() => {
            loadMore(20).catch(console.error);
          });
        }, 800);
      }
      
    } catch (err) {
      sessionHiddenTakeIdsRef.current.delete(takeId);
      sessionHiddenFromMySkipsRef.current.delete(takeId);
      setInteractedTakeIds(prev => prev.filter(id => id !== takeId));
      console.error('❌ Skip failed in hook:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to skip take');
    }
  }, [userId, category, feed, hasMore, loadMore, rememberSeenTakeText, viewingMySkips]);

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

  const removeTakeLocally = useCallback((takeId: string) => {
    sessionHiddenTakeIdsRef.current.add(takeId);
    sessionHiddenFromMySkipsRef.current.add(takeId);

    setFeed(prev => {
      const removedTake = prev.find(take => take.id === takeId);
      rememberSeenTakeText(removedTake);

      const nextFeed = prev.filter(take => take.id !== takeId);
      if (userId) {
        writeFeedCache(userId, category, nextFeed).catch(console.warn);
        if (category !== 'all') {
          removeTakeFromFeedCache(userId, 'all', takeId).catch(console.warn);
        }
        removeTakeFromFeedCache(userId, MY_SKIPS_CATEGORY, takeId).catch(console.warn);
      }
      return nextFeed;
    });
  }, [category, rememberSeenTakeText, userId]);

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
      setHasMore(!viewingMySkips);
      resetFeedCursor(category);

      const [{ voted, skipped }, queuedVoteIds, userStats] = await Promise.all([
        getUserVotedAndSkippedTakeIds(userId),
        getQueuedVoteTakeIds(userId),
        getUserStats(userId),
      ]);
      writeLocalVotedIds(userId, voted).catch(console.warn);
      writeLocalSkippedIds(userId, skipped).catch(console.warn);
      userTotalVotesRef.current = userStats.totalVotes;
      starterDeckPriorityEnabledRef.current = shouldPrioritizeStarterDeck(userStats.totalVotes);
      const prioritizeStarterDeck = starterDeckPriorityEnabledRef.current;

      if (viewingMySkips) {
        const skippedTakes = filterUniqueTakes(
          await getUserSkippedTakes(userId),
          {
            excludedIds: new Set([...voted, ...queuedVoteIds, ...sessionHiddenFromMySkipsRef.current]),
          }
        );

        setInteractedTakeIds(Array.from(new Set([...voted, ...queuedVoteIds])));
        setFeed(prev => {
          const mergedSkippedTakes = filterUniqueTakes(
            [...prev, ...skippedTakes],
            {
              excludedIds: new Set([...voted, ...queuedVoteIds, ...sessionHiddenFromMySkipsRef.current]),
            }
          );
          writeFeedCache(userId, category, mergedSkippedTakes).catch(console.warn);
          return mergedSkippedTakes;
        });
        setHasMore(false);
        return;
      }

      const freshInteractedIds = new Set([
        ...voted,
        ...skipped,
        ...queuedVoteIds,
        ...sessionHiddenTakeIdsRef.current,
      ]);
      setInteractedTakeIds(Array.from(freshInteractedIds));
      
      // Load fresh content
      const [{ items, gotAny }, starterTakes] = await Promise.all([
        fetchMoreTakesFilled({
          category,
          targetCount: 30,
          pageSize: 50,
          interactedIds: freshInteractedIds,
        }),
        prioritizeStarterDeck
          ? getStarterDeckTakes({ category, interactedIds: freshInteractedIds })
          : Promise.resolve([]),
      ]);
      
      // Apply variety once to the fresh list
      const uniqueItems = filterUniqueTakes([...starterTakes, ...items], {
        excludedIds: freshInteractedIds,
      });
      const ordered = orderFeedForFreshness(uniqueItems, 0, { prioritizeStarterDeck });
      setFeed(ordered);
      writeFeedCache(userId, category, ordered).catch(console.warn);
      setHasMore(gotAny && ordered.length > 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh takes');
    } finally {
      setLoading(false);
    }
  }, [category, orderFeedForFreshness, userId, viewingMySkips]);

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
    removeTakeLocally,
  };
};
