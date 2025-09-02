import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { AnimatedPressable } from '../components/transitions/AnimatedPressable';
import { TakeCard } from '../components/TakeCard';
import { useAuth } from '../hooks/useAuth';
import { getUserVotes } from '../services/voteService';
import { doc, getDoc, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Take, TakeVote } from '../types/Take';
import { colors, dimensions } from '../constants';

interface RecentVotesScreenProps {
  onClose: () => void;
  onShowTakeStats: (take: Take, vote: 'hot' | 'not') => void;
  isDarkMode?: boolean;
}

export const RecentVotesScreen: React.FC<RecentVotesScreenProps> = ({
  onClose,
  onShowTakeStats,
  isDarkMode = false,
}) => {
  const { user } = useAuth();
  const [recentVotes, setRecentVotes] = useState<(TakeVote & { take?: Take })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const theme = isDarkMode ? colors.dark : colors.light;

  useEffect(() => {
    const loadRecentVotes = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const votes = await getUserVotes(user.uid);
        
        // Get the last 10 votes and sort by most recent
        const recentVotesList = votes
          .sort((a, b) => b.votedAt.getTime() - a.votedAt.getTime())
          .slice(0, 10);
        
        // Fetch the actual take data for each vote
        const votesWithTakes = await Promise.all(
          recentVotesList.map(async (vote) => {
            try {
              const takeDoc = await getDoc(doc(db, 'takes', vote.takeId));
              if (takeDoc.exists()) {
                const takeData = takeDoc.data();
                const take: Take = {
                  id: takeDoc.id,
                  text: takeData.text,
                  category: takeData.category,
                  hotVotes: takeData.hotVotes || 0,
                  notVotes: takeData.notVotes || 0,
                  totalVotes: takeData.totalVotes || 0,
                  createdAt: takeData.createdAt?.toDate() || new Date(),
                  userId: takeData.userId,
                  isApproved: takeData.isApproved || false,
                  status: takeData.status || 'approved',
                  submittedAt: takeData.submittedAt?.toDate() || takeData.createdAt?.toDate() || new Date(),
                  approvedAt: takeData.approvedAt?.toDate(),
                  rejectedAt: takeData.rejectedAt?.toDate(),
                  rejectionReason: takeData.rejectionReason,
                  reportCount: takeData.reportCount || 0,
                  isAIGenerated: takeData.isAIGenerated || false,
                };
                return { ...vote, take };
              }
              return vote; // Return vote without take if take not found
            } catch (error) {
              console.error('Error fetching take:', error);
              return vote; // Return vote without take on error
            }
          })
        );
        
        setRecentVotes(votesWithTakes);
      } catch (err) {
        console.error('Error loading recent votes:', err);
        setError('Failed to load recent votes');
      } finally {
        setLoading(false);
      }
    };

    loadRecentVotes();
  }, [user]);

  const handleTakePress = (vote: TakeVote) => {
    if (vote.take) {
      onShowTakeStats(vote.take, vote.vote);
      onClose(); // Close the modal after selecting a take
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <AnimatedPressable
          style={[styles.closeButton, { backgroundColor: theme.surface }]}
          onPress={onClose}
          scaleValue={0.9}
          hapticIntensity={8}
        >
          <Text style={[styles.closeButtonText, { color: theme.text }]}>✕</Text>
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.text }]}>📊 Recent Votes</Text>
        <View style={styles.spacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading your votes...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        </View>
      ) : recentVotes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No recent votes found
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
            Start voting on takes to see them here!
          </Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {recentVotes.map((vote, index) => (
            <TouchableOpacity
              key={`${vote.takeId}-${index}`}
              style={[
                styles.voteItem,
                { 
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                }
              ]}
              onPress={() => handleTakePress(vote)}
              activeOpacity={0.7}
              delayPressIn={100}
            >
              <View style={styles.voteHeader}>
                <Text style={[
                  styles.voteType,
                  { 
                    color: vote.vote === 'hot' ? '#FF6B47' : '#4A9EFF',
                    backgroundColor: vote.vote === 'hot' ? '#FF6B4720' : '#4A9EFF20',
                  }
                ]}>
                  {vote.vote === 'hot' ? '🔥 HOT' : '❄️ NOT'}
                </Text>
                <Text style={[styles.timeAgo, { color: theme.textSecondary }]}>
                  {formatTimeAgo(vote.votedAt)}
                </Text>
              </View>
              
              <Text 
                style={[styles.takeText, { color: theme.text }]}
                numberOfLines={3}
              >
                {vote.take?.text || 'Take content unavailable'}
              </Text>
              
              <Text style={[styles.tapHint, { color: theme.textSecondary }]}>
                Tap to view stats
              </Text>
            </TouchableOpacity>
          ))}
          
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: dimensions.spacing.lg,
    paddingVertical: dimensions.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  spacer: {
    width: 36, // Same width as close button to center the title
  },
  title: {
    fontSize: dimensions.fontSize.xlarge,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: dimensions.fontSize.large,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: dimensions.spacing.md,
  },
  loadingText: {
    fontSize: dimensions.fontSize.medium,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: dimensions.spacing.lg,
  },
  errorText: {
    fontSize: dimensions.fontSize.medium,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: dimensions.spacing.lg,
    gap: dimensions.spacing.sm,
  },
  emptyText: {
    fontSize: dimensions.fontSize.large,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: dimensions.fontSize.medium,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: dimensions.spacing.lg,
    paddingBottom: dimensions.spacing.lg,
  },
  voteItem: {
    marginVertical: dimensions.spacing.sm,
    padding: dimensions.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  voteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: dimensions.spacing.sm,
  },
  voteType: {
    fontSize: dimensions.fontSize.small,
    fontWeight: 'bold',
    paddingHorizontal: dimensions.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  timeAgo: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '500',
  },
  takeText: {
    fontSize: dimensions.fontSize.medium,
    lineHeight: 20,
    marginBottom: dimensions.spacing.sm,
  },
  tapHint: {
    fontSize: dimensions.fontSize.small,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  bottomSpacer: {
    height: dimensions.spacing.xl,
  },
});