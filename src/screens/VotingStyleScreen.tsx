import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { AnimatedPressable } from '../components/transitions/AnimatedPressable';
import { colors, dimensions, motion, type Colors } from '../constants';
import { CategoryVotingProfile, VotingProfile, VotingProfileTone } from '../hooks/useVotingProfile';
import { generateDisplayName } from '../utils/nameGenerator';

const VOTING_STYLE_COUNT_UP_DURATION = 650;
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

interface VotingStyleScreenProps {
  onClose: () => void;
  isDarkMode?: boolean;
  profile: VotingProfile;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  displayName?: string;
  joinedAt?: Date;
  longestVotingStreak?: number;
  onDisplayNameChange: (displayName: string) => Promise<void>;
}

const getToneColor = (tone: VotingProfileTone, theme: Colors) => {
  switch (tone) {
    case 'contrarian':
      return theme.secondary;
    case 'reader':
      return theme.success;
    case 'loyalist':
      return theme.primary;
    case 'chaos':
      return theme.accent;
    case 'hot':
      return theme.hot;
    case 'not':
      return theme.not;
    case 'balanced':
    default:
      return theme.text;
  }
};

const getUnlockCopy = (totalVotes: number) => {
  if (totalVotes < 10) {
    return {
      title: 'Your style is warming up',
      subtitle: `Vote on ${10 - totalVotes} more ${10 - totalVotes === 1 ? 'take' : 'takes'} to unlock your first read.`,
    };
  }

  if (totalVotes < 25) {
    return {
      title: 'Taste label unlocks at 25 votes',
      subtitle: `${25 - totalVotes} more ${25 - totalVotes === 1 ? 'vote' : 'votes'} and this starts looking like a personality test.`,
    };
  }

  if (totalVotes < 50) {
    return {
      title: 'Category breakdown unlocks at 50 votes',
      subtitle: `${50 - totalVotes} more ${50 - totalVotes === 1 ? 'vote' : 'votes'} to see where your taste gets specific.`,
    };
  }

  return null;
};

const formatMemberSince = (joinedAt?: Date) => {
  if (!joinedAt || Number.isNaN(joinedAt.getTime())) {
    return 'Today';
  }

  return `${MONTH_LABELS[joinedAt.getMonth()]} ${joinedAt.getFullYear()}`;
};

const CountUpText = ({
  target,
  style,
  prefix = '',
  suffix = '',
  animate = true,
  formatter,
}: {
  target: number;
  style: object | object[];
  prefix?: string;
  suffix?: string;
  animate?: boolean;
  formatter?: (value: number) => string;
}) => {
  const countAnim = React.useRef(new Animated.Value(0)).current;
  const displayValueRef = React.useRef(0);
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    countAnim.stopAnimation();

    if (!animate) {
      countAnim.setValue(target);
      displayValueRef.current = target;
      setDisplayValue(target);
      return undefined;
    }

    countAnim.setValue(0);
    displayValueRef.current = 0;
    setDisplayValue(0);

    const listenerId = countAnim.addListener(({ value }) => {
      const roundedValue = Math.round(value);
      displayValueRef.current = roundedValue;
      setDisplayValue(roundedValue);
    });

    Animated.timing(countAnim, {
      toValue: target,
      duration: VOTING_STYLE_COUNT_UP_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        displayValueRef.current = target;
        setDisplayValue(target);
      }
    });

    return () => {
      countAnim.removeListener(listenerId);
      countAnim.stopAnimation();
    };
  }, [animate, countAnim, target]);

  const formatValue = formatter || ((value: number) => value.toLocaleString());

  return (
    <Text style={style}>
      {prefix}{formatValue(displayValue)}{suffix}
    </Text>
  );
};

