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
import { useTakes } from '../hooks/useTakes';
import { colors, dimensions } from '../constants';

export const HomeScreen: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { takes, submitVote, getUserStats } = useTakes();
  
  const theme = isDarkMode ? colors.dark : colors.light;
  const stats = getUserStats();

  const handleVote = (takeId: string, vote: 'hot' | 'not') => {
    submitVote(takeId, vote);
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
        {takes && takes.length > 0 ? (
          <CustomSwipeableCardDeck
            takes={takes}
            onVote={handleVote}
            isDarkMode={isDarkMode}
          />
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.text }]}>
              Loading hot takes...
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