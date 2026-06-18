import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CATEGORY_OPTIONS, MY_SKIPS_CATEGORY } from '../constants/categories';
import { getTakesByIds } from '../services/takeService';
import { getUserVotes, getUserVotesPage } from '../services/voteService';
import { Take, TakeVote } from '../types/Take';

const PROFILE_SAMPLE_SIZE = 100;
const CLOSE_CALL_MARGIN = 15;
const CATEGORY_DETAIL_MIN_VOTES = 3;
const VOTING_PROFILE_CACHE_VERSION = 'v1';
const VOTING_PROFILE_CACHE_PREFIX = `voting-profile-cache:${VOTING_PROFILE_CACHE_VERSION}`;

export type TasteLabel =
  | 'Contrarian'
  | 'Room Reader'
  | 'Category Loyalist'
  | 'Chaos Agent'
  | 'Optimist'
  | 'Skeptic'
  | 'Balanced Voter';

export type VotingProfileTone =
  | 'contrarian'
  | 'reader'
  | 'loyalist'
  | 'chaos'
  | 'hot'
  | 'not'
  | 'balanced';

export interface CategoryVotingProfile {
  category: string;
  label: string;
  totalVotes: number;
  hotVotes: number;
  notVotes: number;
  hotPercentage: number;
  crowdAgreementRate: number;
  contraryRate: number;
  closeCallRate: number;
  isHottest: boolean;
  isMostContrarian: boolean;
}

export interface VotingProfile {
  totalVotes: number;
  sampledVotes: number;
  hydratedVotes: number;
  hotVotes: number;
  notVotes: number;
  hotPercentage: number;
  notPercentage: number;
  crowdAgreementRate: number;
  contraryRate: number;
  closeCallRate: number;
  topCategory: CategoryVotingProfile | null;
  contraryCategory: CategoryVotingProfile | null;
  hotCategory: CategoryVotingProfile | null;
  tasteLabel: TasteLabel | null;
  tagline: string | null;
  tone: VotingProfileTone;
  categories: CategoryVotingProfile[];
}

interface UseVotingProfileResult {
  profile: VotingProfile;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
}

const getVotingProfileCacheKey = (userId: string) => `${VOTING_PROFILE_CACHE_PREFIX}:${userId}`;

