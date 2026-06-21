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
  Easing,
  AppState,
  Platform,
  TouchableOpacity,
  Modal,
  TextInput,
  Linking,
  InteractionManager,
  Pressable,
  type StyleProp,
  type ViewStyle,
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
import { AchievementsScreen } from './AchievementsScreen';
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
import { buildOptimisticVoteEngagementUpdate, getCommunityStats } from '../services/userService';
import { prefetchLeaderboardCache } from '../services/leaderboardCacheService';
import { prefetchUserFavoritesCache } from '../services/favoritesService';
import { backfillUnlockedAchievements, unlockAchievementFromToast } from '../services/achievementService';
import {
  requestNotificationsAfterQuestCompletion,
  scheduleStreakMilestoneNotification,
  syncDailyReminderNotifications,
} from '../services/notificationService';
import { flushVoteOutbox } from '../services/voteOutboxService';
import { useInterstitialAds } from '../hooks/useInterstitialAds';
import { colors, motion } from '../constants';
import { DailyChallenge, StreakUpdateResult, Take } from '../types';
import RNShare from 'react-native-share';

const THEME_PREFERENCE_KEY = 'themePreference';
const RESULTS_AUTOPLAY_PREFERENCE_KEY = 'resultsAutoplayPreference';
const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';
const LEGACY_FIRST_LAUNCH_KEY = 'hasLaunchedBefore';
const FIRST_VOTE_HINT_SHOWN_KEY = 'first_vote_hint_shown';
const DAILY_CHALLENGE_NUDGE_PREFIX = 'dailyChallengeNudgeShown';
const COMMUNITY_STATS_CACHE_KEY = 'community-stats-cache:v1';
const REVIEW_PROMPT_ATTEMPTED_KEY = 'review_prompt_attempted';
const DISMISSED_TOAST_IDS_KEY = 'dismissed-engagement-toast-ids:v1';
const PENDING_TOASTS_KEY = 'pending-engagement-toasts:v1';
const SMART_LINK = 'https://hot-or-not-takes.web.app/download';
const IOS_REVIEW_URL = 'https://apps.apple.com/us/app/hot-or-not-takes/id6751363365?action=write-review';
const ANDROID_MARKET_URL = 'market://details?id=com.anonymous.HotOrNotTakes';
const ANDROID_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.anonymous.HotOrNotTakes';
type StoreReviewModule = typeof import('expo-store-review');
type EngagementToast = {
  id: string;
  title: string;
  subtitle: string;
  variant?: 'questComplete';
  persist?: boolean;
};
type IdentityTeaser = { takeId: string; text: string };
type SessionVoteHistoryEntry = { take: Take; vote: 'hot' | 'not' };
type FooterControlButtonProps = {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  ringColor: string;
  strong?: boolean;
  isDarkMode: boolean;
  accessibilityLabel: string;
  baseStyle: StyleProp<ViewStyle>;
  ringedStyle: StyleProp<ViewStyle>;
  strongRingedStyle: StyleProp<ViewStyle>;
  disabledStyle: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

const SESSION_VOTE_HISTORY_LIMIT = 10;
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const QUEST_COMPLETE_SUBTITLES = [
  'You crushed it.',
  'Nicely done.',
  'Quest handled.',
  'Clean finish.',
  'Done and done.',
  'Nailed it.',
  'Good job.',
];

const getDeterministicCopy = (seed: string, options: string[]) => {
  const hash = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return options[hash % options.length];
};

const getQuestCompleteToast = (dateKey: string): EngagementToast => ({
  id: `quest-complete:${dateKey}`,
  title: 'Quest complete!',
  subtitle: getDeterministicCopy(dateKey, QUEST_COMPLETE_SUBTITLES),
  variant: 'questComplete',
});

const getStoredToastArray = async (): Promise<EngagementToast[]> => {
  const rawToasts = await AsyncStorage.getItem(PENDING_TOASTS_KEY);
  if (!rawToasts) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawToasts);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((toast): toast is EngagementToast => (
      toast &&
      typeof toast.id === 'string' &&
      typeof toast.title === 'string' &&
      typeof toast.subtitle === 'string'
    ));
  } catch {
    return [];
  }
};

const getDismissedToastIds = async (): Promise<Set<string>> => {
  const rawIds = await AsyncStorage.getItem(DISMISSED_TOAST_IDS_KEY);
  if (!rawIds) {
    return new Set();
  }

  try {
    const parsed = JSON.parse(rawIds);
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
};

const loadStoreReviewModule = async (): Promise<StoreReviewModule | null> => {
  try {
    return await import('expo-store-review');
  } catch {
    return null;
  }
};

const formatCompactCount = (count: number) => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }

  if (count >= 10000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }

  return count.toLocaleString();
};

const getFooterControlFillColor = (ringColor: string) => {
  if (ringColor.startsWith('rgba(')) {
    return ringColor.replace(/,\s*[\d.]+\)$/, ', 0.36)');
  }

  if (ringColor.startsWith('rgb(')) {
    return ringColor.replace('rgb(', 'rgba(').replace(/\)$/, ', 0.36)');
  }

  if (/^#[0-9a-f]{8}$/i.test(ringColor)) {
    return `${ringColor.slice(0, 7)}5C`;
  }

  if (/^#[0-9a-f]{6}$/i.test(ringColor)) {
    return `${ringColor}5C`;
  }

  return ringColor;
};

