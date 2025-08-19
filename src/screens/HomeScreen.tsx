import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Image,
  BackHandler,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { useAuth, useFirebaseTakes, useUserStats } from '../hooks';
import { deleteVote, getUserVoteForTake } from '../services/voteService';
// AI seeding disabled for MVP launch
import { useInterstitialAds } from '../hooks/useInterstitialAds';
// Removed class-based ad service (API issue)
// import adService from '../services/adService';
import { colors, dimensions } from '../constants';

export const HomeScreen: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showMyTakesModal, setShowMyTakesModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showRecentVotesModal, setShowRecentVotesModal] = useState(false);
  const [selectedTakeForStats, setSelectedTakeForStats] = useState<{take: any, vote: 'hot' | 'not'} | null>(null);
  const [lastVotedTake, setLastVotedTake] = useState<any | null>(null);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null); // null = loading
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [myTakesRefreshTrigger, setMyTakesRefreshTrigger] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
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
  }, [showSubmitModal, showRecentVotesModal, showLeaderboardModal, showMyTakesModal, showInstructionsModal, selectedTakeForStats]);

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

  const handleLoadMore = async () => {
    console.log('🚫 AI generation disabled for MVP launch');
    // AI generation removed - pure user-content MVP
    // Users must submit their own takes
    return;
  };

  const handlePullToRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshTakes();
      await refreshStats();
    } catch (error) {
      console.error('Pull to refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

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
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullToRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
            enabled={!showMyTakesModal && !showLeaderboardModal && !showRecentVotesModal}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <BurgerMenu
              isDarkMode={isDarkMode}
              onMyTakes={() => setShowMyTakesModal(true)}
              onLeaderboard={() => setShowLeaderboardModal(true)}
              onRecentVotes={() => setShowRecentVotesModal(true)}
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
      </View>

      {/* Category Dropdown */}
      <View style={styles.categoryContainer}>
        <CategoryDropdown
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
          isDarkMode={isDarkMode}
        />
      </View>

      <View style={styles.deckContainer}>
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
            loading={takesLoading}
            externalStatsCard={selectedTakeForStats}
            onExternalStatsCardDismiss={() => setSelectedTakeForStats(null)}
            onShowRecentVotes={handleShowLastVote}
            onChangeVote={handleChangeVote}
            totalVotes={stats.totalVotes}
          />
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.instructions}>
          <Animated.Text 
            style={[
              styles.instructionText, 
              { 
                color: theme.textSecondary,
                opacity: fadeAnim 
              }
            ]}
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

      {/* Floating Action Button for Submit */}
      <TouchableOpacity
        style={[styles.fabButton, { backgroundColor: theme.primary }]}
        onPress={() => setShowSubmitModal(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>✏️</Text>
      </TouchableOpacity>
      </ScrollView>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: dimensions.spacing.lg,
    paddingTop: dimensions.spacing.lg + 10,
    paddingBottom: dimensions.spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: dimensions.spacing.xs,
    zIndex: 10,
    elevation: 10,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: dimensions.spacing.sm,
    marginTop: -55,
  },
  title: {
    fontSize: dimensions.fontSize.xxlarge,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
  },
  titleBanner: {
    width: '95%',
    height: 130,
    alignSelf: 'center',
  },
  statsContainer: {
    alignItems: 'center',
    marginBottom: dimensions.spacing.xs,
  },
  statsText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '600',
  },
  categoryContainer: {
    paddingHorizontal: dimensions.spacing.lg,
    paddingTop: 0,
    marginTop: -3,
    zIndex: 1, // Lower z-index so cards can animate above it
    elevation: 1, // For Android shadow
  },
  deckContainer: {
    flex: 1,
    justifyContent: 'center',
    marginTop: -40, // Pull the deck up but leave space for category dropdown
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: dimensions.fontSize.large,
    fontWeight: '500',
  },
  errorText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: dimensions.spacing.md,
  },
  retryButton: {
    paddingHorizontal: dimensions.spacing.lg,
    paddingVertical: dimensions.spacing.md,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: dimensions.spacing.lg,
    paddingBottom: dimensions.spacing.md,
  },
  instructions: {
    alignItems: 'center',
    marginBottom: dimensions.spacing.sm,
  },
  instructionText: {
    fontSize: dimensions.fontSize.small,
    textAlign: 'center',
    fontWeight: '500',
  },
  adSpace: {
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: dimensions.spacing.sm,
    backgroundColor: 'transparent',
  },
  emptySubtext: {
    fontSize: dimensions.fontSize.medium,
    textAlign: 'center',
    marginTop: dimensions.spacing.sm,
    marginBottom: dimensions.spacing.lg,
  },
  emptySubmitButton: {
    paddingHorizontal: dimensions.spacing.xl,
    paddingVertical: dimensions.spacing.md,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySubmitButtonText: {
    fontSize: dimensions.fontSize.large,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  adPlaceholder: {
    fontSize: dimensions.fontSize.small,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  fabButton: {
    position: 'absolute',
    bottom: 130,
    right: dimensions.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
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
  },
  fabText: {
    fontSize: 24,
  },
});