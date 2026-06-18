import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Text,
  Image,
  BackHandler,
  Animated,
  Platform,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomSwipeableCardDeck } from '../components/CustomSwipeableCardDeck';
import { OnboardingCard } from '../components/OnboardingCard';
import { CategoryDropdown } from '../components/CategoryDropdown';
import { AdBanner } from '../components/AdBanner';
import { AdConsentModal } from '../components/AdConsentModal';
import { LoadingSkeleton } from '../components/loading/LoadingSkeleton';
import { AnimatedPressable } from '../components/transitions/AnimatedPressable';
import { FullScreenOverlay } from '../components/overlays/FullScreenOverlay';
import { InstructionsModal } from '../components/InstructionsModal';
import { BurgerMenu } from '../components/BurgerMenu';
import { SubmitTakeScreen } from './SubmitTakeScreen';
import { MyTakesScreen } from './MyTakesScreen';
import { LeaderboardScreen } from './LeaderboardScreen';
import { RecentVotesScreen } from './RecentVotesScreen';
import { MyFavoritesScreen } from './MyFavoritesScreen';
import { SafetyStandardsScreen } from './SafetyStandardsScreen';
import { VotingStyleScreen } from './VotingStyleScreen';
import {
  buildVotingStyleTeaser,
  useAuth,
  useFirebaseTakes,
  useUserStats,
  useVotingProfile,
} from '../hooks';
import { useResponsive } from '../hooks/useResponsive';
import { deleteVote, getUserVoteForTake } from '../services/voteService';
import { adminRemoveTake } from '../services/takeService';
import { getCommunityStats } from '../services/userService';
import { prefetchLeaderboardCache } from '../services/leaderboardCacheService';
import { useInterstitialAds } from '../hooks/useInterstitialAds';
import { colors, motion } from '../constants';
import { StreakUpdateResult, Take } from '../types';
import RNShare from 'react-native-share';

const THEME_PREFERENCE_KEY = 'themePreference';
const RESULTS_AUTOPLAY_PREFERENCE_KEY = 'resultsAutoplayPreference';
const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';
const LEGACY_FIRST_LAUNCH_KEY = 'hasLaunchedBefore';
const FIRST_VOTE_HINT_SHOWN_KEY = 'first_vote_hint_shown';
const DAILY_CHALLENGE_NUDGE_PREFIX = 'dailyChallengeNudgeShown';
const COMMUNITY_STATS_CACHE_KEY = 'community-stats-cache:v1';
type EngagementToast = { title: string; subtitle: string };
type IdentityTeaser = { takeId: string; text: string };
type SessionVoteHistoryEntry = { take: Take; vote: 'hot' | 'not' };

const SESSION_VOTE_HISTORY_LIMIT = 10;
const POST_RESULT_SYNC_DELAY_MS = 120;

const formatCompactCount = (count: number) => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }

  if (count >= 10000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }

  return count.toLocaleString();
};

const getChallengeProgressCopy = (challenge: {
  title?: string;
  description?: string;
  goal: number;
  progress: number;
  completed: boolean;
}) => {
  const remaining = Math.max(0, challenge.goal - challenge.progress);
  const progressCopy = `${challenge.progress}/${challenge.goal} complete`;

  if (challenge.completed) {
    return {
      title: '🎯 Quest complete',
      subtitle: `${challenge.title || "Today's quest"} is done. Come back tomorrow for a fresh goal.`,
    };
  }

  return {
    title: `🎯 ${challenge.title || "Today's quest"}`,
    subtitle: `${challenge.description || 'Vote today to complete it.'} ${remaining} to go. ${progressCopy}.`,
  };
};

const getVoteMomentContext = (take: Take, vote: 'hot' | 'not') => {
  const hotPercentage = take.totalVotes > 0
    ? Math.round((take.hotVotes / take.totalVotes) * 100)
    : 50;
  const notPercentage = 100 - hotPercentage;
  const userAgreementPercentage = vote === 'hot' ? hotPercentage : notPercentage;

  return {
    isContrarianMoment: userAgreementPercentage <= 30,
    isCloseCall: Math.abs(hotPercentage - notPercentage) <= 15,
  };
};

