import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { TakeCard } from './TakeCard';
import { AnimatedPressable } from './transitions/AnimatedPressable';
import { Take } from '../types/Take';
import { colors, dimensions } from '../constants';

interface TakeStatsModalProps {
  visible: boolean;
  take: Take;
  userVote: 'hot' | 'not';
  onClose: () => void;
  onChangeVote?: (take: Take) => void;
  isDarkMode?: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const TakeStatsModal: React.FC<TakeStatsModalProps> = ({
  visible,
  take,
  userVote,
  onClose,
  onChangeVote,
  isDarkMode = false,
}) => {
  const theme = isDarkMode ? colors.dark : colors.light;
  
  const hotPercentage = take.totalVotes > 0 ? Math.round((take.hotVotes / take.totalVotes) * 100) : 0;
  const notPercentage = take.totalVotes > 0 ? Math.round((take.notVotes / take.totalVotes) * 100) : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.modalContent, { backgroundColor: theme.background }]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                Take Stats
              </Text>
              <AnimatedPressable
                style={[styles.closeButton, { backgroundColor: theme.surface }]}
                onPress={onClose}
                scaleValue={0.9}
                hapticIntensity={8}
              >
                <Text style={[styles.closeButtonText, { color: theme.text }]}>✕</Text>
              </AnimatedPressable>
            </View>

            {/* Take Card */}
            <View style={styles.cardContainer}>
              <TakeCard
                take={take}
                isDarkMode={isDarkMode}
                isInteractive={false}
              />
            </View>

            {/* Your Vote */}
            <View style={styles.voteSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Vote</Text>
              <View style={[
                styles.userVoteBadge,
                { 
                  backgroundColor: userVote === 'hot' ? '#FF6B4720' : '#4A9EFF20',
                  borderColor: userVote === 'hot' ? '#FF6B47' : '#4A9EFF',
                }
              ]}>
                <Text style={[
                  styles.userVoteText,
                  { color: userVote === 'hot' ? '#FF6B47' : '#4A9EFF' }
                ]}>
                  {userVote === 'hot' ? '🔥 HOT' : '❄️ NOT'}
                </Text>
              </View>
              
              {onChangeVote && (
                <TouchableOpacity
                  style={styles.changeVoteButton}
                  onPress={() => onChangeVote(take)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.changeVoteText, { color: theme.textSecondary }]}>
                    Change your vote
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Stats */}
            <View style={styles.statsSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Results</Text>
              
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: '#FF6B47' }]}>
                    {take.hotVotes}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                    🔥 Hot Votes
                  </Text>
                  <Text style={[styles.statPercentage, { color: '#FF6B47' }]}>
                    {hotPercentage}%
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: '#4A9EFF' }]}>
                    {take.notVotes}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                    ❄️ Not Votes
                  </Text>
                  <Text style={[styles.statPercentage, { color: '#4A9EFF' }]}>
                    {notPercentage}%
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: theme.text }]}>
                    {take.totalVotes}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                    Total Votes
                  </Text>
                </View>
              </View>
            </View>

            {/* Close button */}
            <AnimatedPressable
              style={[styles.closeActionButton, { backgroundColor: theme.primary }]}
              onPress={onClose}
              scaleValue={0.95}
              hapticIntensity={10}
            >
              <Text style={styles.closeActionText}>Close</Text>
            </AnimatedPressable>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: screenWidth * 0.9,
    maxHeight: screenHeight * 0.8,
  },
  modalContent: {
    borderRadius: 16,
    padding: dimensions.spacing.lg,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: dimensions.spacing.lg,
  },
  headerTitle: {
    fontSize: dimensions.fontSize.xlarge,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: 'bold',
  },
  cardContainer: {
    backgroundColor: 'green',
    marginBottom: dimensions.spacing.lg,
    alignItems: 'center',
  },
  voteSection: {
    marginBottom: dimensions.spacing.lg,
  },
  sectionTitle: {
    fontSize: dimensions.fontSize.large,
    fontWeight: '600',
    marginBottom: dimensions.spacing.sm,
  },
  userVoteBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: dimensions.spacing.md,
    paddingVertical: dimensions.spacing.sm,
    borderRadius: 20,
    borderWidth: 2,
  },
  userVoteText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: 'bold',
  },
  changeVoteButton: {
    marginTop: dimensions.spacing.sm,
    alignSelf: 'flex-start',
  },
  changeVoteText: {
    fontSize: dimensions.fontSize.small,
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  statsSection: {
    marginBottom: dimensions.spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: dimensions.spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: dimensions.fontSize.xxlarge,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: dimensions.fontSize.small,
    textAlign: 'center',
    fontWeight: '500',
  },
  statPercentage: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '600',
  },
  closeActionButton: {
    paddingVertical: dimensions.spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeActionText: {
    color: '#FFFFFF',
    fontSize: dimensions.fontSize.medium,
    fontWeight: '600',
  },
});