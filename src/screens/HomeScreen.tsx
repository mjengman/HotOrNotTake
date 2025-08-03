import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Text,
  Modal,
} from 'react-native';
import { CustomSwipeableCardDeck } from '../components/CustomSwipeableCardDeck';
import { CategoryDropdown } from '../components/CategoryDropdown';
import { SubmitTakeScreen } from './SubmitTakeScreen';
import { MyTakesScreen } from './MyTakesScreen';
import { LeaderboardScreen } from './LeaderboardScreen';
import { useAuth, useFirebaseTakes, useUserStats } from '../hooks';
import { useInvisibleAISeeding } from '../services/invisibleAISeeding';
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
  
  // Invisible AI seeding - completely behind the scenes!
  useInvisibleAISeeding();
  
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
    } catch (error) {
      console.error('Error submitting vote:', error);
      // Could show a toast notification here
    }
  };

  const handleSkip = async (takeId: string) => {
    try {
      await skipTake(takeId);
    } catch (error) {
      console.error('Error skipping take:', error);
      // Could show a toast notification here
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />
      
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={[styles.headerButton, { backgroundColor: theme.surface }]}
            onPress={() => setShowMyTakesModal(true)}
          >
            <Text style={styles.headerButtonIcon}>📋</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.headerButton, { backgroundColor: theme.surface }]}
            onPress={() => setShowLeaderboardModal(true)}
          >
            <Text style={styles.headerButtonIcon}>📊</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.headerButton, { backgroundColor: theme.surface }]}
            onPress={toggleTheme}
          >
            <Text style={styles.headerButtonIcon}>
              {isDarkMode ? '☀️' : '🌙'}
            </Text>
          </TouchableOpacity>
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
          onCategoryChange={setSelectedCategory}
          isDarkMode={isDarkMode}
        />
      </View>

      <View style={styles.deckContainer}>
        {takesLoading || authLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.text }]}>
              {authLoading ? 'Signing in...' : 'Loading hot takes...'}
            </Text>
          </View>
        ) : takesError ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.errorText, { color: theme.error }]}>
              {takesError}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primary }]}
              onPress={() => window.location.reload()}
            >
              <Text style={[styles.retryButtonText, { color: '#FFFFFF' }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : takes && takes.length > 0 ? (
          <CustomSwipeableCardDeck
            takes={takes}
            onVote={handleVote}
            onSkip={handleSkip}
            isDarkMode={isDarkMode}
          />
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.text }]}>
              No takes available yet!
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              Be the first to submit a hot take!
            </Text>
            <TouchableOpacity
              style={[styles.emptySubmitButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowSubmitModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.emptySubmitButtonText}>✏️ Submit Take</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.instructions}>
          <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
            Swipe right for 🔥 HOT • Swipe left for 🗑️ NOT
          </Text>
        </View>
        
        <View style={styles.adSpace}>
          <Text style={[styles.adPlaceholder, { color: theme.textSecondary }]}>
            [Ad Space - 320x50]
          </Text>
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
    height: 50,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(128, 128, 128, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: dimensions.spacing.sm,
  },
  adPlaceholder: {
    fontSize: dimensions.fontSize.small,
    fontStyle: 'italic',
    opacity: 0.6,
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
});