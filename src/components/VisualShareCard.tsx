import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Take } from '../types';
import { colors } from '../constants';

interface VisualShareCardProps {
  take: Take;
  userVote?: 'hot' | 'not' | null;
  isDarkMode?: boolean;
}

export const VisualShareCard: React.FC<VisualShareCardProps> = ({
  take,
  userVote = null,
  isDarkMode = false,
}) => {
  const theme = isDarkMode ? colors.dark : colors.light;
  
  // Calculate percentages exactly like TakeCard
  const totalVotes = take.totalVotes || (take.hotVotes + take.notVotes) || 0;
  const hotPercentage = totalVotes > 0 ? Math.round((take.hotVotes / totalVotes) * 100) : 50;
  const notPercentage = totalVotes > 0 ? Math.round((take.notVotes / totalVotes) * 100) : 50;

  // Truncate text if too long for sharing
  const getDisplayText = (text: string, maxLength: number = 160) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {/* Subtle background gradient */}
      <LinearGradient
        colors={[theme.card, theme.surface]}
        style={styles.backgroundGradient}
        start={[0, 0]}
        end={[1, 1]}
      />
      
      {/* App Header */}
      <View style={styles.header}>
        <Text style={[styles.appTitle, { color: theme.primary }]}>
          🔥 Hot or Not Takes
        </Text>
      </View>

      {/* Category Badge */}
      <View style={[styles.categoryBadge, { backgroundColor: theme.accent + '33' }]}>
        <Text style={[styles.categoryText, { color: theme.accent }]}>
          #{(take.category || 'GENERAL').toUpperCase()}
        </Text>
      </View>
      
      {/* Take Content */}
      <View style={styles.takeSection}>
        <Text style={[styles.takeText, { color: theme.text }]}>
          "{getDisplayText(take.text)}"
        </Text>
      </View>
      
      {/* Vote Status */}
      <View style={styles.voteStatusSection}>
        <Text style={[styles.voteStatus, { 
          color: userVote ? theme.text : theme.textSecondary 
        }]}>
          {userVote ? `You voted ${userVote === 'hot' ? '🔥 HOT' : '❄️ NOT'}` : 'Community Results'}
        </Text>
      </View>
      
      {/* Main Stats - Exactly like TakeCard percentages */}
      <View style={styles.percentageContainer}>
        {/* NOT Section */}
        <View style={styles.percentageSection}>
          <Text style={[styles.bigPercentage, { color: theme.not }]}>
            {notPercentage}%
          </Text>
          <Text style={[styles.percentageLabel, { color: theme.textSecondary }]}>
            NOT
          </Text>
        </View>
        
        {/* Divider */}
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        
        {/* HOT Section */}
        <View style={styles.percentageSection}>
          <Text style={[styles.bigPercentage, { color: theme.hot }]}>
            {hotPercentage}%
          </Text>
          <Text style={[styles.percentageLabel, { color: theme.textSecondary }]}>
            HOT
          </Text>
        </View>
      </View>
      
      {/* Vote Details */}
      <View style={styles.voteDetails}>
        <Text style={[styles.voteCount, { color: theme.hot }]}>
          🔥 {take.hotVotes.toLocaleString()} votes
        </Text>
        <Text style={[styles.voteCount, { color: theme.not }]}>
          ❄️ {take.notVotes.toLocaleString()} votes
        </Text>
        <Text style={[styles.totalVotes, { color: theme.textSecondary }]}>
          {totalVotes.toLocaleString()} total votes
        </Text>
      </View>
      
      {/* Footer CTA */}
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <Text style={[styles.ctaTitle, { color: theme.primary }]}>
          Join the debate
        </Text>
        <Text style={[styles.ctaSubtitle, { color: theme.textSecondary }]}>
          Download Hot or Not Takes
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 400,
    height: 600,
    borderRadius: 20,
    padding: 24,
    justifyContent: 'space-between',
    // Add shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    opacity: 0.7,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  categoryBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 167, 2, 0.3)',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  takeSection: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: 20,
  },
  takeText: {
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center',
    fontWeight: '500',
  },
  voteStatusSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  voteStatus: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  percentageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 24,
  },
  percentageSection: {
    alignItems: 'center',
    flex: 1,
  },
  bigPercentage: {
    fontSize: 56,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  percentageLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  dividerLine: {
    width: 3,
    height: 80,
    borderRadius: 2,
    marginHorizontal: 20,
  },
  voteDetails: {
    alignItems: 'center',
    marginBottom: 20,
  },
  voteCount: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  totalVotes: {
    fontSize: 16,
    fontStyle: 'italic',
    marginTop: 8,
  },
  footer: {
    alignItems: 'center',
    borderTopWidth: 2,
    paddingTop: 16,
  },
  ctaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  ctaSubtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
});