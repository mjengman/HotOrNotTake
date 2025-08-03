import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Text,
} from 'react-native';
import { CustomSwipeableCardDeck } from '../components/CustomSwipeableCardDeck';
import { useAuth, useFirebaseTakes, useUserStats } from '../hooks';
import { colors, dimensions } from '../constants';

export const HomeScreen: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { user, loading: authLoading, signIn } = useAuth();
  const { takes, loading: takesLoading, error: takesError, submitVote } = useFirebaseTakes();
  const { stats } = useUserStats();
  
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
        <View style={styles.themeToggleRow}>
          <TouchableOpacity 
            style={[styles.themeButton, { backgroundColor: theme.surface }]}
            onPress={toggleTheme}
          >
            <Text style={styles.themeIcon}>
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
            isDarkMode={isDarkMode}
          />
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.text }]}>
              No takes available yet!
            </Text>
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
  themeToggleRow: {
    alignItems: 'flex-end',
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
  themeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeIcon: {
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
});