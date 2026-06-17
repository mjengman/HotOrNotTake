import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { AnimatedPressable } from '../components/transitions/AnimatedPressable';
import { useAuth } from '../hooks/useAuth';
import {
  getUserVotes,
  getUserVotesPage,
  VoteHistoryCursor,
} from '../services/voteService';
import { getTakesByIds } from '../services/takeService';
import { Take, TakeVote } from '../types/Take';
import { colors, dimensions, motion } from '../constants';

const PAGE_SIZE = 25;

type VoteHistoryItem = TakeVote & { take?: Take };

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
  const [voteHistory, setVoteHistory] = useState<VoteHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<VoteHistoryCursor | null>(null);
  const fallbackVotesRef = useRef<TakeVote[] | null>(null);
  const fallbackOffsetRef = useRef(0);
  const voteHistoryCountRef = useRef(0);

  const theme = isDarkMode ? colors.dark : colors.light;

  useEffect(() => {
    voteHistoryCountRef.current = voteHistory.length;
  }, [voteHistory.length]);

  const hydrateVotesWithTakes = useCallback(async (votes: TakeVote[]): Promise<VoteHistoryItem[]> => {
    const takesById = await getTakesByIds(votes.map(vote => vote.takeId));
    return votes.map((vote) => {
      const take = takesById[vote.takeId];
      return take ? { ...vote, take } : vote;
    });
  }, []);

  const loadFallbackPage = useCallback(async (
    reset: boolean,
    initialOffset: number = 0
  ): Promise<void> => {
    if (!user) return;

    if (reset || !fallbackVotesRef.current) {
      const allVotes = await getUserVotes(user.uid);
      fallbackVotesRef.current = allVotes.sort(
        (a, b) => b.votedAt.getTime() - a.votedAt.getTime()
      );
      fallbackOffsetRef.current = reset ? 0 : initialOffset;
    }

    const allVotes = fallbackVotesRef.current ?? [];
    const page = allVotes.slice(fallbackOffsetRef.current, fallbackOffsetRef.current + PAGE_SIZE);
    fallbackOffsetRef.current += page.length;

    const pageWithTakes = await hydrateVotesWithTakes(page);

    setVoteHistory(prev => reset ? pageWithTakes : [...prev, ...pageWithTakes]);
    setHasMore(fallbackOffsetRef.current < allVotes.length);
    cursorRef.current = null;
  }, [hydrateVotesWithTakes, user]);

  const loadVoteHistory = useCallback(async (reset: boolean = false) => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (reset) {
      setLoading(true);
      setError(null);
      cursorRef.current = null;
      fallbackVotesRef.current = null;
      fallbackOffsetRef.current = 0;
    } else {
      setLoadingMore(true);
    }

    try {
      if (fallbackVotesRef.current) {
        await loadFallbackPage(reset);
        return;
      }

      const page = await getUserVotesPage(user.uid, PAGE_SIZE, reset ? null : cursorRef.current);
      const votesWithTakes = await hydrateVotesWithTakes(page.votes);

      setVoteHistory(prev => reset ? votesWithTakes : [...prev, ...votesWithTakes]);
      cursorRef.current = page.cursor;
      setHasMore(page.hasMore);
    } catch (err) {
      console.warn('Paged vote history unavailable, using local pagination fallback:', err);
      try {
        await loadFallbackPage(reset, reset ? 0 : voteHistoryCountRef.current);
      } catch (fallbackError) {
        console.error('Error loading vote history:', fallbackError);
        setError('Vote history is unavailable right now.');
      } finally {
        if (reset) {
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
      return;
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [hydrateVotesWithTakes, loadFallbackPage, user]);

  useEffect(() => {
    loadVoteHistory(true);
  }, [loadVoteHistory]);

  const handleTakePress = (vote: VoteHistoryItem) => {
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

  const formatSplit = (take?: Take) => {
    if (!take || take.totalVotes <= 0) {
      return 'No community votes yet';
    }

    const hotPercentage = Math.round((take.hotVotes / take.totalVotes) * 100);
    const notPercentage = 100 - hotPercentage;
    return `🔥 ${hotPercentage}% • ❄️ ${notPercentage}%`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <AnimatedPressable
          style={[styles.closeButton, { backgroundColor: theme.surface }]}
          onPress={onClose}
          scaleValue={0.9}
          hapticIntensity={motion.haptic.light}
          accessibilityRole="button"
          accessibilityLabel="Close vote history"
        >
          <Text style={[styles.closeButtonText, { color: theme.text }]}>✕</Text>
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.text }]}>📜 Vote History</Text>
        <View style={styles.spacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading your vote history...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        </View>
      ) : voteHistory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No vote history yet
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
            Cast your first HOT or NOT vote, then come back here to revisit it.
          </Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {voteHistory.map((vote, index) => (
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
              disabled={!vote.take}
              activeOpacity={0.7}
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

              {vote.take && (
                <View style={styles.takeStats}>
                  <Text style={[styles.category, { color: theme.textSecondary }]}>
                    #{vote.take.category}
                  </Text>
                  <Text style={[styles.voteStats, { color: theme.primary }]}>
                    {formatSplit(vote.take)}
                  </Text>
                </View>
              )}
              
              <Text style={[styles.tapHint, { color: theme.textSecondary }]}>
                {vote.take ? 'Tap to revisit results' : 'This take is no longer available'}
              </Text>
            </TouchableOpacity>
          ))}

          {hasMore && (
            <AnimatedPressable
              style={[
                styles.loadMoreButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  opacity: loadingMore ? 0.7 : 1,
                },
              ]}
              onPress={() => loadVoteHistory(false)}
              disabled={loadingMore}
              scaleValue={0.97}
              hapticIntensity={motion.haptic.light}
              accessibilityRole="button"
              accessibilityLabel="Load more vote history"
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[styles.loadMoreText, { color: theme.text }]}>
                  Load more votes
                </Text>
              )}
            </AnimatedPressable>
          )}
          
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
    width: motion.touchTarget.minimum,
  },
  title: {
    fontSize: dimensions.fontSize.xlarge,
    fontWeight: 'bold',
  },
  closeButton: {
    width: motion.touchTarget.minimum,
    height: motion.touchTarget.minimum,
    borderRadius: motion.touchTarget.minimum / 2,
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
    minHeight: 96,
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
  takeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: dimensions.spacing.sm,
    gap: dimensions.spacing.sm,
  },
  category: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '600',
    textTransform: 'capitalize',
    flexShrink: 1,
  },
  voteStats: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '700',
  },
  tapHint: {
    fontSize: dimensions.fontSize.small,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  loadMoreButton: {
    minHeight: motion.touchTarget.minimum,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: dimensions.spacing.md,
    paddingHorizontal: dimensions.spacing.lg,
    paddingVertical: dimensions.spacing.md,
  },
  loadMoreText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '800',
  },
  bottomSpacer: {
    height: dimensions.spacing.xl,
  },
});
