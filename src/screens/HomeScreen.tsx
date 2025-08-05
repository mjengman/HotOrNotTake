import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Text,
} from 'react-native';
import { CustomSwipeableCardDeck } from '../components/CustomSwipeableCardDeck';
import { CategoryDropdown } from '../components/CategoryDropdown';
import { AdBanner } from '../components/AdBanner';
import { AdConsentModal } from '../components/AdConsentModal';
import { LoadingSkeleton } from '../components/loading/LoadingSkeleton';
import { AnimatedPressable } from '../components/transitions/AnimatedPressable';
import { SubmitTakeScreen } from './SubmitTakeScreen';
import { MyTakesScreen } from './MyTakesScreen';
import { LeaderboardScreen } from './LeaderboardScreen';
import { useAuth, useFirebaseTakes, useUserStats } from '../hooks';
// import { useInvisibleAISeeding } from '../services/invisibleAISeeding';
// import adService from '../services/adService';
import { useInterstitialAds } from '../hooks/useInterstitialAds';
import { colors, dimensions } from '../constants';

export const HomeScreen: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showMyTakesModal, setShowMyTakesModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { user, loading: authLoading, signIn } = useAuth();
  const { takes, loading: takesLoading, error: takesError, submitVote, skipTake } = useFirebaseTakes({
    category: selectedCategory
  });
  const { stats } = useUserStats();
  
  // AI seeding is now manual-only via pull-to-refresh
  
  // Use the interstitial ads hook
  const { onUserSwipe, onSessionEnd } = useInterstitialAds();
  
  const theme = isDarkMode ? colors.dark : colors.light;

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

  const handleLoadMore = async () => {
    console.log('Loading more content for category:', selectedCategory);
    
    // For "all" category, generate a mix across different categories
    if (selectedCategory === 'all') {
      const { generateMultipleAITakes, convertAITakeToSubmission } = await import('../services/aiContentService');
      const { submitTake } = await import('../services/takeService');
      const { auth } = await import('../services/firebase');
      
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.error('No authenticated user');
          return;
        }
        
        // Generate 20 takes across random categories
        const aiTakes = await generateMultipleAITakes(20);
        let submitted = 0;
        
        for (const aiTake of aiTakes) {
          try {
            const submission = convertAITakeToSubmission(aiTake);
            await submitTake(submission, currentUser.uid);
            submitted++;
          } catch (error) {
            console.error('Failed to submit AI take:', error);
          }
        }
        
        console.log(`Successfully generated ${submitted} takes across all categories`);
      } catch (error) {
        console.error('Error generating content for all categories:', error);
      }
    } else {
      // Generate for specific category
      const { generateTakesForSingleCategory } = await import('../services/invisibleAISeeding');
      try {
        const generated = await generateTakesForSingleCategory(selectedCategory, 20);
        console.log(`Successfully generated ${generated} takes for ${selectedCategory}`);
      } catch (error) {
        console.error('Error generating more content:', error);
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />
      
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
            <Text style={styles.headerButtonIcon}>📊</Text>
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
              onPress={() => window.location.reload()}
              scaleValue={0.95}
              hapticIntensity={15}
            >
              <Text style={[styles.retryButtonText, { color: '#FFFFFF' }]}>
                Retry
              </Text>
            </AnimatedPressable>
          </View>
        ) : takes && takes.length > 0 ? (
          <CustomSwipeableCardDeck
            takes={takes}
            onVote={handleVote}
            onSkip={handleSkip}
            onLoadMore={handleLoadMore}
            onSubmitTake={() => setShowSubmitModal(true)}
            isDarkMode={isDarkMode}
          />
        ) : (
          <CustomSwipeableCardDeck
            takes={[]}
            onVote={handleVote}
            onSkip={handleSkip}
            onLoadMore={handleLoadMore}
            onSubmitTake={() => setShowSubmitModal(true)}
            isDarkMode={isDarkMode}
          />
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.instructions}>
          <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
            Swipe right for 🔥 HOT • Swipe left for 🗑️ NOT
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

      {/* Ad Consent Modal */}
      <AdConsentModal isDarkMode={isDarkMode} />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonIcon: {
    fontSize: dimensions.fontSize.large,
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
});