import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Take } from '../types';
import { colors, dimensions } from '../constants';

interface TakeCardProps {
  take: Take;
  isDarkMode?: boolean;
  onNotPress?: () => void;
  onHotPress?: () => void;
  showStats?: boolean;
  userVote?: 'hot' | 'not' | null;
  isFlipped?: boolean;
}

const { width, height } = Dimensions.get('window');

export const TakeCard: React.FC<TakeCardProps> = ({ 
  take, 
  isDarkMode = false,
  onNotPress,
  onHotPress,
  showStats = true,
  userVote = null,
  isFlipped = false,
}) => {
  const theme = isDarkMode ? colors.dark : colors.light;
  
  // Calculate percentages for the reveal
  const totalVotes = take.totalVotes || 0;
  const hotPercentage = totalVotes > 0 ? Math.round((take.hotVotes / totalVotes) * 100) : 50;
  const notPercentage = totalVotes > 0 ? Math.round((take.notVotes / totalVotes) * 100) : 50;

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <View style={[styles.categoryBadge, { backgroundColor: theme.accent + '20' }]}>
          <Text style={[styles.category, { color: theme.accent }]}>
            {take.category?.toUpperCase() || 'GENERAL'}
          </Text>
        </View>
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.takeText, { color: theme.text }]}>
          {take.text}
        </Text>
      </View>
      
      <View style={styles.footer}>
        {!isFlipped ? (
          // Front of card - voting buttons
          <View style={styles.voteStats}>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={onNotPress}
              disabled={!onNotPress}
              activeOpacity={0.7}
            >
              <Text style={[styles.statNumber, { color: theme.not }]}>
                {showStats ? take.notVotes.toLocaleString() : '?'}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                ❄️ NOT
              </Text>
            </TouchableOpacity>
            
            <View style={styles.statDivider} />
            
            <TouchableOpacity 
              style={styles.statItem}
              onPress={onHotPress}
              disabled={!onHotPress}
              activeOpacity={0.7}
            >
              <Text style={[styles.statNumber, { color: theme.hot }]}>
                {showStats ? take.hotVotes.toLocaleString() : '?'}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                🔥 HOT
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Back of card - stats reveal
          <View style={styles.revealContainer}>
            {userVote && (
              <Text style={[styles.yourVote, { color: theme.text }]}>
                You voted {userVote === 'hot' ? '🔥 HOT' : '❄️ NOT'}
              </Text>
            )}
            <View style={styles.percentageContainer}>
              <View style={styles.percentageItem}>
                <Text style={[styles.bigPercentage, { color: theme.not }]}>
                  {notPercentage}%
                </Text>
                <Text style={[styles.percentageLabel, { color: theme.textSecondary }]}>
                  NOT
                </Text>
              </View>
              <View style={styles.percentageDivider} />
              <View style={styles.percentageItem}>
                <Text style={[styles.bigPercentage, { color: theme.hot }]}>
                  {hotPercentage}%
                </Text>
                <Text style={[styles.percentageLabel, { color: theme.textSecondary }]}>
                  HOT
                </Text>
              </View>
            </View>
            <Text style={[styles.totalVotes, { color: theme.textSecondary }]}>
              {totalVotes.toLocaleString()} total votes
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: dimensions.card.width,
    height: dimensions.card.height,
    borderRadius: dimensions.card.borderRadius,
    padding: dimensions.spacing.lg,
    margin: dimensions.spacing.md,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginBottom: dimensions.spacing.md,
  },
  categoryBadge: {
    paddingHorizontal: dimensions.spacing.md,
    paddingVertical: dimensions.spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 167, 2, 0.3)',
  },
  category: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: dimensions.spacing.md,
  },
  takeText: {
    fontSize: dimensions.fontSize.large,
    lineHeight: 28,
    textAlign: 'center',
    fontWeight: '500',
  },
  footer: {
    marginTop: dimensions.spacing.lg,
  },
  voteStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  statNumber: {
    fontSize: dimensions.fontSize.large,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E1E8ED',
    opacity: 0.5,
  },
  // Reveal styles
  revealContainer: {
    alignItems: 'center',
    paddingVertical: dimensions.spacing.md,
  },
  yourVote: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '600',
    marginBottom: dimensions.spacing.md,
  },
  percentageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    marginBottom: dimensions.spacing.sm,
  },
  percentageItem: {
    alignItems: 'center',
    flex: 1,
  },
  bigPercentage: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  percentageLabel: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '600',
  },
  percentageDivider: {
    width: 1,
    height: 50,
    backgroundColor: '#E1E8ED',
    opacity: 0.5,
  },
  totalVotes: {
    fontSize: dimensions.fontSize.small,
    fontStyle: 'italic',
    marginTop: dimensions.spacing.xs,
  },
  continueHint: {
    fontSize: dimensions.fontSize.small,
    marginTop: dimensions.spacing.md,
    fontStyle: 'italic',
  },
});