const readCachedVotingProfile = async (userId: string): Promise<VotingProfile | null> => {
  try {
    const raw = await AsyncStorage.getItem(getVotingProfileCacheKey(userId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return {
      ...emptyProfile,
      ...parsed,
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    };
  } catch (error) {
    console.warn('Unable to read voting profile cache:', error);
    return null;
  }
};

const writeCachedVotingProfile = async (userId: string, profile: VotingProfile) => {
  try {
    await AsyncStorage.setItem(getVotingProfileCacheKey(userId), JSON.stringify(profile));
  } catch (error) {
    console.warn('Unable to write voting profile cache:', error);
  }
};

interface VotingStyleTeaserContext {
  totalVotesAfterVote: number;
  isContrarianMoment: boolean;
  isCloseCall: boolean;
}

interface CategoryAccumulator {
  category: string;
  label: string;
  totalVotes: number;
  hotVotes: number;
  notVotes: number;
  agreements: number;
  contraryVotes: number;
  closeCalls: number;
}

const emptyProfile: VotingProfile = {
  totalVotes: 0,
  sampledVotes: 0,
  hydratedVotes: 0,
  hotVotes: 0,
  notVotes: 0,
  hotPercentage: 0,
  notPercentage: 0,
  crowdAgreementRate: 0,
  contraryRate: 0,
  closeCallRate: 0,
  topCategory: null,
  contraryCategory: null,
  hotCategory: null,
  tasteLabel: null,
  tagline: null,
  tone: 'balanced',
  categories: [],
};

const categoryLabelMap = CATEGORY_OPTIONS.reduce<Record<string, string>>((acc, option) => {
  if (option.value !== 'all' && option.value !== MY_SKIPS_CATEGORY) {
    acc[option.value] = option.label.replace(`${option.emoji} `, '');
  }
  return acc;
}, {});

export const getTasteLabelMeta = (label: TasteLabel | null): {
  tagline: string | null;
  tone: VotingProfileTone;
} => {
  switch (label) {
    case 'Contrarian':
      return {
        tagline: 'You rarely run with the crowd.',
        tone: 'contrarian',
      };
    case 'Room Reader':
      return {
        tagline: "You've got your finger on the pulse.",
        tone: 'reader',
      };
    case 'Category Loyalist':
      return {
        tagline: 'You know what you like.',
        tone: 'loyalist',
      };
    case 'Chaos Agent':
      return {
        tagline: 'You live for the close calls.',
        tone: 'chaos',
      };
    case 'Optimist':
      return {
        tagline: 'You see the HOT side of everything.',
        tone: 'hot',
      };
    case 'Skeptic':
      return {
        tagline: 'Hard to impress. Impossible to fool.',
        tone: 'not',
      };
    case 'Balanced Voter':
      return {
        tagline: 'You call it like you see it.',
        tone: 'balanced',
      };
    default:
      return {
        tagline: null,
        tone: 'balanced',
      };
  }
};

const toTitleCase = (value: string) =>
  value
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getCategoryLabel = (category: string) =>
  categoryLabelMap[category] || toTitleCase(category || 'General');

const getTakeHotPercentage = (take: Take) => {
  if (typeof take.hotPercentage === 'number') {
    return take.hotPercentage;
  }

  if (take.totalVotes <= 0) {
    return 50;
  }

  return Math.round((take.hotVotes / take.totalVotes) * 100);
};

const getPercentage = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

const chooseTasteLabel = ({
  totalVotes,
  hotPercentage,
  notPercentage,
  crowdAgreementRate,
  contraryRate,
  closeCallRate,
  topCategory,
}: {
  totalVotes: number;
  hotPercentage: number;
  notPercentage: number;
  crowdAgreementRate: number;
  contraryRate: number;
  closeCallRate: number;
  topCategory: CategoryVotingProfile | null;
}): TasteLabel | null => {
  if (totalVotes < 25) {
    return null;
  }

  if (contraryRate > 60) {
    return 'Contrarian';
  }

  if (crowdAgreementRate > 75) {
    return 'Room Reader';
  }

  if (topCategory && getPercentage(topCategory.totalVotes, totalVotes) > 50) {
    return 'Category Loyalist';
  }

  if (closeCallRate > 40) {
    return 'Chaos Agent';
  }

  if (hotPercentage > 65) {
    return 'Optimist';
  }

  if (notPercentage > 65) {
    return 'Skeptic';
  }

  return 'Balanced Voter';
};

const normalizeCategoryProfiles = (
  categoryAccumulators: Record<string, CategoryAccumulator>
): CategoryVotingProfile[] => {
  const baseCategories = Object.values(categoryAccumulators)
    .filter(category => category.totalVotes >= CATEGORY_DETAIL_MIN_VOTES)
    .map((category) => ({
      category: category.category,
      label: category.label,
      totalVotes: category.totalVotes,
      hotVotes: category.hotVotes,
      notVotes: category.notVotes,
      hotPercentage: getPercentage(category.hotVotes, category.totalVotes),
      crowdAgreementRate: getPercentage(category.agreements, category.totalVotes),
      contraryRate: getPercentage(category.contraryVotes, category.totalVotes),
      closeCallRate: getPercentage(category.closeCalls, category.totalVotes),
      isHottest: false,
      isMostContrarian: false,
    }))
    .sort((first, second) => second.totalVotes - first.totalVotes);

  const hottestCategory = baseCategories.reduce<CategoryVotingProfile | null>(
    (best, category) => !best || category.hotPercentage > best.hotPercentage ? category : best,
    null
  );
  const mostContrarianCategory = baseCategories.reduce<CategoryVotingProfile | null>(
    (best, category) => !best || category.contraryRate > best.contraryRate ? category : best,
    null
  );

  return baseCategories.map(category => ({
    ...category,
    isHottest: category.category === hottestCategory?.category,
    isMostContrarian: category.category === mostContrarianCategory?.category,
  }));
};

const computeVotingProfile = (
  votes: TakeVote[],
  takesById: Record<string, Take>,
  reportedTotalVotes?: number
): VotingProfile => {
  if (votes.length === 0 && !reportedTotalVotes) {
    return emptyProfile;
  }

  let hotVotes = 0;
  let notVotes = 0;
  let hydratedVotes = 0;
  let agreements = 0;
  let contraryVotes = 0;
  let closeCalls = 0;
  const categoryAccumulators: Record<string, CategoryAccumulator> = {};

  votes.forEach((vote) => {
    if (vote.vote === 'hot') {
      hotVotes += 1;
    } else {
      notVotes += 1;
    }

    const take = takesById[vote.takeId];
    if (!take) {
      return;
    }

    hydratedVotes += 1;
    const hotPercentage = getTakeHotPercentage(take);
    const notPercentage = 100 - hotPercentage;
    const userSidePercentage = vote.vote === 'hot' ? hotPercentage : notPercentage;
    const oppositeSidePercentage = vote.vote === 'hot' ? notPercentage : hotPercentage;
    const agreesWithCrowd = userSidePercentage >= oppositeSidePercentage;
    const isContrary = userSidePercentage < oppositeSidePercentage;
    const isCloseCall = Math.abs(hotPercentage - notPercentage) <= CLOSE_CALL_MARGIN;
    const category = take.category || 'general';

    if (!categoryAccumulators[category]) {
      categoryAccumulators[category] = {
        category,
        label: getCategoryLabel(category),
        totalVotes: 0,
        hotVotes: 0,
        notVotes: 0,
        agreements: 0,
        contraryVotes: 0,
        closeCalls: 0,
      };
    }

    categoryAccumulators[category].totalVotes += 1;
    categoryAccumulators[category].hotVotes += vote.vote === 'hot' ? 1 : 0;
    categoryAccumulators[category].notVotes += vote.vote === 'not' ? 1 : 0;
    categoryAccumulators[category].agreements += agreesWithCrowd ? 1 : 0;
    categoryAccumulators[category].contraryVotes += isContrary ? 1 : 0;
    categoryAccumulators[category].closeCalls += isCloseCall ? 1 : 0;

    agreements += agreesWithCrowd ? 1 : 0;
    contraryVotes += isContrary ? 1 : 0;
    closeCalls += isCloseCall ? 1 : 0;
  });

  const sampledVotes = votes.length;
  const totalVotes = reportedTotalVotes ?? sampledVotes;
  const hotPercentage = getPercentage(hotVotes, sampledVotes);
  const notPercentage = sampledVotes > 0 ? 100 - hotPercentage : 0;
  const crowdAgreementRate = getPercentage(agreements, hydratedVotes);
  const contraryRate = getPercentage(contraryVotes, hydratedVotes);
  const closeCallRate = getPercentage(closeCalls, hydratedVotes);
  const categories = normalizeCategoryProfiles(categoryAccumulators);
  const topCategory = categories[0] || null;
  const hotCategory = categories.find(category => category.isHottest) || null;
  const contraryCategory = categories.find(category => category.isMostContrarian) || null;
  const tasteLabel = chooseTasteLabel({
    totalVotes,
    hotPercentage,
    notPercentage,
    crowdAgreementRate,
    contraryRate,
    closeCallRate,
    topCategory,
  });
  const meta = getTasteLabelMeta(tasteLabel);

  return {
    totalVotes,
    sampledVotes,
    hydratedVotes,
    hotVotes,
    notVotes,
    hotPercentage,
    notPercentage,
    crowdAgreementRate,
    contraryRate,
    closeCallRate,
    topCategory,
    contraryCategory,
    hotCategory,
    tasteLabel,
    tagline: meta.tagline,
    tone: meta.tone,
    categories,
  };
};

export const buildVotingStyleTeaser = (
  profile: VotingProfile,
  context: VotingStyleTeaserContext
): string | null => {
  if (profile.totalVotes < 10) {
    return null;
  }

  const shouldShow =
    context.totalVotesAfterVote % 15 === 0 ||
    context.isContrarianMoment ||
    context.isCloseCall;

  if (!shouldShow) {
    return null;
  }

  const candidates = [
    profile.tasteLabel ? `You're becoming a ${profile.tasteLabel}.` : null,
    profile.contraryCategory ? `${profile.contraryCategory.label} is where you break from the crowd.` : null,
    profile.topCategory ? `${profile.topCategory.label} is showing up in your voting style.` : null,
    profile.crowdAgreementRate > 0 ? `You agree with the room ${profile.crowdAgreementRate}% of the time.` : null,
    context.isCloseCall ? 'Close calls are becoming your thing.' : null,
  ].filter((line): line is string => Boolean(line));

  if (candidates.length === 0) {
    return 'Your voting style is taking shape.';
  }

  return candidates[context.totalVotesAfterVote % candidates.length];
};

export const useVotingProfile = (
  userId?: string | null,
  reportedTotalVotes?: number,
  enabled = true
): UseVotingProfileResult => {
  const [votes, setVotes] = useState<TakeVote[]>([]);
  const [takesById, setTakesById] = useState<Record<string, Take>>({});
  const [cachedProfile, setCachedProfile] = useState<VotingProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setVotes([]);
      setTakesById({});
      setCachedProfile(null);
      setLoading(false);
      setHasLoadedOnce(false);
      return;
    }

    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const cached = await readCachedVotingProfile(userId);
      if (cached) {
        setCachedProfile(cached);
      }

      let recentVotes: TakeVote[];
      try {
        const page = await getUserVotesPage(userId, PROFILE_SAMPLE_SIZE);
        recentVotes = page.votes;
      } catch (pageError) {
        console.warn('Paged profile votes unavailable, falling back to all votes:', pageError);
        const allVotes = await getUserVotes(userId);
        recentVotes = allVotes
          .sort((first, second) => second.votedAt.getTime() - first.votedAt.getTime())
          .slice(0, PROFILE_SAMPLE_SIZE);
      }

      const hydratedTakes = await getTakesByIds(recentVotes.map(vote => vote.takeId));
      setVotes(recentVotes);
      setTakesById(hydratedTakes);
    } catch (profileError) {
      console.error('Error loading voting profile:', profileError);
      setError('Your voting style is unavailable right now.');
    } finally {
      setHasLoadedOnce(true);
      setLoading(false);
    }
  }, [enabled, userId]);

  useEffect(() => {
    setVotes([]);
    setTakesById({});
    setCachedProfile(null);
    setHasLoadedOnce(false);
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile, reportedTotalVotes]);

  const profile = useMemo(
    () => computeVotingProfile(votes, takesById, reportedTotalVotes),
    [reportedTotalVotes, takesById, votes]
  );

  useEffect(() => {
    if (!userId || profile.sampledVotes === 0) {
      return;
    }

    setCachedProfile(profile);
    writeCachedVotingProfile(userId, profile);
  }, [profile, userId]);

  const displayedProfile = profile.sampledVotes > 0 ? profile : cachedProfile || profile;

  const effectiveLoading = loading || Boolean(enabled && userId && !hasLoadedOnce && !cachedProfile);

  return {
    profile: displayedProfile,
    loading: effectiveLoading,
    error,
    refreshProfile: loadProfile,
  };
};
