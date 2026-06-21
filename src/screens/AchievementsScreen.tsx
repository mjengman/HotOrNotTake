import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { AnimatedPressable } from '../components/transitions/AnimatedPressable';
import { colors, dimensions, motion } from '../constants';
import {
  ACHIEVEMENTS,
  AchievementDefinition,
  UnlockedAchievement,
  backfillUnlockedAchievements,
  getUnlockedAchievements,
} from '../services/achievementService';
import { UserStats } from '../types/User';

interface AchievementsScreenProps {
  onClose: () => void;
  isDarkMode?: boolean;
  stats: UserStats;
}

const formatUnlockDate = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Unlocked';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const getLockedSortScore = (achievement: AchievementDefinition, stats: UserStats) => {
  if (achievement.kind === 'categories') {
    return Number.MAX_SAFE_INTEGER;
  }

  const threshold = achievement.threshold || Number.MAX_SAFE_INTEGER;
  const currentValue = achievement.kind === 'votes'
    ? stats.totalVotes || 0
    : Math.max(stats.votingStreak || 0, stats.longestVotingStreak || 0);

  return Math.max(0, threshold - currentValue);
};

const AchievementRow = ({
  achievement,
  rightLabel,
  locked = false,
  isDarkMode,
}: {
  achievement: Pick<UnlockedAchievement, 'emoji' | 'title' | 'flavor'>;
  rightLabel: string;
  locked?: boolean;
  isDarkMode: boolean;
}) => {
  const theme = isDarkMode ? colors.dark : colors.light;
  const rowOpacity = locked ? 0.62 : 1;

  return (
    <View
      style={[
        styles.achievementRow,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: rowOpacity,
        },
      ]}
    >
      <Text style={styles.achievementEmoji}>{locked ? '🔒' : achievement.emoji}</Text>
      <View style={styles.achievementCopy}>
        <View style={styles.achievementHeader}>
          <Text style={[styles.achievementTitle, { color: theme.text }]} numberOfLines={1}>
            {achievement.title}
          </Text>
        <Text style={[styles.achievementMeta, { color: theme.textSecondary }]}>
          {rightLabel}
        </Text>
      </View>
        {!locked && (
          <Text style={[styles.achievementFlavor, { color: theme.textSecondary }]}>
            {achievement.flavor}
          </Text>
        )}
      </View>
    </View>
  );
};

export const AchievementsScreen: React.FC<AchievementsScreenProps> = ({
  onClose,
  isDarkMode = false,
  stats,
}) => {
  const theme = isDarkMode ? colors.dark : colors.light;
  const [unlocked, setUnlocked] = React.useState<UnlockedAchievement[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const unlockedIds = React.useMemo(
    () => new Set(unlocked.map(achievement => achievement.id)),
    [unlocked]
  );
  const sortedUnlocked = React.useMemo(
    () => [...unlocked].sort((first, second) =>
      new Date(second.unlockedAt).getTime() - new Date(first.unlockedAt).getTime()
    ),
    [unlocked]
  );
  const lockedAchievements = React.useMemo(
    () => ACHIEVEMENTS
      .filter(achievement => !unlockedIds.has(achievement.id))
      .sort((first, second) => {
        const scoreDiff = getLockedSortScore(first, stats) - getLockedSortScore(second, stats);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        return ACHIEVEMENTS.findIndex(achievement => achievement.id === first.id) -
          ACHIEVEMENTS.findIndex(achievement => achievement.id === second.id);
      }),
    [stats, unlockedIds]
  );

  const loadAchievements = React.useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      await backfillUnlockedAchievements(stats);
      const nextUnlocked = await getUnlockedAchievements();
      setUnlocked(nextUnlocked);
    } catch (error) {
      console.warn('Unable to load achievements:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stats]);

  React.useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <AnimatedPressable
          style={[styles.closeButton, { backgroundColor: theme.surface }]}
          onPress={onClose}
          scaleValue={0.9}
          hapticFeedback={false}
          accessibilityRole="button"
          accessibilityLabel="Close achievements"
        >
          <Text style={[styles.closeButtonText, { color: theme.text }]}>✕</Text>
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.text }]}>🏅 Achievements</Text>
        <View style={styles.spacer} />
      </View>

      {loading ? (
        <View style={[styles.centerState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>
            Checking your cabinet...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadAchievements(true)}
              tintColor={theme.primary}
            />
          }
        >
          <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.summaryKicker, { color: theme.textSecondary }]}>YOUR TROPHY CASE</Text>
            <Text style={[styles.summaryCount, { color: theme.text }]}>
              {unlocked.length} of {ACHIEVEMENTS.length} unlocked
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Earned</Text>
            {sortedUnlocked.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Nothing unlocked yet</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  Your first one lands at 10 votes.
                </Text>
              </View>
            ) : (
              sortedUnlocked.map(achievement => (
                <AchievementRow
                  key={achievement.id}
                  achievement={achievement}
                  rightLabel={formatUnlockDate(achievement.unlockedAt)}
                  isDarkMode={isDarkMode}
                />
              ))
            )}
          </View>

          {lockedAchievements.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Locked</Text>
              {lockedAchievements.map(achievement => (
                <AchievementRow
                  key={achievement.id}
                  achievement={achievement}
                  rightLabel="🔒"
                  locked
                  isDarkMode={isDarkMode}
                />
              ))}
            </View>
          )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: dimensions.spacing.lg,
    paddingTop: dimensions.spacing.md,
    paddingBottom: dimensions.spacing.lg,
  },
  closeButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  closeButtonText: {
    fontSize: 26,
    fontWeight: '800',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '900',
  },
  spacer: {
    width: 52,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: dimensions.spacing.lg,
    paddingBottom: dimensions.spacing.xxl,
    gap: dimensions.spacing.xl,
  },
  summaryCard: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: dimensions.spacing.lg,
    gap: dimensions.spacing.xs,
  },
  summaryKicker: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  summaryCount: {
    fontSize: 28,
    fontWeight: '900',
  },
  section: {
    gap: dimensions.spacing.sm,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: dimensions.spacing.md,
    gap: dimensions.spacing.md,
  },
  achievementEmoji: {
    width: 34,
    textAlign: 'center',
    fontSize: 27,
  },
  achievementCopy: {
    flex: 1,
    gap: 4,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: dimensions.spacing.md,
  },
  achievementTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
  },
  achievementMeta: {
    fontSize: 13,
    fontWeight: '800',
  },
  achievementFlavor: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  centerState: {
    marginHorizontal: dimensions.spacing.lg,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: dimensions.spacing.xl,
    alignItems: 'center',
    gap: dimensions.spacing.md,
  },
  stateText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCard: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: dimensions.spacing.lg,
    gap: dimensions.spacing.xs,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