const CategoryBreakdownRow = ({
  category,
  theme,
  toneColor,
}: {
  category: CategoryVotingProfile;
  theme: Colors;
  toneColor: string;
}) => (
  <View style={[styles.categoryRow, { borderColor: theme.border }]}>
    <View style={styles.categoryRowHeader}>
      <Text style={[styles.categoryLabel, { color: theme.text }]}>{category.label}</Text>
      <Text style={[styles.categoryCount, { color: theme.textSecondary }]}>
        {category.totalVotes} votes
      </Text>
    </View>

    <View style={[styles.categoryBarTrack, { backgroundColor: theme.border }]}>
      <View
        style={[
          styles.categoryBarFill,
          {
            width: `${category.hotPercentage}%`,
            backgroundColor: category.hotPercentage >= 50 ? theme.hot : theme.not,
          },
        ]}
      />
    </View>

    <View style={styles.categoryRowMeta}>
      <Text style={[styles.categoryMetaText, { color: theme.textSecondary }]}>
        🔥 {category.hotPercentage}% HOT
      </Text>
      <Text style={[styles.categoryMetaText, { color: theme.textSecondary }]}>
        agrees {category.crowdAgreementRate}%
      </Text>
    </View>

    {(category.isHottest || category.isMostContrarian) && (
      <View style={styles.categoryBadges}>
        {category.isHottest && (
          <Text style={[styles.categoryBadge, { color: theme.hot, backgroundColor: theme.hot + '16' }]}>
            hottest
          </Text>
        )}
        {category.isMostContrarian && (
          <Text style={[styles.categoryBadge, { color: toneColor, backgroundColor: toneColor + '16' }]}>
            most contrarian
          </Text>
        )}
      </View>
    )}
  </View>
);

