import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomSwipeableCardDeck } from '../components/CustomSwipeableCardDeck';
import { CategoryDropdown } from '../components/CategoryDropdown';
import { AdBanner } from '../components/AdBanner';
import { AdConsentModal } from '../components/AdConsentModal';
import { LoadingSkeleton } from '../components/loading/LoadingSkeleton';
import { AnimatedPressable } from '../components/transitions/AnimatedPressable';
import { InstructionsModal } from '../components/InstructionsModal';
import { SubmitTakeScreen } from './SubmitTakeScreen';
import { MyTakesScreen } from './MyTakesScreen';
import { LeaderboardScreen } from './LeaderboardScreen';
import { useAuth, useFirebaseTakes, useUserStats } from '../hooks';
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
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null); // null = loading
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [myTakesRefreshTrigger, setMyTakesRefreshTrigger] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const { user, loading: authLoading, signIn } = useAuth();
  const { takes, loading: takesLoading, error: takesError, submitVote, skipTake, refreshTakes, loadMore, hasMore } = useFirebaseTakes({
    category: selectedCategory
  });
  const { stats, refreshStats } = useUserStats();
  
  // AI seeding is now manual-only via pull-to-refresh
  
  // Use the hook-based interstitial ads
  const { onUserSwipe, onSessionEnd } = useInterstitialAds();
  
  const theme = isDarkMode ? colors.dark : colors.light;

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



  const handleVote = async (takeId: string, vote: 'hot' | 'not') => {
    try {
      await submitVote(takeId, vote);
      // Track swipe for ad service
      onUserSwipe();
      // Update vote counter immediately
      await refreshStats();
    } catch (error) {
      console.error('Error submitting vote:', error);
      // Could show a toast notification here
    }
  };

  const handleSkip = async (takeId: string) => {
    try {
      await skipTake(takeId);
      // Track swipe for ad service
      onUserSwipe();
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
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
          <AnimatedPressable 
            style={[styles.headerButton, { backgroundColor: theme.surface }]}
            onPress={() => setShowMyTakesModal(true)}
            scaleValue={0.9}
            hapticIntensity={8}
          >
            <Text style={styles.headerButtonIcon}>📋</Text>
          </AnimatedPressable>
          
          <AnimatedPressable 
            style={[styles.headerButton, { backgroundColor: theme.surface }]}
            onPress={() => setShowLeaderboardModal(true)}
            scaleValue={0.9}
            hapticIntensity={8}
          >
            <Text style={styles.headerButtonIcon}>🏆</Text>
          </AnimatedPressable>
          
          <AnimatedPressable 
            style={[styles.headerButton, { backgroundColor: theme.surface }]}
            onPress={toggleTheme}
            scaleValue={0.9}
            hapticIntensity={12}
          >
            <Text style={styles.headerButtonIcon}>
              {isDarkMode ? '☀️' : '🌙'}
            </Text>
          </AnimatedPressable>
        </View>
        
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: theme.text }]}>
            🔥 Hot or Not Takes
          </Text>
        </View>
        
        <View style={styles.statsContainer}>
          <Text style={[styles.statsText, { color: theme.textSecondary }]}>
            Votes: {stats.totalVotes}
          </Text>
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
          />
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.instructions}>
          <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
            Swipe right for 🔥 HOT • Swipe left for ❄️ NOT
          </Text>
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
    justifyContent: 'space-between',
    marginBottom: dimensions.spacing.xs,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: dimensions.spacing.xs,
  },
  title: {
    fontSize: dimensions.fontSize.xxlarge,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
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
    paddingTop: dimensions.spacing.sm,
    zIndex: 100, // Ensure dropdown stays above swipeable deck
    elevation: 5, // For Android shadow
  },
  headerButton: {
    width: 45,
    height: 45,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonIcon: {
    fontSize: dimensions.fontSize.xlarge,
  },
  deckContainer: {
    flex: 1,
    justifyContent: 'center',
    marginTop: -65, // Pull the deck up to reduce dead space
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
    bottom: 110,
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