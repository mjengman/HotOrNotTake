import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Text,
  TouchableOpacity,
  Image,
  BackHandler,
  Animated,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomSwipeableCardDeck } from '../components/CustomSwipeableCardDeck';
import { CategoryDropdown } from '../components/CategoryDropdown';
import { AdBanner } from '../components/AdBanner';
import { AdConsentModal } from '../components/AdConsentModal';
import { LoadingSkeleton } from '../components/loading/LoadingSkeleton';
import { AnimatedPressable } from '../components/transitions/AnimatedPressable';
import { InstructionsModal } from '../components/InstructionsModal';
import { BurgerMenu } from '../components/BurgerMenu';
import { SubmitTakeScreen } from './SubmitTakeScreen';
import { MyTakesScreen } from './MyTakesScreen';
import { LeaderboardScreen } from './LeaderboardScreen';
import { RecentVotesScreen } from './RecentVotesScreen';
import { MyFavoritesScreen } from './MyFavoritesScreen';
import { useAuth, useFirebaseTakes, useUserStats } from '../hooks';
import { useResponsive } from '../hooks/useResponsive';
import { deleteVote, getUserVoteForTake } from '../services/voteService';
import { getCommunityStats } from '../services/userService';
// AI seeding disabled for MVP launch
import { useInterstitialAds } from '../hooks/useInterstitialAds';
// Removed class-based ad service (API issue)
// import adService from '../services/adService';
import { colors } from '../constants';
import RNShare from 'react-native-share';