export const VotingStyleScreen: React.FC<VotingStyleScreenProps> = ({
  onClose,
  isDarkMode = false,
  profile,
  loading,
  error,
  onRefresh,
  displayName,
  joinedAt,
  longestVotingStreak = 0,
  onDisplayNameChange,
}) => {
  const theme = isDarkMode ? colors.dark : colors.light;
  const toneColor = getToneColor(profile.tone, theme);
  const unlockCopy = getUnlockCopy(profile.totalVotes);
  const progressToFirstUnlock = Math.min(1, profile.totalVotes / 10);
  const [visibleDisplayName, setVisibleDisplayName] = React.useState(displayName);
  const [pendingDisplayName, setPendingDisplayName] = React.useState<string | null>(null);
  const [isRenaming, setIsRenaming] = React.useState(false);

  React.useEffect(() => {
    if (!isRenaming) {
      setVisibleDisplayName(displayName);
    }
  }, [displayName, isRenaming]);

  const createDisplayNameCandidate = React.useCallback(() => {
    const currentName = visibleDisplayName || displayName;
    let nextName = generateDisplayName();

    for (let attempt = 0; attempt < 5 && nextName === currentName; attempt += 1) {
      nextName = generateDisplayName();
    }

    return nextName;
  }, [displayName, visibleDisplayName]);

  const handleTryAnotherName = React.useCallback(() => {
    if (isRenaming) {
      return;
    }

    setPendingDisplayName(createDisplayNameCandidate());
  }, [createDisplayNameCandidate, isRenaming]);

  const handleKeepCurrentName = React.useCallback(() => {
    if (!isRenaming) {
      setPendingDisplayName(null);
    }
  }, [isRenaming]);

  const handleUsePendingName = React.useCallback(async () => {
    if (isRenaming || !pendingDisplayName) {
      return;
    }

    const previousName = visibleDisplayName || displayName;
    const nextName = pendingDisplayName;
    setVisibleDisplayName(nextName);
    setIsRenaming(true);

    try {
      await onDisplayNameChange(nextName);
      setPendingDisplayName(null);
    } catch (error) {
      console.warn('Unable to save generated display name:', error);
      setVisibleDisplayName(previousName);
    } finally {
      setIsRenaming(false);
    }
  }, [displayName, isRenaming, onDisplayNameChange, pendingDisplayName, visibleDisplayName]);

  const identityName = visibleDisplayName || displayName || 'AnonymousVoter';
  const memberSince = formatMemberSince(joinedAt);
  const longestStreakLabel = `${Math.max(longestVotingStreak || 0, 0)}d`;
  const renameRingColor = isDarkMode ? '#A78BFA' : '#8B5CF6';

  const renderBody = () => {
    if (loading && profile.sampledVotes === 0) {
      return (
        <View style={[styles.centerState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>
            Reading your voting style...
          </Text>
        </View>
      );
    }

    if (error && profile.sampledVotes === 0) {
      return (
        <View style={[styles.centerState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            Could not load your voting style
          </Text>
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>
            {error}
          </Text>
          <AnimatedPressable
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={onRefresh}
            scaleValue={0.95}
            hapticIntensity={motion.haptic.light}
            accessibilityRole="button"
            accessibilityLabel="Retry loading voting style"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </AnimatedPressable>
        </View>
      );
    }

    if (profile.totalVotes < 10) {
      return (
        <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={styles.heroEmoji}>🧭</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            Vote on 10 takes to unlock your taste profile.
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Every HOT or NOT vote helps the app learn what kind of chaos you enjoy.
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressToFirstUnlock * 100}%`,
                  backgroundColor: theme.primary,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: theme.textSecondary }]}>
            {profile.totalVotes}/10 votes
          </Text>
        </View>
      );
    }

    return (
      <>
        <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: toneColor + '55' }]}>
          <Text style={[styles.kicker, { color: theme.textSecondary }]}>
            YOUR VOTING STYLE
          </Text>
          {profile.tasteLabel ? (
            <>
              <Text style={[styles.styleLabel, { color: toneColor }]}>
                {profile.tasteLabel}
              </Text>
              <Text style={[styles.tagline, { color: theme.text }]}>
                {profile.tagline}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.styleLabel, { color: toneColor }]}>
                First read unlocked
              </Text>
              <Text style={[styles.tagline, { color: theme.text }]}>
                Keep voting to reveal your full label.
              </Text>
            </>
          )}

          <View style={styles.statGrid}>
            <View style={[styles.statTile, { backgroundColor: theme.background }]}>
              <CountUpText
                target={profile.hotPercentage}
                suffix="%"
                style={[styles.statValue, { color: theme.hot }]}
              />
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                HOT
              </Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: theme.background }]}>
              <CountUpText
                target={profile.notPercentage}
                suffix="%"
                style={[styles.statValue, { color: theme.not }]}
              />
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                NOT
              </Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: theme.background }]}>
              <CountUpText
                target={profile.crowdAgreementRate}
                suffix="%"
                style={[styles.statValue, { color: toneColor }]}
              />
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                agrees with room
              </Text>
            </View>
          </View>

          <View style={[styles.detailRow, { borderColor: theme.border }]}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
              Top category
            </Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>
              {profile.topCategory?.label || 'Still forming'}
            </Text>
          </View>
        </View>

        {unlockCopy && (
          <View style={[styles.unlockCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.unlockTitle, { color: theme.text }]}>{unlockCopy.title}</Text>
            <Text style={[styles.unlockSubtitle, { color: theme.textSecondary }]}>{unlockCopy.subtitle}</Text>
          </View>
        )}

        {profile.totalVotes >= 50 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Category Breakdown
            </Text>
            {profile.categories.length > 0 ? (
              profile.categories.map(category => (
                <CategoryBreakdownRow
                  key={category.category}
                  category={category}
                  theme={theme}
                  toneColor={toneColor}
                />
              ))
            ) : (
              <View style={[styles.unlockCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.unlockTitle, { color: theme.text }]}>
                  Keep spreading your votes around
                </Text>
                <Text style={[styles.unlockSubtitle, { color: theme.textSecondary }]}>
                  Categories appear here once you have at least 3 votes in them.
                </Text>
              </View>
            )}
          </View>
        )}
      </>
    );
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
          accessibilityLabel="Close voting style"
        >
          <Text style={[styles.closeButtonText, { color: theme.text }]}>✕</Text>
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.text }]}>🧭 My Voting Style</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading && profile.sampledVotes > 0}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.profileNameBlock}>
            <View style={styles.identityNameRow}>
              <Text style={[styles.identityName, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {identityName}
              </Text>
              <AnimatedPressable
                style={[
                  styles.renameIconButton,
                  {
                    backgroundColor: isDarkMode ? theme.surface : theme.background,
                    borderColor: renameRingColor,
                    shadowColor: renameRingColor,
                  },
                ]}
                onPress={handleTryAnotherName}
                disabled={isRenaming}
                scaleValue={0.9}
                hapticFeedback={false}
                accessibilityRole="button"
                accessibilityLabel="Try another anonymous name"
                accessibilityState={{ disabled: isRenaming }}
              >
                <Text
                  style={[
                    styles.renameIcon,
                    {
                      opacity: isRenaming ? 0.42 : 0.86,
                    },
                  ]}
                >
                  🎲
                </Text>
              </AnimatedPressable>
            </View>
            {pendingDisplayName ? (
              <View
                style={[
                  styles.nameConfirmPanel,
                  {
                    backgroundColor: isDarkMode ? 'rgba(167, 139, 250, 0.10)' : 'rgba(139, 92, 246, 0.08)',
                    borderColor: isDarkMode ? 'rgba(167, 139, 250, 0.38)' : 'rgba(139, 92, 246, 0.26)',
                  },
                ]}
              >
                <Text style={[styles.nameConfirmTitle, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
                  Try {pendingDisplayName}?
                </Text>
                <View style={styles.nameConfirmActions}>
                  <AnimatedPressable
                    style={[
                      styles.nameConfirmButton,
                      styles.nameConfirmSecondary,
                      { borderColor: theme.border },
                    ]}
                    onPress={handleKeepCurrentName}
                    disabled={isRenaming}
                    scaleValue={0.96}
                    hapticFeedback={false}
                    accessibilityRole="button"
                    accessibilityLabel="Keep current anonymous name"
                    accessibilityState={{ disabled: isRenaming }}
                  >
                    <Text style={[styles.nameConfirmSecondaryText, { color: theme.textSecondary }]}>
                      Keep current
                    </Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    style={[
                      styles.nameConfirmButton,
                      styles.nameConfirmPrimary,
                      {
                        backgroundColor: isDarkMode ? 'rgba(167, 139, 250, 0.18)' : 'rgba(139, 92, 246, 0.13)',
                        borderColor: renameRingColor,
                        opacity: isRenaming ? 0.62 : 1,
                      },
                    ]}
                    onPress={handleUsePendingName}
                    disabled={isRenaming}
                    scaleValue={0.96}
                    hapticFeedback={false}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${pendingDisplayName} as anonymous name`}
                    accessibilityState={{ disabled: isRenaming }}
                  >
                    <Text style={[styles.nameConfirmPrimaryText, { color: renameRingColor }]}>
                      {isRenaming ? 'Saving...' : 'Use new name'}
                    </Text>
                  </AnimatedPressable>
                </View>
              </View>
            ) : null}
          </View>

          <View style={[styles.profileMetaRow, { borderColor: theme.border }]}>
            <View style={styles.profileMetaItem}>
              <Text style={[styles.profileMetaLabel, { color: theme.textSecondary }]}>
                Member since
              </Text>
              <Text style={[styles.profileMetaValue, { color: theme.text }]}>
                {memberSince}
              </Text>
            </View>
            <View style={[styles.profileMetaDivider, { backgroundColor: theme.border }]} />
            <View style={styles.profileMetaItem}>
              <Text style={[styles.profileMetaLabel, { color: theme.textSecondary }]}>
                Longest streak
              </Text>
              <Text style={[styles.profileMetaValue, { color: theme.text }]}>
                {longestStreakLabel}
              </Text>
            </View>
            <View style={[styles.profileMetaDivider, { backgroundColor: theme.border }]} />
            <View style={styles.profileMetaItem}>
              <Text style={[styles.profileMetaLabel, { color: theme.textSecondary }]}>
                Your votes
              </Text>
              <Text style={[styles.profileMetaValue, { color: theme.text }]}>
                {profile.totalVotes.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {renderBody()}

        <Text style={[styles.privacyFooter, { color: theme.textSecondary }]}>
          Based only on your saved votes in this app.
        </Text>
      </ScrollView>
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
    paddingVertical: dimensions.spacing.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: '700',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: dimensions.spacing.lg,
    paddingBottom: dimensions.spacing.xxl,
    gap: dimensions.spacing.md,
  },
  profileCard: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: dimensions.spacing.lg,
    gap: dimensions.spacing.md,
  },
  profileNameBlock: {
    width: '100%',
    alignItems: 'center',
  },
  identityNameRow: {
    width: '100%',
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 52,
    position: 'relative',
  },
  identityName: {
    flexShrink: 1,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
  renameIconButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.75,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: dimensions.spacing.sm,
    elevation: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.24,
    shadowRadius: 5.5,
  },
  renameIcon: {
    fontSize: 21,
  },
  nameConfirmPanel: {
    width: '100%',
    marginTop: dimensions.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: dimensions.borderRadius.md,
    padding: dimensions.spacing.sm,
    gap: dimensions.spacing.sm,
  },
  nameConfirmTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  nameConfirmActions: {
    flexDirection: 'row',
    gap: dimensions.spacing.sm,
  },
  nameConfirmButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: dimensions.spacing.sm,
  },
  nameConfirmSecondary: {
    backgroundColor: 'transparent',
  },
  nameConfirmPrimary: {
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  nameConfirmSecondaryText: {
    fontSize: 13,
    fontWeight: '800',
  },
  nameConfirmPrimaryText: {
    fontSize: 13,
    fontWeight: '900',
  },
  profileMetaRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: dimensions.spacing.md,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  profileMetaItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  profileMetaDivider: {
    width: StyleSheet.hairlineWidth,
  },
  profileMetaLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  profileMetaValue: {
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  centerState: {
    minHeight: 260,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    padding: dimensions.spacing.xl,
    gap: dimensions.spacing.md,
  },
  heroCard: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: dimensions.spacing.xl,
    gap: dimensions.spacing.md,
  },
  heroEmoji: {
    fontSize: 42,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: dimensions.spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  styleLabel: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    textAlign: 'center',
  },
  tagline: {
    fontSize: 18,
    lineHeight: 25,
    textAlign: 'center',
    fontWeight: '700',
  },
  statGrid: {
    flexDirection: 'row',
    gap: dimensions.spacing.sm,
  },
  statTile: {
    flex: 1,
    minHeight: 94,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: dimensions.spacing.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  detailRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: dimensions.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: dimensions.spacing.md,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '800',
  },
  unlockCard: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: dimensions.spacing.lg,
    gap: dimensions.spacing.xs,
  },
  unlockTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  unlockSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    gap: dimensions.spacing.sm,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  categoryRow: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: dimensions.spacing.md,
    gap: dimensions.spacing.sm,
  },
  categoryRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: dimensions.spacing.md,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  categoryCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryBarTrack: {
    height: 9,
    borderRadius: 999,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  categoryRowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: dimensions.spacing.md,
  },
  categoryMetaText: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: dimensions.spacing.xs,
  },
  categoryBadge: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: dimensions.spacing.sm,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  stateText: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: dimensions.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  privacyFooter: {
    paddingTop: dimensions.spacing.sm,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
  },
});