export const HomeScreen: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [resultsAutoplay, setResultsAutoplay] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showMyTakesModal, setShowMyTakesModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showRecentVotesModal, setShowRecentVotesModal] = useState(false);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [showVotingStyleModal, setShowVotingStyleModal] = useState(false);
  const [selectedTakeForStats, setSelectedTakeForStats] = useState<{take: Take, vote: 'hot' | 'not' | null} | null>(null);
  const [sessionVoteHistory, setSessionVoteHistory] = useState<SessionVoteHistoryEntry[]>([]);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboardingCard, setShowOnboardingCard] = useState(false);
  const [firstVoteHintTakeId, setFirstVoteHintTakeId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [myTakesRefreshTrigger, setMyTakesRefreshTrigger] = useState<number>(0);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [communityTotalVotes, setCommunityTotalVotes] = useState<number>(0);
  const [streakToast, setStreakToast] = useState<EngagementToast | null>(null);
  const [identityTeaser, setIdentityTeaser] = useState<IdentityTeaser | null>(null);
  const [skipRequestToken, setSkipRequestToken] = useState(0);
  const [adminRemovalTake, setAdminRemovalTake] = useState<Take | null>(null);
  const [adminRemovalPin, setAdminRemovalPin] = useState('');
  const [adminRemovalError, setAdminRemovalError] = useState<string | null>(null);
  const [adminRemovalLoading, setAdminRemovalLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const streakToastAnim = useRef(new Animated.Value(0)).current;
  const toastQueueRef = useRef<EngagementToast[]>([]);
  const toastAnimatingRef = useRef(false);
  const changeVoteTakeIdsRef = useRef<Set<string>>(new Set());
  const changeVoteDeletePromisesRef = useRef<Map<string, Promise<boolean>>>(new Map());
  const leaderboardPrefetchStartedRef = useRef(false);
  const leaderboardPrefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const identityTeaserShownRef = useRef(false);
  const lastIdentityTeaserRef = useRef<string | null>(null);
  const onboardingCompletingRef = useRef(false);
  const firstVoteHintMarkedRef = useRef(false);
  const { user, loading: authLoading, signIn } = useAuth();
  const { takes, loading: takesLoading, error: takesError, submitVote, skipTake, refreshTakes, loadMore, hasMore, prependTake, removeTakeLocally } = useFirebaseTakes({
    category: selectedCategory
  });
  const { stats, loading: statsLoading, refreshStats, applyEngagementUpdate } = useUserStats();
  const votingProfileState = useVotingProfile(user?.uid, stats.totalVotes, showVotingStyleModal);

  // Use the hook-based interstitial ads
  const { onCardComplete, onSessionEnd } = useInterstitialAds();

  const theme = isDarkMode ? colors.dark : colors.light;

  // Get responsive dimensions for this device profile
  const responsive = useResponsive();
  const insets = useSafeAreaInsets();

  // Create responsive styles
  const styles = useMemo(() => createStyles(responsive, insets), [responsive, insets]);
  const selectedHistoryIndex = selectedTakeForStats
    ? sessionVoteHistory.findIndex(entry => entry.take.id === selectedTakeForStats.take.id)
    : -1;
  const canRewind = sessionVoteHistory.length > 0 &&
    (selectedHistoryIndex === -1 || selectedHistoryIndex < sessionVoteHistory.length - 1);

  const streakInstructionText = useMemo(() => {
    if (stats.votingStreak <= 0) {
      return '🔥 Vote today to start a daily streak';
    }

    if (stats.streakUpdatedToday) {
      return `🔥 ${stats.votingStreak}-day streak active today`;
    }

    return `🔥 Vote today to keep your ${stats.votingStreak}-day streak`;
  }, [stats.streakUpdatedToday, stats.votingStreak]);

  // Rotating instruction messages
  const instructionTexts = useMemo(() => [
    "Swipe right 🔥 HOT • Swipe left ❄️ NOT",
    streakInstructionText,
    "Swipe up ⬆️ or down ⬇️ to skip",
    "🚀 Keep voting to space out ads",
    "☰ Menu has history, favorites, and settings",
  ], [streakInstructionText]);

  const statsBarSegments = useMemo(() => {
    const dailyChallenge = stats.dailyChallenge;
    const challengeText = dailyChallenge.completed
      ? '🎯 Done ✓'
      : `🎯 ${dailyChallenge.progress}/${dailyChallenge.goal}`;

    return {
      streak: `🔥 ${stats.votingStreak}d`,
      challenge: challengeText,
      community: `👥 ${formatCompactCount(communityTotalVotes)}`,
    };
  }, [communityTotalVotes, stats.dailyChallenge, stats.votingStreak]);

  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const storedPreference = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
        if (storedPreference === 'dark') {
          setIsDarkMode(true);
        } else if (storedPreference === 'light') {
          setIsDarkMode(false);
        }
      } catch (error) {
        console.warn('Unable to load theme preference:', error);
      }
    };

    loadThemePreference();
  }, []);

  useEffect(() => {
    const loadResultsAutoplayPreference = async () => {
      try {
        const storedPreference = await AsyncStorage.getItem(RESULTS_AUTOPLAY_PREFERENCE_KEY);
        setResultsAutoplay(storedPreference === 'true');
      } catch (error) {
        console.warn('Unable to load results autoplay preference:', error);
      }
    };

    loadResultsAutoplayPreference();
  }, []);

  // Show the lightweight onboarding card only for truly new local installs.
  useEffect(() => {
    let mounted = true;

    const loadOnboardingState = async () => {
      try {
        const [completed, legacyLaunch] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY),
          AsyncStorage.getItem(LEGACY_FIRST_LAUNCH_KEY),
        ]);

        if (!mounted) {
          return;
        }

        const alreadyKnowsApp = completed === 'true' || legacyLaunch === 'true';
        setShowOnboardingCard(!alreadyKnowsApp);
        setOnboardingChecked(true);

        if (alreadyKnowsApp && completed !== 'true') {
          AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true').catch(error => {
            console.warn('Unable to migrate onboarding flag:', error);
          });
        }
      } catch (error) {
        console.warn('Unable to load onboarding state:', error);
        if (mounted) {
          setShowOnboardingCard(false);
          setOnboardingChecked(true);
        }
      }
    };

    loadOnboardingState();

    return () => {
      mounted = false;
    };
  }, []);

  const completeOnboarding = React.useCallback(() => {
    if (onboardingCompletingRef.current) {
      return;
    }

    onboardingCompletingRef.current = true;
    setShowOnboardingCard(false);

    Promise.all([
      AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true'),
      AsyncStorage.setItem(LEGACY_FIRST_LAUNCH_KEY, 'true'),
    ]).catch(error => {
      console.warn('Unable to save onboarding completion:', error);
    });
  }, []);

  // Auto sign-in on first load
  React.useEffect(() => {
    if (!user && !authLoading) {
      signIn().catch(console.error);
    }
  }, [user, authLoading, signIn]);

  // Fetch community stats on mount and key actions
  const refreshCommunityStats = async () => {
    try {
      const stats = await getCommunityStats();
      setCommunityTotalVotes(stats.totalVotes);
      AsyncStorage.setItem(
        COMMUNITY_STATS_CACHE_KEY,
        JSON.stringify({ totalVotes: stats.totalVotes, savedAt: Date.now() })
      ).catch((error) => {
        console.warn('Unable to cache community stats:', error);
      });
    } catch (error) {
      console.warn('Unable to refresh community stats:', error);
    }
  };

  // Initial load and periodic refresh
  React.useEffect(() => {
    const loadCachedCommunityStats = async () => {
      try {
        const raw = await AsyncStorage.getItem(COMMUNITY_STATS_CACHE_KEY);
        if (!raw) return;

        const cached = JSON.parse(raw);
        if (typeof cached.totalVotes === 'number') {
          setCommunityTotalVotes(cached.totalVotes);
        }
      } catch (error) {
        console.warn('Unable to read community stats cache:', error);
      }
    };

    loadCachedCommunityStats();
    refreshCommunityStats();

    // Refresh every 60 seconds if the app is active
    const interval = setInterval(refreshCommunityStats, 60000);

    return () => clearInterval(interval);
  }, []);

  // Refresh on category change
  React.useEffect(() => {
    refreshCommunityStats();
  }, [selectedCategory]);

  const scheduleLeaderboardPrefetch = React.useCallback(() => {
    if (!user || authLoading || leaderboardPrefetchStartedRef.current || leaderboardPrefetchTimeoutRef.current) {
      return;
    }

    leaderboardPrefetchTimeoutRef.current = setTimeout(() => {
      leaderboardPrefetchTimeoutRef.current = null;
      if (leaderboardPrefetchStartedRef.current) {
        return;
      }

      leaderboardPrefetchStartedRef.current = true;
      prefetchLeaderboardCache().catch(error => {
        console.warn('Unable to prefetch leaderboards:', error);
      });
    }, 3500);
  }, [authLoading, user]);

  React.useEffect(() => {
    return () => {
      if (leaderboardPrefetchTimeoutRef.current) {
        clearTimeout(leaderboardPrefetchTimeoutRef.current);
        leaderboardPrefetchTimeoutRef.current = null;
      }
    };
  }, []);

  // Handle back button/gesture to close modals in proper order
  useEffect(() => {
    const backAction = () => {
      // Check modals in order of priority (highest z-index first)
      if (showSubmitModal) {
        setShowSubmitModal(false);
        return true; // Prevent default back behavior
      }
      if (showRecentVotesModal) {
        setShowRecentVotesModal(false);
        return true;
      }
      if (showFavoritesModal) {
        setShowFavoritesModal(false);
        return true;
      }
      if (showVotingStyleModal) {
        setShowVotingStyleModal(false);
        return true;
      }
      if (showLeaderboardModal) {
        setShowLeaderboardModal(false);
        return true;
      }
      if (showMyTakesModal) {
        setShowMyTakesModal(false);
        return true;
      }
      if (showInstructionsModal) {
        setShowInstructionsModal(false);
        return true;
      }
      if (showSafetyModal) {
        setShowSafetyModal(false);
        return true;
      }
      if (selectedTakeForStats) {
        setSelectedTakeForStats(null);
        return true;
      }
      // If no modals are open, allow default behavior (exit app)
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showSubmitModal, showRecentVotesModal, showFavoritesModal, showVotingStyleModal, showLeaderboardModal, showMyTakesModal, showInstructionsModal, showSafetyModal, selectedTakeForStats]);

  // Rotate instruction text with a quiet fade so the footer feels alive without flicker.
  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: motion.duration.instructionFadeOut,
        useNativeDriver: true,
      }).start(() => {
        // Change text while faded out
        setCurrentInstructionIndex((prev) => (prev + 1) % instructionTexts.length);

        // Fade back in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: motion.duration.instructionFadeIn,
          useNativeDriver: true,
        }).start();
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [instructionTexts.length, fadeAnim]);

  const processToastQueue = React.useCallback(() => {
    if (toastAnimatingRef.current) {
      return;
    }

    const nextToast = toastQueueRef.current.shift();
    if (!nextToast) {
      return;
    }

    toastAnimatingRef.current = true;
    setStreakToast(nextToast);
    streakToastAnim.stopAnimation();
    streakToastAnim.setValue(0);
    Animated.sequence([
      Animated.spring(streakToastAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: motion.spring.press.damping,
        stiffness: motion.spring.press.stiffness,
      }),
      Animated.delay(2400),
      Animated.timing(streakToastAnim, {
        toValue: 0,
        duration: motion.duration.fadeOut,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setStreakToast(null);
        setTimeout(() => {
          toastAnimatingRef.current = false;
          processToastQueue();
        }, 180);
      }
    });
  }, [streakToastAnim]);

  const enqueueToast = React.useCallback((toast: EngagementToast) => {
    toastQueueRef.current.push(toast);
    processToastQueue();
  }, [processToastQueue]);

  const showStreakToast = React.useCallback((streakUpdate: StreakUpdateResult) => {
    const isMilestone = Boolean(streakUpdate.milestoneReached);
    const isFirstDay = streakUpdate.currentStreak === 1;

    enqueueToast({
      title: isMilestone
        ? `🔥 ${streakUpdate.currentStreak}-day streak!`
        : isFirstDay
          ? '🔥 Streak started'
          : `🔥 ${streakUpdate.currentStreak}-day streak`,
      subtitle: isMilestone
        ? 'Milestone hit. Keep it rolling tomorrow.'
        : 'Come back tomorrow to keep it alive.',
    });
  }, [enqueueToast]);

  const showStreakInfo = React.useCallback(() => {
    if (stats.votingStreak <= 0) {
      enqueueToast({
        title: '🔥 Daily streak',
        subtitle: 'Vote today to start your streak.',
      });
      return;
    }

    enqueueToast({
      title: `🔥 ${stats.votingStreak}-day streak`,
      subtitle: stats.streakUpdatedToday
        ? "You've kept it alive today. Come back tomorrow."
        : 'Vote today to keep it alive.',
    });
  }, [enqueueToast, stats.streakUpdatedToday, stats.votingStreak]);

  const showChallengeInfo = React.useCallback(() => {
    const challenge = stats.dailyChallenge;
    const copy = getChallengeProgressCopy(challenge);

    enqueueToast({
      title: copy.title,
      subtitle: copy.subtitle,
    });
  }, [enqueueToast, stats.dailyChallenge]);

  const showCommunityInfo = React.useCallback(() => {
    enqueueToast({
      title: `👥 ${communityTotalVotes.toLocaleString()} community votes`,
      subtitle: 'Votes cast across Hot or Not Takes.',
    });
  }, [communityTotalVotes, enqueueToast]);

  useEffect(() => {
    if (!user || authLoading || statsLoading || stats.dailyChallenge.completed) {
      return;
    }

    const challenge = stats.dailyChallenge;
    const storageKey = `${DAILY_CHALLENGE_NUDGE_PREFIX}:${user.uid}:${challenge.date}`;
    let cancelled = false;

    const showDailyChallengeNudge = async () => {
      try {
        const alreadyShown = await AsyncStorage.getItem(storageKey);
        if (alreadyShown || cancelled) return;

        await AsyncStorage.setItem(storageKey, 'true');
        if (cancelled) return;

        const copy = getChallengeProgressCopy(challenge);
        enqueueToast({
          title: copy.title,
          subtitle: copy.subtitle,
        });
      } catch (error) {
        console.warn('Unable to show daily challenge nudge:', error);
      }
    };

    const timeout = setTimeout(showDailyChallengeNudge, 900);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [authLoading, enqueueToast, stats.dailyChallenge, statsLoading, user]);

  const showFirstVoteHint = React.useCallback(async (takeId: string) => {
    if (firstVoteHintMarkedRef.current) {
      return;
    }

    try {
      const alreadyShown = await AsyncStorage.getItem(FIRST_VOTE_HINT_SHOWN_KEY);
      if (alreadyShown === 'true') {
        firstVoteHintMarkedRef.current = true;
        return;
      }

      firstVoteHintMarkedRef.current = true;
      await AsyncStorage.setItem(FIRST_VOTE_HINT_SHOWN_KEY, 'true');
      setFirstVoteHintTakeId(takeId);
    } catch (error) {
      console.warn('Unable to save first vote hint flag:', error);
    }
  }, []);

  useEffect(() => {
    if (!firstVoteHintTakeId) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setFirstVoteHintTakeId(null);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [firstVoteHintTakeId]);

  const handleVote = async (takeId: string, vote: 'hot' | 'not') => {
    let optimisticallyAddedToHistory = false;
    try {
      setIdentityTeaser(null);
      // Find the take that was voted on
      const votedTake = takes.find(take => take.id === takeId);
      const isVoteChange = changeVoteTakeIdsRef.current.has(takeId);
      const pendingVoteDelete = changeVoteDeletePromisesRef.current.get(takeId);
      let updatedTakeForHistory: typeof votedTake = undefined;

      if (pendingVoteDelete) {
        const deleteSucceeded = await pendingVoteDelete;
        if (!deleteSucceeded) {
          throw new Error('Previous vote is still being updated');
        }
      }

      // Keep rewind responsive as soon as the result card appears. Roll it back
      // below if the vote write fails.
      if (votedTake) {
        const updatedHotVotes = vote === 'hot' ? votedTake.hotVotes + 1 : votedTake.hotVotes;
        const updatedNotVotes = vote === 'not' ? votedTake.notVotes + 1 : votedTake.notVotes;
        updatedTakeForHistory = {
          ...votedTake,
          hotVotes: updatedHotVotes,
          notVotes: updatedNotVotes,
          totalVotes: updatedHotVotes + updatedNotVotes,
        };
        setSessionVoteHistory(prev => [
          { take: updatedTakeForHistory!, vote },
          ...prev.filter(entry => entry.take.id !== updatedTakeForHistory!.id),
        ].slice(0, SESSION_VOTE_HISTORY_LIMIT));
        optimisticallyAddedToHistory = true;
      }

      await new Promise(resolve => setTimeout(resolve, POST_RESULT_SYNC_DELAY_MS));

      const streakUpdate = await submitVote(takeId, vote, {
        countDailyEngagement: !isVoteChange,
      });
      changeVoteTakeIdsRef.current.delete(takeId);

      if (!isVoteChange && streakUpdate?.totalVotes === 1) {
        showFirstVoteHint(takeId);
      }

      // Track completed card for ad service (called after vote is cast)
      onCardComplete();
      scheduleLeaderboardPrefetch();
      if (streakUpdate?.didUpdateToday) {
        applyEngagementUpdate(streakUpdate);
        showStreakToast(streakUpdate);
      }
      if (streakUpdate?.challengeCompleted) {
        if (!streakUpdate.didUpdateToday) {
          applyEngagementUpdate(streakUpdate);
        }
        enqueueToast({
          title: '🎯 Challenge complete!',
          subtitle: `${streakUpdate.dailyChallenge?.title || "Today's quest"} is done. Come back tomorrow.`,
        });
      } else if (streakUpdate && !streakUpdate.didUpdateToday) {
        applyEngagementUpdate(streakUpdate);
      }
      streakUpdate?.achievementToasts?.forEach(enqueueToast);
      // Reconcile with Firestore after the local footer update lands.
      await refreshStats();
      // Also refresh community stats
      await refreshCommunityStats();

      if (updatedTakeForHistory) {
        const totalVotesAfterVote = Math.max(
          stats.totalVotes + (isVoteChange ? 0 : 1),
          votingProfileState.profile.totalVotes + (isVoteChange ? 0 : 1)
        );
        if (!isVoteChange && !identityTeaserShownRef.current) {
          const voteMomentContext = getVoteMomentContext(updatedTakeForHistory, vote);
          const teaser = buildVotingStyleTeaser(
            {
              ...votingProfileState.profile,
              totalVotes: totalVotesAfterVote,
            },
            {
              totalVotesAfterVote,
              ...voteMomentContext,
            }
          );

          if (teaser && teaser !== lastIdentityTeaserRef.current) {
            lastIdentityTeaserRef.current = teaser;
            identityTeaserShownRef.current = true;
            setIdentityTeaser({ takeId, text: teaser });
          }
        }
      }
    } catch (error) {
      console.error('Error submitting vote:', error);
      changeVoteTakeIdsRef.current.delete(takeId);
      if (optimisticallyAddedToHistory) {
        setSessionVoteHistory(prev => prev.filter(entry => entry.take.id !== takeId));
      }
      // Could show a toast notification here
    }
  };

  const handleSkip = async (takeId: string) => {
    try {
      await skipTake(takeId);
      // Track completed card for ad service (called after skip)
      onCardComplete();
      scheduleLeaderboardPrefetch();
      // Refresh stats in case there are other metrics tracked
      await refreshStats();
    } catch (error) {
      console.error('Error skipping take:', error);
      // Could show a toast notification here
    }
  };

  const handleInviteFriends = React.useCallback(async () => {
    try {
      const SMART_LINK = 'https://hot-or-not-takes.web.app/download';
      const inviteMessage = `Try Hot or Not Takes - Vote on spicy hot takes! 🔥 ${SMART_LINK}`;

      await RNShare.open({
        title: 'Invite Friends to Hot or Not Takes',
        message: inviteMessage,
        failOnCancel: false,
      });
    } catch (error) {
    }
  }, []);

  const toggleTheme = React.useCallback(() => {
    setIsDarkMode(prev => {
      const nextIsDarkMode = !prev;
      AsyncStorage.setItem(
        THEME_PREFERENCE_KEY,
        nextIsDarkMode ? 'dark' : 'light'
      ).catch(error => {
        console.warn('Unable to save theme preference:', error);
      });
      return nextIsDarkMode;
    });
  }, []);

  const toggleResultsAutoplay = React.useCallback(() => {
    setResultsAutoplay(prev => {
      const nextResultsAutoplay = !prev;
      AsyncStorage.setItem(
        RESULTS_AUTOPLAY_PREFERENCE_KEY,
        nextResultsAutoplay ? 'true' : 'false'
      ).catch(error => {
        console.warn('Unable to save results autoplay preference:', error);
      });
      return nextResultsAutoplay;
    });
  }, []);

  const openMyTakes = React.useCallback(() => setShowMyTakesModal(true), []);
  const openLeaderboard = React.useCallback(() => setShowLeaderboardModal(true), []);
  const openRecentVotes = React.useCallback(() => setShowRecentVotesModal(true), []);
  const openFavorites = React.useCallback(() => setShowFavoritesModal(true), []);
  const openInstructions = React.useCallback(() => setShowInstructionsModal(true), []);
  const openSafety = React.useCallback(() => setShowSafetyModal(true), []);
  const openVotingStyle = React.useCallback(() => setShowVotingStyleModal(true), []);

  const requestAdminTakeRemoval = React.useCallback((take: Take) => {
    setAdminRemovalTake(take);
    setAdminRemovalPin('');
    setAdminRemovalError(null);
  }, []);

  const closeAdminRemovalModal = React.useCallback(() => {
    if (adminRemovalLoading) return;
    setAdminRemovalTake(null);
    setAdminRemovalPin('');
    setAdminRemovalError(null);
  }, [adminRemovalLoading]);

  const confirmAdminTakeRemoval = React.useCallback(async () => {
    if (!adminRemovalTake || adminRemovalLoading) {
      return;
    }

    const pin = adminRemovalPin.trim();
    if (!pin) {
      setAdminRemovalError('Enter the admin PIN.');
      return;
    }

    setAdminRemovalLoading(true);
    setAdminRemovalError(null);

    try {
      await adminRemoveTake(adminRemovalTake.id, pin);
      removeTakeLocally(adminRemovalTake.id);
      setSessionVoteHistory(prev => prev.filter(entry => entry.take.id !== adminRemovalTake.id));
      if (selectedTakeForStats?.take.id === adminRemovalTake.id) {
        setSelectedTakeForStats(null);
      }
      enqueueToast({
        title: 'Removed from feed',
        subtitle: 'This take was rejected and will no longer appear for users.',
      });
      setAdminRemovalTake(null);
      setAdminRemovalPin('');
    } catch (error) {
      setAdminRemovalError(error instanceof Error ? error.message : 'Unable to remove take.');
    } finally {
      setAdminRemovalLoading(false);
    }
  }, [
    adminRemovalLoading,
    adminRemovalPin,
    adminRemovalTake,
    enqueueToast,
    removeTakeLocally,
    selectedTakeForStats?.take.id,
  ]);

  const handleCategoryChange = (newCategory: string) => {
    // Trigger ad on category change (session end)
    onSessionEnd();
    setSelectedCategory(newCategory);
  };

  const handleRetry = async () => {
    try {
      if (!user) {
        await signIn();
      }
      await refreshTakes();
    } catch (error) {
      console.error('Error retrying feed load:', error);
    }
  };

  // Removed pull-to-refresh due to fixed layout structure
  // Can be re-implemented with a different trigger if needed

  const handleChangeVote = (take: any, currentVote?: 'hot' | 'not' | null) => {
    if (!user) return;
    const voteToRemove = currentVote;
    changeVoteTakeIdsRef.current.add(take.id);

    const updatedTake = voteToRemove
      ? {
          ...take,
          hotVotes: voteToRemove === 'hot' ? Math.max(0, take.hotVotes - 1) : take.hotVotes,
          notVotes: voteToRemove === 'not' ? Math.max(0, take.notVotes - 1) : take.notVotes,
          totalVotes: Math.max(0, take.totalVotes - 1),
        }
      : take;

    // Restore the card immediately so the interaction feels snappy.
    prependTake(updatedTake);
    setSessionVoteHistory(prev => prev.filter(entry => entry.take.id !== take.id));

    const deletePromise = (async () => {
      try {
        await deleteVote(take.id, user.uid);
        await refreshStats();
        return true;
      } catch (error) {
        console.error('Error changing vote:', error);
        return false;
      } finally {
        changeVoteDeletePromisesRef.current.delete(take.id);
      }
    })();

    changeVoteDeletePromisesRef.current.set(take.id, deletePromise);
  };

  const handleVoteNow = async (take: any) => {
    if (!user) return;

    try {

      // Add the take to the front of the deck for voting first
      prependTake(take);

      // Then close stats modal to reveal the new voteable card
      setSelectedTakeForStats(null);

    } catch (error) {
      console.error('Error preparing take for voting:', error);
    }
  };

  const handleShowLastVote = () => {
    if (!canRewind) return;

    const currentIndex = selectedTakeForStats
      ? sessionVoteHistory.findIndex(entry => entry.take.id === selectedTakeForStats.take.id)
      : -1;
    const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
    const historyEntry = sessionVoteHistory[nextIndex];

    if (!historyEntry) return;

    setSelectedTakeForStats({ take: historyEntry.take, vote: historyEntry.vote });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Fixed Header Section */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerRow}>
          <BurgerMenu
            isDarkMode={isDarkMode}
            onMyTakes={openMyTakes}
            onLeaderboard={openLeaderboard}
            onRecentVotes={openRecentVotes}
            onFavorites={openFavorites}
            onInstructions={openInstructions}
            onInviteFriends={handleInviteFriends}
            onSafety={openSafety}
            onVotingStyle={openVotingStyle}
            onToggleTheme={toggleTheme}
            resultsAutoplay={resultsAutoplay}
            onToggleResultsAutoplay={toggleResultsAutoplay}
          />
        </View>

        <View style={styles.titleContainer}>
          <Image
            source={isDarkMode
              ? require('../assets/images/title-banner-dark-mode.png')
              : require('../assets/images/title-banner-light-mode.png')
            }
            style={styles.titleBanner}
            resizeMode="contain"
          />
        </View>

        {/* Category Dropdown - part of fixed header */}
        <View style={styles.categoryContainer}>
          <CategoryDropdown
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
            isDarkMode={isDarkMode}
          />
        </View>
      </View>

      {/* Flexible Middle Section - Card fills available space */}
      <View style={styles.flexibleMiddle}>
        {!onboardingChecked ? (
          <LoadingSkeleton isDarkMode={isDarkMode} />
        ) : showOnboardingCard ? (
          <OnboardingCard
            isDarkMode={isDarkMode}
            onComplete={completeOnboarding}
          />
        ) : takesLoading || authLoading ? (
          <LoadingSkeleton isDarkMode={isDarkMode} />
        ) : takesError ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.errorText, { color: theme.error }]}>
              {takesError}
            </Text>
            <AnimatedPressable
              style={[styles.retryButton, { backgroundColor: theme.primary }]}
              onPress={handleRetry}
              scaleValue={0.95}
              hapticIntensity={15}
            >
              <Text style={[styles.retryButtonText, { color: '#FFFFFF' }]}>
                Retry
              </Text>
            </AnimatedPressable>
          </View>
        ) : (
          <CustomSwipeableCardDeck
            takes={takes}
            onVote={handleVote}
            onSkip={handleSkip}
            onSubmitTake={() => setShowSubmitModal(true)}
            onShowInstructions={() => setShowInstructionsModal(true)}
            isDarkMode={isDarkMode}
            hasMore={hasMore}
            loadMore={loadMore}
            refreshTakes={refreshTakes}
            loading={takesLoading}
            externalStatsCard={selectedTakeForStats}
            onExternalStatsCardDismiss={() => setSelectedTakeForStats(null)}
            onShowRecentVotes={handleShowLastVote}
            onChangeVote={handleChangeVote}
            onVoteNow={handleVoteNow}
            communityTotalVotes={communityTotalVotes}
            autoAdvanceResults={resultsAutoplay}
            skipRequestToken={skipRequestToken}
            identityTeaser={identityTeaser}
            onIdentityTeaserPress={openVotingStyle}
            firstVoteHintTakeId={firstVoteHintTakeId}
            onFirstVoteHintDismiss={() => setFirstVoteHintTakeId(null)}
            onAdminRemoveRequest={requestAdminTakeRemoval}
          />
        )}
      </View>

      {/* Fixed Bottom Section */}
      <View style={styles.fixedFooter}>
        {/* Bottom Buttons Row */}
        <View style={styles.bottomButtonsRow}>
          {/* Voting Style Button */}
          <AnimatedPressable
            style={[
              styles.bottomButton,
              styles.ringedFooterButton,
              styles.strongRingedFooterButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.accent,
                shadowColor: theme.accent,
              },
            ]}
            onPress={openVotingStyle}
            scaleValue={0.9}
            hapticIntensity={motion.haptic.selection}
            accessibilityRole="button"
            accessibilityLabel="Open my voting style"
          >
            <Text style={styles.buttonIcon}>🧭</Text>
          </AnimatedPressable>

          {/* Last Vote Button */}
          <AnimatedPressable
            style={[
              styles.bottomButton,
              styles.coolFooterButton,
              !canRewind && styles.disabledControl,
              isDarkMode
                ? { backgroundColor: theme.surface, borderColor: 'rgba(116, 185, 255, 0.82)', shadowColor: '#74B9FF' }
                : { backgroundColor: '#F0F0F1', borderColor: 'rgba(116, 185, 255, 0.72)', shadowColor: '#74B9FF' }
            ]}
            onPress={handleShowLastVote}
            disabled={!canRewind}
            scaleValue={0.9}
            hapticIntensity={motion.haptic.light}
            accessibilityRole="button"
            accessibilityLabel="Show previous result"
          >
            <Text style={[styles.buttonIcon, isDarkMode && { color: theme.text }]}>↩️</Text>
          </AnimatedPressable>

          {/* Skip Button */}
          <AnimatedPressable
            style={[
              styles.bottomButton,
              styles.ringedFooterButton,
              !takes[0] && styles.disabledControl,
              isDarkMode
                ? { backgroundColor: theme.surface, borderColor: theme.accent + 'CC', shadowColor: theme.accent }
                : { backgroundColor: '#F0F0F1', borderColor: theme.accent + 'AA', shadowColor: theme.accent }
            ]}
            onPress={() => {
              if (takes[0]) {
                setSkipRequestToken(prev => prev + 1);
              }
            }}
            disabled={!takes[0]}
            scaleValue={0.9}
            hapticIntensity={motion.haptic.selection}
            accessibilityRole="button"
            accessibilityLabel="Skip this take"
          >
            <Text style={[styles.buttonIcon, isDarkMode ? { color: theme.text } : { color: '#333' }]}>⏭️</Text>
          </AnimatedPressable>

          {/* Submit Button */}
          <AnimatedPressable
            style={[
              styles.bottomButton,
              styles.ringedFooterButton,
              styles.strongRingedFooterButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.primary,
                shadowColor: theme.primary,
              },
            ]}
            onPress={() => setShowSubmitModal(true)}
            scaleValue={0.9}
            hapticIntensity={motion.haptic.selection}
            accessibilityRole="button"
            accessibilityLabel="Submit a hot take"
          >
            <Text style={styles.buttonIcon}>✏️</Text>
          </AnimatedPressable>
        </View>

        {/* Vote Counter Row - showing personal and community totals */}
        <View style={styles.voteCounterRow}>
          <View style={[styles.voteCounter, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
            <TouchableOpacity
              style={styles.statsBarSegment}
              onPress={showStreakInfo}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Explain daily streak"
            >
              <Text
                style={[styles.voteCounterText, { color: theme.textSecondary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {statsBarSegments.streak}
              </Text>
            </TouchableOpacity>

            <View style={[styles.statsBarDivider, { backgroundColor: theme.border }]} />

            <TouchableOpacity
              style={styles.statsBarSegment}
              onPress={showChallengeInfo}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Explain daily quest"
            >
              <Text
                style={[styles.voteCounterText, { color: theme.textSecondary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {statsBarSegments.challenge}
              </Text>
            </TouchableOpacity>

            <View style={[styles.statsBarDivider, { backgroundColor: theme.border }]} />

            <TouchableOpacity
              style={styles.statsBarSegment}
              onPress={showCommunityInfo}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Explain community votes"
            >
              <Text
                style={[styles.voteCounterText, { color: theme.textSecondary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {statsBarSegments.community}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.instructions}>
          <Animated.Text
            style={[
              styles.instructionText,
              {
                color: theme.textSecondary,
                opacity: fadeAnim
              }
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {instructionTexts[currentInstructionIndex]}
          </Animated.Text>
        </View>

        <View style={styles.adSpace}>
          <AdBanner />
        </View>
      </View>

      {streakToast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.streakToast,
            {
              backgroundColor: isDarkMode ? theme.surface : '#FFF6E2',
              borderColor: isDarkMode ? theme.border : '#FFD88A',
              opacity: streakToastAnim,
              transform: [
                {
                  translateY: streakToastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
                {
                  scale: streakToastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={[styles.streakToastTitle, { color: theme.text }]}>
            {streakToast.title}
          </Text>
          <Text style={[styles.streakToastSubtitle, { color: theme.textSecondary }]}>
            {streakToast.subtitle}
          </Text>
        </Animated.View>
      )}

      <Modal
        visible={!!adminRemovalTake}
        transparent
        animationType="fade"
        onRequestClose={closeAdminRemovalModal}
      >
        <View style={styles.adminModalBackdrop}>
          <View style={[
            styles.adminModalCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}>
            <Text style={[styles.adminModalTitle, { color: theme.text }]}>
              Remove this take?
            </Text>
            <Text style={[styles.adminModalTake, { color: theme.textSecondary }]} numberOfLines={3}>
              {adminRemovalTake?.text}
            </Text>
            <TextInput
              style={[
                styles.adminPinInput,
                {
                  color: theme.text,
                  borderColor: adminRemovalError ? theme.error : theme.border,
                  backgroundColor: isDarkMode ? '#1F1F1F' : '#FFFFFF',
                },
              ]}
              value={adminRemovalPin}
              onChangeText={(value) => {
                setAdminRemovalPin(value);
                if (adminRemovalError) {
                  setAdminRemovalError(null);
                }
              }}
              placeholder="Admin PIN"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!adminRemovalLoading}
              returnKeyType="done"
              onSubmitEditing={confirmAdminTakeRemoval}
            />
            {adminRemovalError && (
              <Text style={[styles.adminModalError, { color: theme.error }]}>
                {adminRemovalError}
              </Text>
            )}
            <View style={styles.adminModalActions}>
              <TouchableOpacity
                style={[styles.adminModalButton, { backgroundColor: theme.border }]}
                onPress={closeAdminRemovalModal}
                disabled={adminRemovalLoading}
                activeOpacity={0.75}
              >
                <Text style={[styles.adminModalButtonText, { color: theme.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adminModalButton, { backgroundColor: theme.primary }]}
                onPress={confirmAdminTakeRemoval}
                disabled={adminRemovalLoading}
                activeOpacity={0.75}
              >
                <Text style={[styles.adminModalButtonText, { color: '#FFFFFF' }]}>
                  {adminRemovalLoading ? 'Removing...' : 'Remove'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* Submit Take Modal - Conditional Rendering */}
      {showSubmitModal && (
        <FullScreenOverlay zIndex={2000}>
          <SubmitTakeScreen
            onClose={() => setShowSubmitModal(false)}
            onSuccess={() => {
              // Trigger MyTakes refresh when a new take is submitted
              setMyTakesRefreshTrigger(Date.now());
            }}
            isDarkMode={isDarkMode}
          />
        </FullScreenOverlay>
      )}

      {/* My Takes Modal - Conditional Rendering */}
      {showMyTakesModal && (
        <FullScreenOverlay zIndex={1000}>
          <MyTakesScreen
            onClose={() => setShowMyTakesModal(false)}
            onOpenSubmit={() => setShowSubmitModal(true)}
            onShowTakeStats={async (take, vote) => {
              if (vote) {
                setSelectedTakeForStats({ take, vote });
              } else {
                // Look up user's actual vote for this take
                try {
                  if (user) {
                    const userVoteRecord = await getUserVoteForTake(take.id, user.uid);
                    const actualVote = userVoteRecord ? userVoteRecord.vote : null;
                    setSelectedTakeForStats({ take, vote: actualVote });
                  } else {
                    setSelectedTakeForStats({ take, vote: null });
                  }
                } catch (error) {
                  console.error('Error getting user vote:', error);
                  setSelectedTakeForStats({ take, vote: null });
                }
              }
            }}
            isDarkMode={isDarkMode}
            refreshTrigger={myTakesRefreshTrigger}
          />
        </FullScreenOverlay>
      )}

      {/* Leaderboard Modal - Conditional Rendering */}
      {showLeaderboardModal && (
        <FullScreenOverlay zIndex={1500}>
          <LeaderboardScreen
            onClose={() => setShowLeaderboardModal(false)}
            onShowTakeStats={async (take, vote) => {
              if (vote) {
                setSelectedTakeForStats({ take, vote });
              } else {
                // Look up user's actual vote for this take
                try {
                  if (user) {
                    const userVoteRecord = await getUserVoteForTake(take.id, user.uid);
                    const actualVote = userVoteRecord ? userVoteRecord.vote : null;
                    setSelectedTakeForStats({ take, vote: actualVote });
                  } else {
                    setSelectedTakeForStats({ take, vote: null });
                  }
                } catch (error) {
                  console.error('Error getting user vote:', error);
                  setSelectedTakeForStats({ take, vote: null });
                }
              }
            }}
            isDarkMode={isDarkMode}
          />
        </FullScreenOverlay>
      )}

      {/* Vote History Modal - Conditional Rendering */}
      {showRecentVotesModal && (
        <FullScreenOverlay zIndex={1600}>
          <RecentVotesScreen
            onClose={() => setShowRecentVotesModal(false)}
            onShowTakeStats={(take, vote) => {
              setSelectedTakeForStats({ take, vote });
            }}
            isDarkMode={isDarkMode}
          />
        </FullScreenOverlay>
      )}

      {/* My Favorites Modal - Conditional Rendering */}
      {showFavoritesModal && (
        <FullScreenOverlay zIndex={1700}>
          <MyFavoritesScreen
            onClose={() => setShowFavoritesModal(false)}
            onShowTakeStats={async (take, vote) => {
              // Show stats even if vote is null (user hasn't voted on this take)
              if (vote) {
                setSelectedTakeForStats({ take, vote });
              } else {
                // Look up user's actual vote for this take
                try {
                  if (user) {
                    const userVoteRecord = await getUserVoteForTake(take.id, user.uid);
                    const actualVote = userVoteRecord ? userVoteRecord.vote : null;
                    setSelectedTakeForStats({ take, vote: actualVote });
                  } else {
                    setSelectedTakeForStats({ take, vote: null });
                  }
                } catch (error) {
                  console.error('Error getting user vote:', error);
                  setSelectedTakeForStats({ take, vote: null });
                }
              }
            }}
            isDarkMode={isDarkMode}
          />
        </FullScreenOverlay>
      )}

      {/* My Voting Style Modal - Conditional Rendering */}
      {showVotingStyleModal && (
        <FullScreenOverlay zIndex={1750}>
          <VotingStyleScreen
            onClose={() => setShowVotingStyleModal(false)}
            isDarkMode={isDarkMode}
            profile={votingProfileState.profile}
            loading={votingProfileState.loading}
            error={votingProfileState.error}
            onRefresh={votingProfileState.refreshProfile}
          />
        </FullScreenOverlay>
      )}

      {/* Safety Standards Modal - Conditional Rendering */}
      {showSafetyModal && (
        <FullScreenOverlay zIndex={1800}>
          <SafetyStandardsScreen
            onClose={() => setShowSafetyModal(false)}
            isDarkMode={isDarkMode}
          />
        </FullScreenOverlay>
      )}

      {/* Instructions Modal */}
      <InstructionsModal
        visible={showInstructionsModal}
        onClose={() => setShowInstructionsModal(false)}
        isDarkMode={isDarkMode}
      />

      {/* Ad Consent Modal */}
      <AdConsentModal isDarkMode={isDarkMode} />


    </SafeAreaView>
  );
};

// Create responsive styles function
const createStyles = (responsive: any, insets: any) => {
  const roundControlSize = Math.max(motion.touchTarget.comfortable, responsive.iconSize.xlarge);
  const footerFabBottom = Math.max(144, responsive.spacing.xxl * 3 + insets.bottom);
  const toastBottom = footerFabBottom + roundControlSize + responsive.spacing.xxl * 2;

  return StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeader: {
    // backgroundColor: 'yellow',
    paddingHorizontal: responsive.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 0 : insets.top + responsive.spacing.xs,
    paddingBottom: responsive.spacing.xs,
  },
  flexibleMiddle: {
    // backgroundColor: 'green',
    flex: 1,
    position: 'relative', // Ensure absolute children position correctly
  },
  fixedFooter: {
    // backgroundColor: 'blue',
    paddingHorizontal: responsive.spacing.lg,
    paddingTop: responsive.spacing.md, // Reduce top padding
    paddingBottom: Platform.OS === 'ios' ? 0 : insets.bottom + responsive.spacing.xs, // Reduce bottom padding
    zIndex: 10, // Ensure footer is above cards during swipe
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: responsive.spacing.lg,
    paddingTop: insets.top + responsive.spacing.lg,
    paddingBottom: responsive.spacing.xs,
  },
  headerRow: {
    // backgroundColor: 'purple',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    zIndex: 10,
    // elevation: 10, // Remove unwanted shadow/border
  },
  titleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsive.spacing.sm,
    marginTop: -responsive.spacing.xxl - responsive.spacing.xs, // Replace -55 with scaled spacing
    width: '100%',
    overflow: 'hidden', // Prevent any overflow
  },
  title: {
    fontSize: responsive.fontSize.xxlarge,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
  },
  titleBanner: {
    // backgroundColor: 'aqua',
    // For L profile (baseline/Pixel 8), use original exact dimensions
    // For other profiles, scale appropriately
    width: responsive.profile === 'L' ? '95%' : Math.min(responsive.screen.availableWidth * 0.95, 548),
    height: responsive.profile === 'L' ? 110 : undefined,
    // Only use aspectRatio for non-L profiles
    ...(responsive.profile !== 'L' && { aspectRatio: 548 / 130 }),
    alignSelf: 'center',
  },
  statsContainer: {
    alignItems: 'center',
    marginBottom: responsive.spacing.xs,
  },
  statsText: {
    fontSize: responsive.fontSize.medium,
    fontWeight: '600',
  },
  categoryContainer: {
    // backgroundColor: 'red',
    paddingHorizontal: responsive.spacing.lg,
    paddingTop: responsive.spacing.xs,
    paddingBottom: responsive.spacing.sm,
    zIndex: 1,
    // elevation: 1, // Remove unwanted shadow/border
  },
  deckContainer: {
    // backgroundColor: 'green',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    // backgroundColor: 'green',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: responsive.fontSize.large,
    fontWeight: '500',
  },
  errorText: {
    fontSize: responsive.fontSize.medium,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: responsive.spacing.md,
  },
  retryButton: {
    paddingHorizontal: responsive.spacing.lg,
    paddingVertical: responsive.spacing.md,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: responsive.fontSize.medium,
    fontWeight: '600',
  },
  instructions: {
    alignItems: 'center',
    // paddingTop: responsive.spacing.sm,
    marginBottom: responsive.spacing.sm,
  },
  instructionText: {
    fontSize: responsive.fontSize.small,
    textAlign: 'center',
    fontWeight: '500',
  },
  adSpace: {
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    // marginTop: responsive.spacing.sm,
    backgroundColor: 'transparent',
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
    marginBottom: responsive.spacing.sm,
    gap: responsive.spacing.sm,
  },
  voteCounterRow: {
    flexDirection: 'row',
    justifyContent: 'center', // Center the vote counter
    alignItems: 'center',
    marginTop: responsive.spacing.sm,
    marginBottom: responsive.spacing.sm,
  },
  bottomButton: {
    width: roundControlSize,
    height: roundControlSize,
    borderRadius: roundControlSize / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.25,
    // Add shadow/elevation
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
  },
  ringedFooterButton: {
    borderWidth: 1.75,
    shadowOpacity: 0.24,
    shadowRadius: 5.5,
  },
  strongRingedFooterButton: {
    borderWidth: 2.25,
    shadowOpacity: 0.3,
    shadowRadius: 6.5,
  },
  coolFooterButton: {
    borderWidth: 1.75,
    shadowOpacity: 0.22,
    shadowRadius: 5.5,
  },
  disabledControl: {
    opacity: 0.45,
  },
  buttonIcon: {
    fontSize: responsive.fontSize.large + 1,
    fontWeight: 'bold',
  },
  voteCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: 25,
    minWidth: 240,
    maxWidth: '100%',
    // Add shadow/elevation
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
  },
  voteCounterText: {
    fontSize: responsive.fontSize.medium,
    fontWeight: '600',
    textAlign: 'center',
  },
  statsBarSegment: {
    minHeight: motion.touchTarget.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: responsive.spacing.xs,
    flexShrink: 1,
  },
  statsBarDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    opacity: 0.55,
    marginHorizontal: 2,
  },
  streakToast: {
    position: 'absolute',
    left: responsive.spacing.xl,
    right: responsive.spacing.xl,
    bottom: toastBottom,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: responsive.spacing.md,
    paddingVertical: responsive.spacing.sm,
    alignItems: 'center',
    zIndex: 3000,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  streakToastTitle: {
    fontSize: responsive.fontSize.medium,
    fontWeight: '800',
    textAlign: 'center',
  },
  streakToastSubtitle: {
    fontSize: responsive.fontSize.small,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  adminModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsive.spacing.xl,
    zIndex: 5000,
  },
  adminModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: responsive.spacing.lg,
    paddingVertical: responsive.spacing.lg,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.26,
    shadowRadius: 16,
  },
  adminModalTitle: {
    fontSize: responsive.fontSize.large,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: responsive.spacing.sm,
  },
  adminModalTake: {
    fontSize: responsive.fontSize.small,
    fontWeight: '700',
    lineHeight: responsive.fontSize.small * 1.3,
    textAlign: 'center',
    marginBottom: responsive.spacing.md,
  },
  adminPinInput: {
    minHeight: motion.touchTarget.minimum,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: responsive.spacing.md,
    fontSize: responsive.fontSize.medium,
    fontWeight: '700',
    marginBottom: responsive.spacing.sm,
  },
  adminModalError: {
    fontSize: responsive.fontSize.small,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: responsive.spacing.sm,
  },
  adminModalActions: {
    flexDirection: 'row',
    gap: responsive.spacing.sm,
    marginTop: responsive.spacing.xs,
  },
  adminModalButton: {
    flex: 1,
    minHeight: motion.touchTarget.minimum,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsive.spacing.md,
  },
  adminModalButtonText: {
    fontSize: responsive.fontSize.medium,
    fontWeight: '900',
  },
  emptySubtext: {
    fontSize: responsive.fontSize.medium,
    textAlign: 'center',
    marginTop: responsive.spacing.sm,
    marginBottom: responsive.spacing.lg,
  },
  emptySubmitButton: {
    paddingHorizontal: responsive.spacing.xl,
    paddingVertical: responsive.spacing.md,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySubmitButtonText: {
    fontSize: responsive.fontSize.large,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  adPlaceholder: {
    fontSize: responsive.fontSize.small,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  fabText: {
    fontSize: responsive.fontSize.xlarge,
  },
  });
};