export const HomeScreen: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showMyTakesModal, setShowMyTakesModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showRecentVotesModal, setShowRecentVotesModal] = useState(false);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [selectedTakeForStats, setSelectedTakeForStats] = useState<{take: any, vote: 'hot' | 'not' | null} | null>(null);
  const [lastVotedTake, setLastVotedTake] = useState<any | null>(null);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null); // null = loading
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [myTakesRefreshTrigger, setMyTakesRefreshTrigger] = useState<number>(0);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [communityTotalVotes, setCommunityTotalVotes] = useState<number>(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const { user, loading: authLoading, signIn } = useAuth();
  const { takes, loading: takesLoading, error: takesError, submitVote, skipTake, refreshTakes, loadMore, hasMore, prependTake } = useFirebaseTakes({
    category: selectedCategory
  });
  const { stats, refreshStats } = useUserStats();
  
  // AI seeding is now manual-only via pull-to-refresh
  
  // Use the hook-based interstitial ads
  const { onCardComplete, onSessionEnd } = useInterstitialAds();
  
  const theme = isDarkMode ? colors.dark : colors.light;
  
  // Get responsive dimensions for this device profile
  const responsive = useResponsive();
  const insets = useSafeAreaInsets();
  
  // Create responsive styles
  const styles = useMemo(() => createStyles(responsive, insets), [responsive, insets]);

  // Rotating instruction messages
  const instructionTexts = [
    "Swipe right for 🔥 HOT • Swipe left for ❄️ NOT",
    "Swipe up ⬆️ or down ⬇️ to SKIP",
    "🚀 More swipes = fewer ads!",
    "☰ Tap the menu button for more options",
  ];

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
    const stats = await getCommunityStats();
    setCommunityTotalVotes(stats.totalVotes);
  };

  // Initial load and periodic refresh
  React.useEffect(() => {
    refreshCommunityStats();
    
    // Refresh every 60 seconds if the app is active
    const interval = setInterval(refreshCommunityStats, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Refresh on category change
  React.useEffect(() => {
    refreshCommunityStats();
  }, [selectedCategory]);

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
      if (selectedTakeForStats) {
        setSelectedTakeForStats(null);
        return true;
      }
      // If no modals are open, allow default behavior (exit app)
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showSubmitModal, showRecentVotesModal, showFavoritesModal, showLeaderboardModal, showMyTakesModal, showInstructionsModal, selectedTakeForStats]);

  // Rotate instruction text every 4 seconds with fade animation
  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Change text while faded out
        setCurrentInstructionIndex((prev) => (prev + 1) % instructionTexts.length);
        
        // Fade back in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    }, 10000); // Change every 4 seconds

    return () => clearInterval(interval);
  }, [instructionTexts.length, fadeAnim]);

  const handleVote = async (takeId: string, vote: 'hot' | 'not') => {
    try {
      // Find the take that was voted on
      const votedTake = takes.find(take => take.id === takeId);
      
      await submitVote(takeId, vote);
      // Track completed card for ad service (called after vote is cast)
      onCardComplete();
      // Update vote counter immediately
      await refreshStats();
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
      const inviteMessage = `Try Hot or Not Takes - Vote on spicy community debates! 🔥 ${SMART_LINK}`;
      
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
    setIsDarkMode(prev => !prev);
  };

  const handleCategoryChange = (newCategory: string) => {
    // Trigger ad on category change (session end)
    onSessionEnd();
    setSelectedCategory(newCategory);
  };

  const handleRetry = async () => {
    // Force refresh the takes data
    try {
      window.location?.reload?.(); // Web only
    } catch {
      // For native platforms, we'll trigger a data refresh
      // The useFirebaseTakes hook should handle this automatically
      // but we can force a re-authentication if needed
      if (!user) {
        await signIn();
      }
    }
  };

  // AI generation removed - pure user-content MVP
  // Users must submit their own takes

  // Removed pull-to-refresh due to fixed layout structure
  // Can be re-implemented with a different trigger if needed

  const handleChangeVote = async (take: any) => {
    if (!user) return;
    
    try {
      // Get the user's current vote first to know what to decrement
      const userVote = await getUserVoteForTake(take.id, user.uid);
      if (!userVote) return;
      
      // Delete the existing vote
      await deleteVote(take.id, user.uid);
      
      // Refresh stats to reflect the deleted vote
      await refreshStats();
      
      // Update the take's vote counts to reflect the deletion
      const updatedTake = {
        ...take,
        hotVotes: userVote.vote === 'hot' ? take.hotVotes - 1 : take.hotVotes,
        notVotes: userVote.vote === 'not' ? take.notVotes - 1 : take.notVotes,
        totalVotes: take.totalVotes - 1,
      };
      
      // Add the updated take to the front of the deck for re-voting
      prependTake(updatedTake);
      
      // Note: The stats card dismissal is handled by CustomSwipeableCardDeck
      
    } catch (error) {
      console.error('Error changing vote:', error);
      // Could show a toast notification here
    }
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
            onToggleTheme={toggleTheme}
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
            totalVotes={stats.totalVotes}
          />
        )}
      </View>

      {/* Fixed Bottom Section */}
      <View style={styles.fixedFooter}>
        {/* Bottom Buttons Row - moved closer to instructions */}
        <View style={styles.bottomButtonsRow}>
          {/* Invite Button */}
          <AnimatedPressable 
            style={[
              styles.bottomButton,
              isDarkMode 
                ? { backgroundColor: theme.surface, borderWidth: 0 } 
                : { backgroundColor: '#F0F0F1', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }
            ]} 
            onPress={handleInviteFriends}
            scaleValue={0.9}
            hapticIntensity={8}
          >
            <Text style={[styles.buttonIcon, isDarkMode ? { color: theme.text } : { color: '#333' }]}>📲</Text>
          </AnimatedPressable>

          {/* Recent Votes Button */}
          <AnimatedPressable 
            style={[
              styles.bottomButton,
              styles.recentVotesButton,
              isDarkMode 
                ? { backgroundColor: theme.surface, borderWidth: 0 } 
                : { backgroundColor: '#F0F0F1', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }
            ]} 
            onPress={handleShowLastVote}
            scaleValue={0.9}
            hapticIntensity={8}
          >
            <Text style={[styles.buttonIcon, isDarkMode && { color: theme.text }]}>↩️</Text>
          </AnimatedPressable>

          {/* Skip Button */}
          <AnimatedPressable 
            style={[
              styles.bottomButton,
              isDarkMode 
                ? { backgroundColor: theme.surface, borderWidth: 0 } 
                : { backgroundColor: '#F0F0F1', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }
            ]} 
            onPress={() => skipTake(takes[0]?.id)}
            scaleValue={0.9}
            hapticIntensity={12}
          >
            <Text style={[styles.buttonIcon, isDarkMode ? { color: theme.text } : { color: '#333' }]}>⏭️</Text>
          </AnimatedPressable>
        </View>

        {/* Vote Counter Row - showing personal and community totals */}
        <View style={styles.voteCounterRow}>
          <View style={[styles.voteCounter, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
            <Text 
              style={[styles.voteCounterText, { color: theme.textSecondary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              Your votes: {stats.totalVotes} | Community: {communityTotalVotes.toLocaleString()}
            </Text>
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


      {/* Submit Take Modal - Conditional Rendering */}
      {showSubmitModal && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 2000, // Higher than MyTakes modal
          paddingTop: StatusBar.currentHeight || 44, // Safe area for status bar
        }}>
          <SubmitTakeScreen
            onClose={() => setShowSubmitModal(false)}
            onSuccess={() => {
              // Trigger MyTakes refresh when a new take is submitted
              setMyTakesRefreshTrigger(Date.now());
            }}
            isDarkMode={isDarkMode}
          />
        </View>
      )}

      {/* My Takes Modal - Conditional Rendering */}
      {showMyTakesModal && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          paddingTop: StatusBar.currentHeight || 44, // Safe area for status bar
        }}>
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
        </View>
      )}

      {/* Leaderboard Modal - Conditional Rendering */}
      {showLeaderboardModal && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1500, // Higher than other modals
          paddingTop: StatusBar.currentHeight || 44, // Safe area for status bar
        }}>
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
        </View>
      )}

      {/* Recent Votes Modal - Conditional Rendering */}
      {showRecentVotesModal && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1600, // Higher than other modals
          paddingTop: StatusBar.currentHeight || 44, // Safe area for status bar
        }}>
          <RecentVotesScreen
            onClose={() => setShowRecentVotesModal(false)}
            onShowTakeStats={(take, vote) => {
              setSelectedTakeForStats({ take, vote });
            }}
            isDarkMode={isDarkMode}
          />
        </View>
      )}

      {/* My Favorites Modal - Conditional Rendering */}
      {showFavoritesModal && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1700, // Higher than other modals
          paddingTop: StatusBar.currentHeight || 44, // Safe area for status bar
        }}>
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
        </View>
      )}

      {/* Floating Action Button for Submit */}
      <TouchableOpacity
        style={[styles.fabButton, { backgroundColor: theme.primary }]}
        onPress={() => setShowSubmitModal(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>✏️</Text>
      </TouchableOpacity>

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
const createStyles = (responsive: any, insets: any) => StyleSheet.create({
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
    width: 45,
    height: 45,
    borderRadius: 40,
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
  recentVotesButton: {
    marginRight: 10,
  },
  buttonIcon: {
    fontSize: responsive.fontSize.large,
    fontWeight: 'bold',
  },
  voteCounter: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 25,
    minWidth: 200, // Ensure enough space for the expanded content
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
    bottom: 160, // Moved up by 10px from 130
    right: responsive.spacing.lg,
    width: responsive.iconSize.xlarge + 8, // Scale from 56 to responsive
    height: responsive.iconSize.xlarge + 8,
    borderRadius: (responsive.iconSize.xlarge + 8) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    zIndex: 10, // Higher than footer (200)
  },
  fabText: {
    fontSize: responsive.fontSize.xlarge,
  },
});