const FooterControlButton: React.FC<FooterControlButtonProps> = ({
  children,
  onPress,
  disabled = false,
  ringColor,
  strong = false,
  isDarkMode,
  accessibilityLabel,
  baseStyle,
  ringedStyle,
  strongRingedStyle,
  disabledStyle,
  style,
}) => {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const surfaceColor = isDarkMode ? colors.dark.surface : '#F0F0F1';

  const flashFill = React.useCallback(() => {
    fillAnim.stopAnimation();
    fillAnim.setValue(1);
    Animated.timing(fillAnim, {
      toValue: 0,
      duration: 170,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [fillAnim]);

  const shake = React.useCallback(() => {
    shakeAnim.stopAnimation();
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 45, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 65, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 65, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -0.65, duration: 55, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: false }),
    ]).start();
  }, [shakeAnim]);

  const handlePressIn = React.useCallback(() => {
    if (disabled) {
      return;
    }

    Animated.parallel([
      Animated.timing(pressAnim, {
        toValue: 0.9,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.82,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  }, [disabled, opacityAnim, pressAnim]);

  const handlePressOut = React.useCallback(() => {
    if (disabled) {
      return;
    }

    Animated.parallel([
      Animated.timing(pressAnim, {
        toValue: 1,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  }, [disabled, opacityAnim, pressAnim]);

  const handlePress = React.useCallback(() => {
    if (disabled) {
      shake();
      return;
    }

    flashFill();
    onPress();
  }, [disabled, flashFill, onPress, shake]);

  const animatedStyle = {
    backgroundColor: fillAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [surfaceColor, getFooterControlFillColor(ringColor)],
    }),
    opacity: opacityAnim,
    transform: [
      { scale: pressAnim },
      {
        translateX: shakeAnim.interpolate({
          inputRange: [-1, 1],
          outputRange: [-6, 6],
        }),
      },
    ],
  } as any;

  return (
    <AnimatedTouchableOpacity
      style={[
        baseStyle,
        ringedStyle,
        strong && strongRingedStyle,
        disabled && disabledStyle,
        {
          borderColor: ringColor,
          shadowColor: ringColor,
        },
        animatedStyle,
        style,
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </AnimatedTouchableOpacity>
  );
};

const getChallengeProgressCopy = (
  challenge: DailyChallenge,
  options?: { idPrefix?: string; persist?: boolean }
): EngagementToast => {
  const remaining = Math.max(0, challenge.goal - challenge.progress);
  const idPrefix = options?.idPrefix || 'quest-info';
  const baseToast = {
    id: `${idPrefix}:${challenge.date}:${challenge.type || 'quest'}:${challenge.completed ? 'done' : challenge.progress}`,
    title: `🎯 ${challenge.title || "Today's quest"}`,
    persist: options?.persist ?? false,
  };

  if (challenge.completed) {
    return {
      ...baseToast,
      title: 'Quest complete!',
      subtitle: getDeterministicCopy(challenge.date, QUEST_COMPLETE_SUBTITLES),
      variant: 'questComplete',
    };
  }

  if (challenge.progress <= 0) {
    const categoryLabel = (challenge.categoryLabel || challenge.category || '').toLowerCase();
    const subtitleByType = {
      vote_count: `${challenge.goal} votes. Let's see what you've got.`,
      category_votes: `${challenge.goal} ${categoryLabel || 'category'} votes. Go make some calls.`,
      fresh_votes: `Find ${challenge.goal} fresh takes before the room piles on.`,
      divisive_votes: `Find ${challenge.goal} takes the room can't agree on.`,
      multi_category_votes: `Hit ${challenge.goal} categories. Show some range.`,
    } satisfies Record<NonNullable<DailyChallenge['type']>, string>;

    return {
      ...baseToast,
      subtitle: subtitleByType[challenge.type || 'vote_count'],
    };
  }

  return {
    ...baseToast,
    subtitle: `${remaining} left. You're cooking.`,
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
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [showInviteReviewModal, setShowInviteReviewModal] = useState(false);
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
  const questFooterGlowAnim = useRef(new Animated.Value(0)).current;
  const toastQueueRef = useRef<EngagementToast[]>([]);
  const currentToastRef = useRef<EngagementToast | null>(null);
  const toastAnimatingRef = useRef(false);
  const toastDismissingRef = useRef(false);
  const dismissedToastIdsRef = useRef<Set<string>>(new Set());
  const changeVoteTakeIdsRef = useRef<Set<string>>(new Set());
  const changeVoteDeletePromisesRef = useRef<Map<string, Promise<boolean>>>(new Map());
  const leaderboardPrefetchStartedRef = useRef(false);
  const leaderboardPrefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const favoritesPrefetchStartedRef = useRef(false);
  const favoritesPrefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationPermissionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationPermissionPendingRef = useRef(false);
  const reviewPromptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewPromptPendingContextRef = useRef<{
    totalVotes: number;
    currentStreak: number;
  } | null>(null);
  const reviewPromptInFlightRef = useRef(false);
  const identityTeaserShownRef = useRef(false);
  const lastIdentityTeaserRef = useRef<string | null>(null);
  const onboardingCompletingRef = useRef(false);
  const shownStreakToastDatesRef = useRef<Set<string>>(new Set());
  const firstVoteHintMarkedRef = useRef(false);
  const { user, loading: authLoading, signIn } = useAuth();
  const { takes, loading: takesLoading, error: takesError, submitVote, skipTake, refreshTakes, loadMore, hasMore, prependTake, removeTakeLocally } = useFirebaseTakes({
    category: selectedCategory
  });
  const { stats, loading: statsLoading, hydrated: statsHydrated, refreshStats, applyEngagementUpdate } = useUserStats();
  const votingProfileState = useVotingProfile(user?.uid, stats.totalVotes, showVotingStyleModal);
  const statsRef = useRef(stats);

  // Use the hook-based interstitial ads
  const { onCardComplete, onSessionEnd } = useInterstitialAds();

  const theme = isDarkMode ? colors.dark : colors.light;

  // Get responsive dimensions for this device profile
  const responsive = useResponsive();
  const insets = useSafeAreaInsets();

  // Create responsive styles
  const styles = useMemo(() => createStyles(responsive, insets), [responsive, insets]);
  const onboardingActive = onboardingChecked && showOnboardingCard;
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
      return `🔥 ${stats.votingStreak}-day streak is on the board`;
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

  const shouldGlowQuestFooter =
    !stats.dailyChallenge.completed;

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    questFooterGlowAnim.stopAnimation();

    if (!shouldGlowQuestFooter) {
      questFooterGlowAnim.setValue(0);
      return;
    }

    questFooterGlowAnim.setValue(0);
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(questFooterGlowAnim, {
          toValue: 1,
          duration: 1350,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(questFooterGlowAnim, {
          toValue: 0,
          duration: 1350,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [questFooterGlowAnim, shouldGlowQuestFooter]);

  const syncNotificationReminders = React.useCallback((nextStats = statsRef.current) => {
    if (!user?.uid || authLoading || statsLoading || !statsHydrated) {
      return;
    }

    if (notificationSyncTimeoutRef.current) {
      clearTimeout(notificationSyncTimeoutRef.current);
    }

    notificationSyncTimeoutRef.current = setTimeout(() => {
      notificationSyncTimeoutRef.current = null;

      InteractionManager.runAfterInteractions(() => {
        syncDailyReminderNotifications(user.uid, nextStats).catch(error => {
          console.warn('Unable to sync notification reminders:', error);
        });
      });
    }, 1800);
  }, [authLoading, statsHydrated, statsLoading, user?.uid]);

  const maybeRequestStoreReview = React.useCallback(async ({
    totalVotes,
    currentStreak,
  }: {
    totalVotes: number;
    currentStreak: number;
  }) => {
    if (reviewPromptInFlightRef.current || totalVotes < 10 || currentStreak < 2) {
      return;
    }

    reviewPromptInFlightRef.current = true;

    try {
      const alreadyAttempted = await AsyncStorage.getItem(REVIEW_PROMPT_ATTEMPTED_KEY);
      if (alreadyAttempted === 'true') {
        return;
      }

      const StoreReview = await loadStoreReviewModule();
      if (!StoreReview) {
        return;
      }

      const isAvailable = await StoreReview.isAvailableAsync();
      if (!isAvailable) {
        return;
      }

      const hasAction = await StoreReview.hasAction();
      if (!hasAction) {
        return;
      }

      await AsyncStorage.setItem(REVIEW_PROMPT_ATTEMPTED_KEY, 'true');
      await StoreReview.requestReview();
    } catch {
      // Store review prompts are opportunistic; never interrupt the gameplay flow.
    } finally {
      reviewPromptInFlightRef.current = false;
    }
  }, []);

  const runPendingNotificationPermissionRequest = React.useCallback(() => {
    if (
      !notificationPermissionPendingRef.current ||
      notificationPermissionTimeoutRef.current ||
      toastAnimatingRef.current ||
      toastQueueRef.current.length > 0
    ) {
      return;
    }

    notificationPermissionPendingRef.current = false;
    notificationPermissionTimeoutRef.current = setTimeout(async () => {
      notificationPermissionTimeoutRef.current = null;

      try {
        const granted = await requestNotificationsAfterQuestCompletion();
        if (granted) {
          syncNotificationReminders(statsRef.current);
        }
      } catch (error) {
        console.warn('Unable to request notification permissions:', error);
      }
    }, 700);
  }, [syncNotificationReminders]);

  const runPendingQuestCompletionFollowups = React.useCallback(() => {
    if (
      toastAnimatingRef.current ||
      toastQueueRef.current.length > 0 ||
      reviewPromptTimeoutRef.current
    ) {
      return;
    }

    const pendingReviewContext = reviewPromptPendingContextRef.current;
    if (pendingReviewContext) {
      reviewPromptPendingContextRef.current = null;
      reviewPromptTimeoutRef.current = setTimeout(async () => {
        reviewPromptTimeoutRef.current = null;
        await maybeRequestStoreReview(pendingReviewContext);
        runPendingNotificationPermissionRequest();
      }, 1500);
      return;
    }

    runPendingNotificationPermissionRequest();
  }, [maybeRequestStoreReview, runPendingNotificationPermissionRequest]);

  const requestStoreReviewAfterQuestCompletion = React.useCallback((context: {
    totalVotes: number;
    currentStreak: number;
  }) => {
    reviewPromptPendingContextRef.current = context;
    runPendingQuestCompletionFollowups();
  }, [runPendingQuestCompletionFollowups]);

  const requestNotificationsForCompletedQuest = React.useCallback(() => {
    notificationPermissionPendingRef.current = true;
    runPendingQuestCompletionFollowups();
  }, [runPendingQuestCompletionFollowups]);


  const notificationStatsKey = useMemo(() => {
    const challenge = stats.dailyChallenge;
    return [
      challenge.date,
      challenge.progress,
      challenge.goal,
      challenge.completed ? 'done' : 'open',
      stats.votingStreak,
      stats.streakUpdatedToday ? 'updated' : 'open',
    ].join(':');
  }, [stats.dailyChallenge, stats.streakUpdatedToday, stats.votingStreak]);

  useEffect(() => {
    syncNotificationReminders(stats);
  }, [notificationStatsKey, syncNotificationReminders]);

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    const launchFlushTimeout = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        flushVoteOutbox().catch(error => {
          console.warn('Unable to flush queued votes on launch:', error);
        });
      });
    }, 2500);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        InteractionManager.runAfterInteractions(() => {
          flushVoteOutbox().catch(error => {
            console.warn('Unable to flush queued votes on foreground:', error);
          });
        });
        syncNotificationReminders(statsRef.current);
      }
    });

    return () => {
      clearTimeout(launchFlushTimeout);
      subscription.remove();
    };
  }, [syncNotificationReminders, user?.uid]);

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
      InteractionManager.runAfterInteractions(() => {
        prefetchLeaderboardCache().catch(error => {
          console.warn('Unable to prefetch leaderboards:', error);
        });
      });
    }, 8500);
  }, [authLoading, user]);

  const scheduleFavoritesPrefetch = React.useCallback(() => {
    if (!user || authLoading || favoritesPrefetchStartedRef.current || favoritesPrefetchTimeoutRef.current) {
      return;
    }

    favoritesPrefetchTimeoutRef.current = setTimeout(() => {
      favoritesPrefetchTimeoutRef.current = null;
      if (favoritesPrefetchStartedRef.current) {
        return;
      }

      favoritesPrefetchStartedRef.current = true;
      InteractionManager.runAfterInteractions(() => {
        prefetchUserFavoritesCache(user.uid).catch(error => {
          console.warn('Unable to prefetch favorites:', error);
        });
      });
    }, 11000);
  }, [authLoading, user]);

  React.useEffect(() => {
    return () => {
      if (leaderboardPrefetchTimeoutRef.current) {
        clearTimeout(leaderboardPrefetchTimeoutRef.current);
        leaderboardPrefetchTimeoutRef.current = null;
      }
      if (favoritesPrefetchTimeoutRef.current) {
        clearTimeout(favoritesPrefetchTimeoutRef.current);
        favoritesPrefetchTimeoutRef.current = null;
      }
      if (notificationSyncTimeoutRef.current) {
        clearTimeout(notificationSyncTimeoutRef.current);
        notificationSyncTimeoutRef.current = null;
      }
      if (notificationPermissionTimeoutRef.current) {
        clearTimeout(notificationPermissionTimeoutRef.current);
        notificationPermissionTimeoutRef.current = null;
      }
      if (reviewPromptTimeoutRef.current) {
        clearTimeout(reviewPromptTimeoutRef.current);
        reviewPromptTimeoutRef.current = null;
      }
      notificationPermissionPendingRef.current = false;
      reviewPromptPendingContextRef.current = null;
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
      if (showAchievementsModal) {
        setShowAchievementsModal(false);
        return true;
      }
      if (showInviteReviewModal) {
        setShowInviteReviewModal(false);
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
  }, [showSubmitModal, showRecentVotesModal, showFavoritesModal, showVotingStyleModal, showAchievementsModal, showInviteReviewModal, showLeaderboardModal, showMyTakesModal, showInstructionsModal, showSafetyModal, selectedTakeForStats]);

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

  const persistPendingToasts = React.useCallback(async () => {
    const pendingToasts = [
      currentToastRef.current,
      ...toastQueueRef.current,
    ].filter((toast): toast is EngagementToast => {
      if (!toast) {
        return false;
      }

      return toast.persist !== false && !dismissedToastIdsRef.current.has(toast.id);
    });

    try {
      if (pendingToasts.length > 0) {
        await AsyncStorage.setItem(PENDING_TOASTS_KEY, JSON.stringify(pendingToasts));
      } else {
        await AsyncStorage.removeItem(PENDING_TOASTS_KEY);
      }
    } catch (error) {
      console.warn('Unable to persist toast queue:', error);
    }
  }, []);

  const processToastQueue = React.useCallback(() => {
    if (toastAnimatingRef.current) {
      return;
    }

    let nextToast = toastQueueRef.current.shift();
    while (
      nextToast &&
      nextToast.persist !== false &&
      dismissedToastIdsRef.current.has(nextToast.id)
    ) {
      nextToast = toastQueueRef.current.shift();
    }

    if (!nextToast) {
      void persistPendingToasts();
      runPendingQuestCompletionFollowups();
      return;
    }

    toastAnimatingRef.current = true;
    toastDismissingRef.current = false;
    currentToastRef.current = nextToast;
    setStreakToast(nextToast);
    streakToastAnim.stopAnimation();
    streakToastAnim.setValue(0);
    Animated.spring(streakToastAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: motion.spring.press.damping,
      stiffness: motion.spring.press.stiffness,
    }).start(() => {
      void persistPendingToasts();
    });
  }, [persistPendingToasts, runPendingQuestCompletionFollowups, streakToastAnim]);

  const enqueueToast = React.useCallback((toast: EngagementToast) => {
    const existingToastIds = new Set([
      currentToastRef.current?.id,
      ...toastQueueRef.current.map(queuedToast => queuedToast.id),
    ]);

    if (
      existingToastIds.has(toast.id) ||
      (toast.persist !== false && dismissedToastIdsRef.current.has(toast.id))
    ) {
      return;
    }

    toastQueueRef.current.push(toast);
    void persistPendingToasts();
    processToastQueue();
  }, [persistPendingToasts, processToastQueue]);

  const dismissCurrentToast = React.useCallback(() => {
    const toast = currentToastRef.current;
    if (!toast || toastDismissingRef.current) {
      return;
    }

    toastDismissingRef.current = true;
    if (toast.persist !== false) {
      dismissedToastIdsRef.current.add(toast.id);
      AsyncStorage.setItem(
        DISMISSED_TOAST_IDS_KEY,
        JSON.stringify(Array.from(dismissedToastIdsRef.current))
      ).catch(error => {
        console.warn('Unable to persist dismissed toast:', error);
      });
    }

    streakToastAnim.stopAnimation();
    Animated.timing(streakToastAnim, {
      toValue: 0,
      duration: motion.duration.fadeOut,
      useNativeDriver: true,
    }).start(() => {
      setStreakToast(null);
      currentToastRef.current = null;
      toastAnimatingRef.current = false;
      toastDismissingRef.current = false;
      void persistPendingToasts();
      setTimeout(processToastQueue, 80);
    });
  }, [persistPendingToasts, processToastQueue, streakToastAnim]);

  useEffect(() => {
    let cancelled = false;

    const hydratePendingToasts = async () => {
      try {
        const [dismissedToastIds, pendingToasts] = await Promise.all([
          getDismissedToastIds(),
          getStoredToastArray(),
        ]);
        if (cancelled) {
          return;
        }

        dismissedToastIdsRef.current = dismissedToastIds;
        const queuedToastIds = new Set(toastQueueRef.current.map(toast => toast.id));
        pendingToasts.forEach(toast => {
          if (!dismissedToastIds.has(toast.id) && !queuedToastIds.has(toast.id)) {
            toastQueueRef.current.push(toast);
            queuedToastIds.add(toast.id);
          }
        });
        void persistPendingToasts();
        processToastQueue();
      } catch (error) {
        console.warn('Unable to hydrate pending toasts:', error);
      }
    };

    hydratePendingToasts();

    return () => {
      cancelled = true;
    };
  }, [persistPendingToasts, processToastQueue]);

  const showStreakToast = React.useCallback((streakUpdate: StreakUpdateResult) => {
    if (shownStreakToastDatesRef.current.has(streakUpdate.lastStreakDate)) {
      return;
    }

    shownStreakToastDatesRef.current.add(streakUpdate.lastStreakDate);

    const isMilestone = Boolean(streakUpdate.milestoneReached);
    const isFirstDay = streakUpdate.currentStreak === 1;

    enqueueToast({
      id: `streak:${streakUpdate.lastStreakDate}:${streakUpdate.currentStreak}`,
      title: isMilestone
        ? `🔥 ${streakUpdate.currentStreak}-day streak!`
        : isFirstDay
          ? '🔥 Streak started!'
          : `🔥 ${streakUpdate.currentStreak} days straight!`,
      subtitle: isMilestone
        ? "That's commitment."
        : isFirstDay
          ? 'Day one is locked.'
          : "You're on a roll.",
    });
  }, [enqueueToast]);

  const showStreakInfo = React.useCallback(() => {
    if (stats.votingStreak <= 0) {
      enqueueToast({
        id: 'streak-info:none',
        title: '🔥 Daily streak',
        subtitle: 'One vote starts the flame.',
        persist: false,
      });
      return;
    }

    enqueueToast({
      id: `streak-info:${stats.lastStreakDate || 'none'}:${stats.streakUpdatedToday ? 'done' : 'open'}`,
      title: stats.streakUpdatedToday
        ? `🔥 ${stats.votingStreak} days straight!`
        : `🔥 ${stats.votingStreak}-day streak`,
      subtitle: stats.streakUpdatedToday
        ? 'Today is locked.'
        : 'One vote keeps it alive.',
      persist: false,
    });
  }, [enqueueToast, stats.lastStreakDate, stats.streakUpdatedToday, stats.votingStreak]);

  const showChallengeInfo = React.useCallback(() => {
    const challenge = stats.dailyChallenge;
    const copy = getChallengeProgressCopy(challenge);

    enqueueToast(copy);
  }, [enqueueToast, stats.dailyChallenge]);

  const showCommunityInfo = React.useCallback(() => {
    enqueueToast({
      id: `community-info:${communityTotalVotes}`,
      title: `👥 ${communityTotalVotes.toLocaleString()} community votes`,
      subtitle: 'The room is alive.',
      persist: false,
    });
  }, [communityTotalVotes, enqueueToast]);

  useEffect(() => {
    if (
      onboardingActive ||
      !user ||
      authLoading ||
      statsLoading ||
      !statsHydrated ||
      stats.dailyChallenge.completed
    ) {
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

        const copy = getChallengeProgressCopy(challenge, {
          idPrefix: `quest-nudge:${user.uid}`,
          persist: true,
        });
        enqueueToast(copy);
      } catch (error) {
        console.warn('Unable to show daily challenge nudge:', error);
      }
    };

    const timeout = setTimeout(showDailyChallengeNudge, 900);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [authLoading, enqueueToast, onboardingActive, stats.dailyChallenge, statsHydrated, statsLoading, user]);

  useEffect(() => {
    if (!user || !statsHydrated) {
      return;
    }

    backfillUnlockedAchievements(stats).catch(error => {
      console.warn('Unable to backfill local achievements:', error);
    });
  }, [stats, statsHydrated, user]);

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
      const voteContext = {
        category: votedTake?.category,
        totalVotesBefore: votedTake?.totalVotes,
        hotVotesAfter,
        notVotesAfter,
        totalVotesAfter,
      };
      const streakUpdate = buildOptimisticVoteEngagementUpdate(statsRef.current, {
        category: votedTake?.category,
        countDailyEngagement: !isVoteChange,
        voteContext,
      });

      submitVote(takeId, vote, {
        countDailyEngagement: !isVoteChange,
      }).catch(error => {
        console.warn('Unable to queue vote write:', error);
      });
      changeVoteTakeIdsRef.current.delete(takeId);

      if (!isVoteChange && streakUpdate?.totalVotes === 1) {
        showFirstVoteHint(takeId);
      }

      // Track completed card for ad service (called after vote is cast)
      onCardComplete();
      scheduleLeaderboardPrefetch();
      scheduleFavoritesPrefetch();
      if (streakUpdate?.didUpdateToday) {
        applyEngagementUpdate(streakUpdate);
        showStreakToast(streakUpdate);
      }
      if (streakUpdate?.challengeCompleted) {
        if (!streakUpdate.didUpdateToday) {
          applyEngagementUpdate(streakUpdate);
        }
        enqueueToast(getQuestCompleteToast(streakUpdate.dailyChallenge?.date || statsRef.current.dailyChallenge.date));
        requestStoreReviewAfterQuestCompletion({
          totalVotes: streakUpdate.totalVotes ?? statsRef.current.totalVotes,
          currentStreak: streakUpdate.currentStreak,
        });
        requestNotificationsForCompletedQuest();
      } else if (streakUpdate && !streakUpdate.didUpdateToday) {
        applyEngagementUpdate(streakUpdate);
      }
      streakUpdate?.achievementToasts?.forEach(achievementToast => {
        unlockAchievementFromToast(achievementToast).catch(error => {
          console.warn('Unable to unlock achievement:', error);
        });
        enqueueToast({
          id: `achievement:${achievementToast.id}`,
          title: achievementToast.title,
          subtitle: achievementToast.subtitle,
        });
      });
      if (streakUpdate?.milestoneReached && user?.uid) {
        scheduleStreakMilestoneNotification(user.uid, streakUpdate.milestoneReached).catch(error => {
          console.warn('Unable to schedule streak milestone notification:', error);
        });
      }
      if (streakUpdate) {
        const nextStats = {
          ...statsRef.current,
          totalVotes: streakUpdate.totalVotes ?? statsRef.current.totalVotes,
          votingStreak: streakUpdate.currentStreak,
          longestVotingStreak: streakUpdate.longestVotingStreak,
          totalStreakDays: streakUpdate.totalStreakDays,
          lastStreakDate: streakUpdate.lastStreakDate,
          streakUpdatedToday: true,
          dailyChallenge: streakUpdate.dailyChallenge || statsRef.current.dailyChallenge,
        };
        statsRef.current = nextStats;
        syncNotificationReminders(nextStats);
      }
      // Reconcile secondary stats after interactions so gameplay stays snappy.
      setTimeout(() => {
        InteractionManager.runAfterInteractions(() => {
          flushVoteOutbox()
            .then(refreshStats)
            .catch(error => {
              console.warn('Unable to reconcile user stats after vote:', error);
            });
          refreshCommunityStats();
        });
      }, 1400);

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
      scheduleFavoritesPrefetch();
      // Refresh stats later so skip animation is never waiting on Firestore.
      setTimeout(() => {
        InteractionManager.runAfterInteractions(() => {
          flushVoteOutbox()
            .then(refreshStats)
            .catch(error => {
              console.warn('Unable to reconcile user stats after skip:', error);
            });
        });
      }, 650);
    } catch (error) {
      console.error('Error skipping take:', error);
      // Could show a toast notification here
    }
  };

  const handleInviteFriends = React.useCallback(async () => {
    try {
      const inviteMessage = `Try Hot or Not Takes - Vote on spicy hot takes! 🔥 ${SMART_LINK}`;

      await RNShare.open({
        title: 'Invite Friends to Hot or Not Takes',
        message: inviteMessage,
        failOnCancel: false,
      });
    } catch (error) {
    }
  }, []);

  const openStoreReviewPage = React.useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        try {
          await Linking.openURL(ANDROID_MARKET_URL);
        } catch (marketError) {
          await Linking.openURL(ANDROID_PLAY_URL);
        }
        return;
      }

      await Linking.openURL(IOS_REVIEW_URL);
    } catch (error) {
    }
  }, []);

  const openInviteReview = React.useCallback(() => {
    setShowInviteReviewModal(true);
  }, []);

  const closeInviteReview = React.useCallback(() => {
    setShowInviteReviewModal(false);
  }, []);

  const handleInviteOption = React.useCallback(() => {
    closeInviteReview();
    setTimeout(handleInviteFriends, 100);
  }, [closeInviteReview, handleInviteFriends]);

  const handleReviewOption = React.useCallback(() => {
    closeInviteReview();
    setTimeout(openStoreReviewPage, 100);
  }, [closeInviteReview, openStoreReviewPage]);

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
  const openAchievements = React.useCallback(() => setShowAchievementsModal(true), []);

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
        id: `admin-remove:${adminRemovalTake.id}`,
        title: 'Removed from feed',
        subtitle: 'This take was rejected and will no longer appear for users.',
        persist: false,
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
      <View
        pointerEvents={onboardingActive ? 'none' : 'auto'}
        style={[
          styles.fixedHeader,
          onboardingActive && styles.onboardingBackgroundMuted,
        ]}
      >
        <View style={styles.headerRow}>
          <BurgerMenu
            isDarkMode={isDarkMode}
            onAchievements={openAchievements}
            onMyTakes={openMyTakes}
            onLeaderboard={openLeaderboard}
            onRecentVotes={openRecentVotes}
            onFavorites={openFavorites}
            onInstructions={openInstructions}
            onInviteFriends={openInviteReview}
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
      <View
        pointerEvents={onboardingActive ? 'none' : 'auto'}
        style={[
          styles.fixedFooter,
          onboardingActive && styles.onboardingBackgroundMuted,
        ]}
      >
        {/* Bottom Buttons Row */}
        <View style={styles.bottomButtonsRow}>
          {/* Voting Style Button */}
          <FooterControlButton
            onPress={openVotingStyle}
            ringColor={theme.accent}
            strong
            isDarkMode={isDarkMode}
            accessibilityLabel="Open my voting style"
            baseStyle={styles.bottomButton}
            ringedStyle={styles.ringedFooterButton}
            strongRingedStyle={styles.strongRingedFooterButton}
            disabledStyle={styles.disabledControl}
          >
            <Text style={styles.buttonIcon}>🧭</Text>
          </FooterControlButton>

          {/* Last Vote Button */}
          <FooterControlButton
            onPress={handleShowLastVote}
            disabled={!canRewind}
            ringColor={isDarkMode ? 'rgba(116, 185, 255, 0.82)' : 'rgba(116, 185, 255, 0.72)'}
            isDarkMode={isDarkMode}
            style={styles.coolFooterButton}
            accessibilityLabel="Show previous result"
            baseStyle={styles.bottomButton}
            ringedStyle={styles.ringedFooterButton}
            strongRingedStyle={styles.strongRingedFooterButton}
            disabledStyle={styles.disabledControl}
          >
            <Text style={[styles.buttonIcon, isDarkMode && { color: theme.text }]}>↩️</Text>
          </FooterControlButton>

          {/* Skip Button */}
          <FooterControlButton
            onPress={() => {
              if (takes[0]) {
                setSkipRequestToken(prev => prev + 1);
              }
            }}
            disabled={!takes[0]}
            ringColor={isDarkMode ? theme.accent + 'CC' : theme.accent + 'AA'}
            isDarkMode={isDarkMode}
            accessibilityLabel="Skip this take"
            baseStyle={styles.bottomButton}
            ringedStyle={styles.ringedFooterButton}
            strongRingedStyle={styles.strongRingedFooterButton}
            disabledStyle={styles.disabledControl}
          >
            <Text style={[styles.buttonIcon, isDarkMode ? { color: theme.text } : { color: '#333' }]}>⏭️</Text>
          </FooterControlButton>

          {/* Submit Button */}
          <FooterControlButton
            onPress={() => setShowSubmitModal(true)}
            ringColor={theme.primary}
            strong
            isDarkMode={isDarkMode}
            accessibilityLabel="Submit a hot take"
            baseStyle={styles.bottomButton}
            ringedStyle={styles.ringedFooterButton}
            strongRingedStyle={styles.strongRingedFooterButton}
            disabledStyle={styles.disabledControl}
          >
            <Text style={styles.buttonIcon}>✏️</Text>
          </FooterControlButton>
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
              {shouldGlowQuestFooter && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.questSegmentGlow,
                    {
                      backgroundColor: isDarkMode
                        ? 'rgba(255, 165, 2, 0.18)'
                        : 'rgba(255, 165, 2, 0.12)',
                      borderColor: isDarkMode
                        ? 'rgba(255, 165, 2, 0.58)'
                        : 'rgba(255, 165, 2, 0.34)',
                      opacity: questFooterGlowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.28, 0.9],
                      }),
                      transform: [
                        {
                          scale: questFooterGlowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.96, 1.08],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              )}
              <Text
                style={[styles.voteCounterText, { color: shouldGlowQuestFooter ? theme.accent : theme.textSecondary }]}
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

      {streakToast && (() => {
        const isQuestCompleteToast = streakToast.variant === 'questComplete';
        const toastBackgroundColor = isQuestCompleteToast
          ? (isDarkMode ? '#183326' : '#EAF8EF')
          : (isDarkMode ? '#3A3020' : '#FFF6E2');
        const toastBorderColor = isQuestCompleteToast
          ? (isDarkMode ? 'rgba(52, 211, 153, 0.78)' : '#69D68A')
          : (isDarkMode ? 'rgba(255, 165, 2, 0.68)' : '#FFD88A');
        const toastTitleColor = isQuestCompleteToast ? theme.success : theme.text;
        const toastSubtitleColor = isQuestCompleteToast
          ? (isDarkMode ? '#BDF4D0' : '#23633B')
          : (isDarkMode ? '#F3DDB8' : theme.textSecondary);

        return (
          <>
            <Pressable
              style={styles.toastDismissOverlay}
              onPress={dismissCurrentToast}
              accessibilityRole="button"
              accessibilityLabel="Dismiss message"
            />
            <Animated.View
              style={[
                styles.streakToast,
                {
                  backgroundColor: toastBackgroundColor,
                  borderColor: toastBorderColor,
                  borderWidth: isQuestCompleteToast ? 1.5 : 1.25,
                  shadowColor: isQuestCompleteToast ? theme.success : (isDarkMode ? theme.accent : '#000'),
                  shadowOpacity: isQuestCompleteToast ? (isDarkMode ? 0.42 : 0.26) : 0.28,
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
              <Pressable
                style={[
                  styles.streakToastCloseButton,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.13)' : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
                onPress={dismissCurrentToast}
                accessibilityRole="button"
                accessibilityLabel="Dismiss message"
                hitSlop={8}
              >
                <Text style={[styles.streakToastCloseText, { color: isDarkMode ? '#FFFFFF' : '#4A4A4A' }]}>×</Text>
              </Pressable>
              <Text style={[styles.streakToastTitle, { color: toastTitleColor }]}>
                {streakToast.title}
              </Text>
              <Text style={[styles.streakToastSubtitle, { color: toastSubtitleColor }]}>
                {streakToast.subtitle}
              </Text>
            </Animated.View>
          </>
        );
      })()}

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

      <Modal
        visible={showInviteReviewModal}
        transparent
        animationType="fade"
        onRequestClose={closeInviteReview}
      >
        <View style={styles.inviteReviewBackdrop}>
          <View style={[
            styles.inviteReviewCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}>
            <View style={styles.inviteReviewHeader}>
              <Text style={[styles.inviteReviewTitle, { color: theme.text }]}>
                Invite & Review
              </Text>
              <TouchableOpacity
                style={styles.inviteReviewCloseButton}
                onPress={closeInviteReview}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="Close invite and review"
              >
                <Text style={[styles.inviteReviewCloseText, { color: theme.textSecondary }]}>
                  ×
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.inviteReviewSubtitle, { color: theme.textSecondary }]}>
              Share the game or leave a quick rating.
            </Text>
            <View style={styles.inviteReviewActions}>
              <TouchableOpacity
                style={[
                  styles.inviteReviewAction,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255, 165, 2, 0.14)' : '#FFF4D8',
                    borderColor: theme.accent,
                  },
                ]}
                onPress={handleInviteOption}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel="Invite a friend"
              >
                <Text style={styles.inviteReviewActionIcon}>💌</Text>
                <Text style={[styles.inviteReviewActionText, { color: theme.text }]}>
                  Invite a friend
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.inviteReviewAction,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255, 71, 87, 0.14)' : '#FFECEF',
                    borderColor: theme.primary,
                  },
                ]}
                onPress={handleReviewOption}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel="Rate the app"
              >
                <Text style={styles.inviteReviewActionIcon}>⭐</Text>
                <Text style={[styles.inviteReviewActionText, { color: theme.text }]}>
                  Rate the app
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

      {/* Achievements Modal - Conditional Rendering */}
      {showAchievementsModal && (
        <FullScreenOverlay zIndex={1760}>
          <AchievementsScreen
            onClose={() => setShowAchievementsModal(false)}
            isDarkMode={isDarkMode}
            stats={stats}
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
  onboardingBackgroundMuted: {
    opacity: 0.38,
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
    position: 'relative',
  },
  questSegmentGlow: {
    position: 'absolute',
    left: -responsive.spacing.xs,
    right: -responsive.spacing.xs,
    top: 6,
    bottom: 6,
    borderRadius: 999,
    borderWidth: 1,
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
    borderWidth: 1.25,
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
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  toastDismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2999,
    elevation: 7,
  },
  streakToastCloseButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakToastCloseText: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: -1,
  },
  streakToastTitle: {
    fontSize: responsive.fontSize.medium,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: responsive.spacing.lg,
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
  inviteReviewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsive.spacing.xl,
    zIndex: 5000,
  },
  inviteReviewCard: {
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
    shadowOpacity: 0.24,
    shadowRadius: 16,
  },
  inviteReviewHeader: {
    minHeight: motion.touchTarget.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteReviewTitle: {
    fontSize: responsive.fontSize.large,
    fontWeight: '900',
    textAlign: 'center',
  },
  inviteReviewCloseButton: {
    position: 'absolute',
    right: -responsive.spacing.xs,
    width: motion.touchTarget.minimum,
    height: motion.touchTarget.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteReviewCloseText: {
    fontSize: responsive.fontSize.xlarge,
    fontWeight: '800',
    lineHeight: responsive.fontSize.xlarge + 2,
  },
  inviteReviewSubtitle: {
    fontSize: responsive.fontSize.small,
    fontWeight: '700',
    lineHeight: responsive.fontSize.small * 1.3,
    textAlign: 'center',
    marginBottom: responsive.spacing.md,
  },
  inviteReviewActions: {
    flexDirection: 'row',
    gap: responsive.spacing.sm,
  },
  inviteReviewAction: {
    flex: 1,
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsive.spacing.sm,
    paddingVertical: responsive.spacing.md,
  },
  inviteReviewActionIcon: {
    fontSize: responsive.fontSize.xlarge,
    marginBottom: responsive.spacing.xs,
  },
  inviteReviewActionText: {
    fontSize: responsive.fontSize.small,
    fontWeight: '900',
    textAlign: 'center',
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
