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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomSwipeableCardDeck } from '../components/CustomSwipeableCardDeck';
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
import { useAuth, useFirebaseTakes, useUserStats } from '../hooks';
import { useResponsive } from '../hooks/useResponsive';
import { deleteVote, getUserVoteForTake } from '../services/voteService';
import { getCommunityStats } from '../services/userService';
import { prefetchLeaderboardCache } from '../services/leaderboardCacheService';
import { useInterstitialAds } from '../hooks/useInterstitialAds';
import { colors, motion } from '../constants';
import { StreakUpdateResult } from '../types';
import RNShare from 'react-native-share';

const THEME_PREFERENCE_KEY = 'themePreference';
const RESULTS_AUTOPLAY_PREFERENCE_KEY = 'resultsAutoplayPreference';
const DAILY_CHALLENGE_NUDGE_PREFIX = 'dailyChallengeNudgeShown';
const COMMUNITY_STATS_CACHE_KEY = 'community-stats-cache:v1';
type EngagementToast = { title: string; subtitle: string };

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
  const [selectedTakeForStats, setSelectedTakeForStats] = useState<{take: any, vote: 'hot' | 'not' | null} | null>(null);
  const [lastVotedTake, setLastVotedTake] = useState<any | null>(null);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null); // null = loading
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [myTakesRefreshTrigger, setMyTakesRefreshTrigger] = useState<number>(0);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [communityTotalVotes, setCommunityTotalVotes] = useState<number>(0);
  const [streakToast, setStreakToast] = useState<EngagementToast | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const streakToastAnim = useRef(new Animated.Value(0)).current;
  const toastQueueRef = useRef<EngagementToast[]>([]);
  const toastAnimatingRef = useRef(false);
  const changeVoteTakeIdsRef = useRef<Set<string>>(new Set());
  const changeVoteDeletePromisesRef = useRef<Map<string, Promise<boolean>>>(new Map());
  const leaderboardPrefetchStartedRef = useRef(false);
  const { user, loading: authLoading, signIn } = useAuth();
  const { takes, loading: takesLoading, error: takesError, submitVote, skipTake, refreshTakes, loadMore, hasMore, prependTake } = useFirebaseTakes({
    category: selectedCategory
  });
  const { stats, loading: statsLoading, refreshStats } = useUserStats();
  
  // Use the hook-based interstitial ads
  const { onCardComplete, onSessionEnd } = useInterstitialAds();
  
  const theme = isDarkMode ? colors.dark : colors.light;
  
  // Get responsive dimensions for this device profile
  const responsive = useResponsive();
  const insets = useSafeAreaInsets();
  
  // Create responsive styles
  const styles = useMemo(() => createStyles(responsive, insets), [responsive, insets]);

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
    "Swipe right for 🔥 HOT • Swipe left for ❄️ NOT",
    streakInstructionText,
    "Swipe up ⬆️ or down ⬇️ to SKIP",
    "🚀 More swipes = fewer ads!",
    "☰ Tap the menu button for more options",
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

  // Check if this is the first launch
  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const hasLaunchedBefore = await AsyncStorage.getItem('hasLaunchedBefore');
        if (!hasLaunchedBefore) {
          // First launch - show instructions and mark as launched
          setIsFirstLaunch(true);
          setShowInstructionsModal(true);
          await AsyncStorage.setItem('hasLaunchedBefore', 'true');
        } else {
          // Not first launch
          setIsFirstLaunch(false);
        }
      } catch (error) {
        console.error('Error checking first launch:', error);
        setIsFirstLaunch(false); // Default to not showing instructions on error
      }
    };

    checkFirstLaunch();
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

  React.useEffect(() => {
    if (!user || authLoading || takesLoading || leaderboardPrefetchStartedRef.current) {
      return;
    }

    const timeout = setTimeout(() => {
      if (leaderboardPrefetchStartedRef.current) {
        return;
      }

      leaderboardPrefetchStartedRef.current = true;
      prefetchLeaderboardCache().catch(error => {
        console.warn('Unable to prefetch leaderboards:', error);
      });
    }, 1800);

    return () => clearTimeout(timeout);
  }, [authLoading, takesLoading, user]);

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
  }, [showSubmitModal, showRecentVotesModal, showFavoritesModal, showLeaderboardModal, showMyTakesModal, showInstructionsModal, showSafetyModal, selectedTakeForStats]);

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

  const handleVote = async (takeId: string, vote: 'hot' | 'not') => {
    try {
      // Find the take that was voted on
      const votedTake = takes.find(take => take.id === takeId);
      const isVoteChange = changeVoteTakeIdsRef.current.has(takeId);
      const pendingVoteDelete = changeVoteDeletePromisesRef.current.get(takeId);

      if (pendingVoteDelete) {
        const deleteSucceeded = await pendingVoteDelete;
        if (!deleteSucceeded) {
          throw new Error('Previous vote is still being updated');
        }
      }
      
      const streakUpdate = await submitVote(takeId, vote, {
        countDailyEngagement: !isVoteChange,
      });
      changeVoteTakeIdsRef.current.delete(takeId);
      // Track completed card for ad service (called after vote is cast)
      onCardComplete();
      // Update vote counter immediately
      await refreshStats();
      if (streakUpdate?.didUpdateToday) {
        showStreakToast(streakUpdate);
      }
      if (streakUpdate?.challengeCompleted) {
        enqueueToast({
          title: '🎯 Challenge complete!',
          subtitle: `${streakUpdate.dailyChallenge?.title || "Today's quest"} is done. Come back tomorrow.`,
        });
      }
      streakUpdate?.achievementToasts?.forEach(enqueueToast);
      // Also refresh community stats
      await refreshCommunityStats();
      
      // Set lastVotedTake with updated vote counts after vote submission
      if (votedTake) {
        const updatedHotVotes = vote === 'hot' ? votedTake.hotVotes + 1 : votedTake.hotVotes;
        const updatedNotVotes = vote === 'not' ? votedTake.notVotes + 1 : votedTake.notVotes;
        const updatedTake = {
          ...votedTake,
          hotVotes: updatedHotVotes,
          notVotes: updatedNotVotes,
          totalVotes: updatedHotVotes + updatedNotVotes,
        };
        setLastVotedTake(updatedTake);
      }
    } catch (error) {
      console.error('Error submitting vote:', error);
      changeVoteTakeIdsRef.current.delete(takeId);
      // Could show a toast notification here
    }
  };

  const handleSkip = async (takeId: string) => {
    try {
      await skipTake(takeId);
      // Track completed card for ad service (called after skip)
      onCardComplete();
      // Refresh stats in case there are other metrics tracked
      await refreshStats();
    } catch (error) {
      console.error('Error skipping take:', error);
      // Could show a toast notification here
    }
  };

  const handleInviteFriends = async () => {
    try {
      const SMART_LINK = 'https://hot-or-not-takes.web.app/download';
      const inviteMessage = `Try Hot or Not Takes - Vote on spicy hot takes! 🔥 ${SMART_LINK}`;
      
      await RNShare.open({
        title: 'Invite Friends to Hot or Not Takes',
        message: inviteMessage,
        failOnCancel: false,
      });
    } catch (error) {
      console.log('Invite sharing failed:', error);
    }
  };

  const toggleTheme = () => {
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
  };

  const toggleResultsAutoplay = () => {
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
  };

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
      console.log('🗳️ Vote now clicked! Dismissing stats and preparing take for voting');
      
      // Add the take to the front of the deck for voting first
      prependTake(take);
      
      // Then close stats modal to reveal the new voteable card
      setSelectedTakeForStats(null);
      
    } catch (error) {
      console.error('Error preparing take for voting:', error);
    }
  };

  const handleShowLastVote = async () => {
    if (!lastVotedTake || !user) return;
    
    try {
      // Get the user's vote for this take
      const userVoteRecord = await getUserVoteForTake(lastVotedTake.id, user.uid);
      if (userVoteRecord && userVoteRecord.vote) {
        // Show the stats card for the last voted take
        setSelectedTakeForStats({ take: lastVotedTake, vote: userVoteRecord.vote });
      }
    } catch (error) {
      console.error('Error showing last vote:', error);
    }
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
            onMyTakes={() => setShowMyTakesModal(true)}
            onLeaderboard={() => setShowLeaderboardModal(true)}
            onRecentVotes={() => setShowRecentVotesModal(true)}
            onFavorites={() => setShowFavoritesModal(true)}
            onInstructions={() => setShowInstructionsModal(true)}
            onSafety={() => setShowSafetyModal(true)}
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
        {takesLoading || authLoading ? (
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
          />
        )}
      </View>

      {/* Fixed Bottom Section */}
      <View style={styles.fixedFooter}>
        {/* Bottom Buttons Row - moved closer to instructions */}
        <View style={styles.bottomButtonsRow}>
          {/* Last Vote Button */}
          <AnimatedPressable 
            style={[
              styles.bottomButton,
              styles.recentVotesButton,
              !lastVotedTake && styles.disabledControl,
              isDarkMode 
                ? { backgroundColor: theme.surface, borderWidth: 0 } 
                : { backgroundColor: '#F0F0F1', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }
            ]} 
            onPress={handleShowLastVote}
            disabled={!lastVotedTake}
            scaleValue={0.9}
            hapticIntensity={motion.haptic.light}
            accessibilityRole="button"
            accessibilityLabel="Show your last vote"
          >
            <Text style={[styles.buttonIcon, isDarkMode && { color: theme.text }]}>↩️</Text>
          </AnimatedPressable>

          {/* Skip Button */}
          <AnimatedPressable 
            style={[
              styles.bottomButton,
              !takes[0] && styles.disabledControl,
              isDarkMode 
                ? { backgroundColor: theme.surface, borderWidth: 0 } 
                : { backgroundColor: '#F0F0F1', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }
            ]} 
            onPress={() => {
              if (takes[0]) {
                handleSkip(takes[0].id);
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

      {/* Safety Standards Modal - Conditional Rendering */}
      {showSafetyModal && (
        <FullScreenOverlay zIndex={1800}>
          <SafetyStandardsScreen
            onClose={() => setShowSafetyModal(false)}
            isDarkMode={isDarkMode}
          />
        </FullScreenOverlay>
      )}

      {/* Invite Friends FAB */}
      <AnimatedPressable
        style={[styles.inviteFabButton, { backgroundColor: theme.accent }]}
        onPress={handleInviteFriends}
        scaleValue={0.9}
        hapticIntensity={motion.haptic.selection}
        accessibilityRole="button"
        accessibilityLabel="Invite friends"
      >
        <Text style={styles.buttonIcon}>💌</Text>
      </AnimatedPressable>

      {/* Floating Action Button for Submit */}
      <AnimatedPressable
        style={[styles.fabButton, { backgroundColor: theme.primary }]}
        onPress={() => setShowSubmitModal(true)}
        scaleValue={0.9}
        hapticIntensity={motion.haptic.selection}
        accessibilityRole="button"
        accessibilityLabel="Submit a hot take"
      >
        <Text style={styles.buttonIcon}>✏️</Text>
      </AnimatedPressable>

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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: responsive.spacing.xs, // Reduce spacing to move closer to instructions
    gap: 20,
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
  disabledControl: {
    opacity: 0.45,
  },
  recentVotesButton: {
    marginRight: 10,
  },
  buttonIcon: {
    fontSize: responsive.fontSize.large,
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
  fabButton: {
    position: 'absolute',
    bottom: footerFabBottom,
    right: responsive.spacing.lg,
    width: roundControlSize,
    height: roundControlSize,
    borderRadius: roundControlSize / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 10, // Higher than footer (200)
  },
  inviteFabButton: {
    position: 'absolute',
    bottom: footerFabBottom,
    left: responsive.spacing.lg,
    width: roundControlSize,
    height: roundControlSize,
    borderRadius: roundControlSize / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 10, // Higher than footer (200)
  },
  fabText: {
    fontSize: responsive.fontSize.xlarge,
  },
  });
};
