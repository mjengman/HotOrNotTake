import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView } from 'react-native-gesture-handler';
import { colors, dimensions, motion } from '../constants';
import { AnimatedPressable } from '../components/transitions/AnimatedPressable';
import { LeaderboardSkeleton } from '../components/loading/LeaderboardSkeleton';
import { Take } from '../types';
import {
  getHottestTakesByCategory,
  getNottestTakesByCategory,
  getMostDivisiveTakesByCategory,
  getMostSkippedTakesByCategory,
  getDatabaseStats,
} from '../services/takeService';

interface LeaderboardScreenProps {
  onClose: () => void;
  onShowTakeStats?: (take: Take, vote: 'hot' | 'not' | null) => void;
  isDarkMode?: boolean;
}

type LeaderboardTab = 'hottest' | 'nottest' | 'divisive' | 'skipped';
type TakeLeaderboard = Record<string, Take[]>;
type SkippedLeaderboard = Record<string, { take: Take; skipCount: number }[]>;
type LoadingTabs = Record<LeaderboardTab, boolean>;
type LeaderboardCache = {
  savedAt: number;
  hottest: TakeLeaderboard;
  nottest: TakeLeaderboard;
  divisive: TakeLeaderboard;
  skipped: SkippedLeaderboard;
  skippedLoadFailed: boolean;
};

const LEADERBOARD_CACHE_VERSION = 'v1';
const LEADERBOARD_CACHE_KEY = `leaderboards-cache:${LEADERBOARD_CACHE_VERSION}`;
const LEADERBOARD_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const DEFAULT_LOADING_TABS: LoadingTabs = {
  hottest: true,
  nottest: true,
  divisive: true,
  skipped: true,
};

const READY_TABS: LoadingTabs = {
  hottest: false,
  nottest: false,
  divisive: false,
  skipped: false,
};

const reviveDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const reviveTake = (take: Take): Take => ({
  ...take,
  createdAt: reviveDate(take.createdAt) || new Date(),
  submittedAt: reviveDate(take.submittedAt) || new Date(),
  approvedAt: reviveDate(take.approvedAt),
  rejectedAt: reviveDate(take.rejectedAt),
});

const reviveTakeLeaderboard = (data: TakeLeaderboard = {}): TakeLeaderboard =>
  Object.fromEntries(
    Object.entries(data).map(([category, takes]) => [
      category,
      takes.map(reviveTake),
    ])
  );

const reviveSkippedLeaderboard = (data: SkippedLeaderboard = {}): SkippedLeaderboard =>
  Object.fromEntries(
    Object.entries(data).map(([category, items]) => [
      category,
      items.map(item => ({
        ...item,
        take: reviveTake(item.take),
      })),
    ])
  );

const readLeaderboardCache = async (): Promise<LeaderboardCache | null> => {
  try {
    const raw = await AsyncStorage.getItem(LEADERBOARD_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed.savedAt || Date.now() - parsed.savedAt > LEADERBOARD_CACHE_TTL_MS) {
      return null;
    }

    return {
      savedAt: parsed.savedAt,
      hottest: reviveTakeLeaderboard(parsed.hottest),
      nottest: reviveTakeLeaderboard(parsed.nottest),
      divisive: reviveTakeLeaderboard(parsed.divisive),
      skipped: reviveSkippedLeaderboard(parsed.skipped),
      skippedLoadFailed: Boolean(parsed.skippedLoadFailed),
    };
  } catch (error) {
    console.warn('Unable to read leaderboard cache:', error);
    return null;
  }
};

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  onClose,
  onShowTakeStats,
  isDarkMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('hottest');
  const [loadingTabs, setLoadingTabs] = useState<LoadingTabs>(DEFAULT_LOADING_TABS);
  const [refreshing, setRefreshing] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  
  const [hottestTakes, setHottestTakes] = useState<TakeLeaderboard>({});
  const [nottestTakes, setNottestTakes] = useState<TakeLeaderboard>({});
  const [divisiveTakes, setDivisiveTakes] = useState<TakeLeaderboard>({});
  const [skippedTakes, setSkippedTakes] = useState<SkippedLeaderboard>({});
  const [skippedLoadFailed, setSkippedLoadFailed] = useState(false);
  const leaderboardCacheRef = useRef<Omit<LeaderboardCache, 'savedAt'>>({
    hottest: {},
    nottest: {},
    divisive: {},
    skipped: {},
    skippedLoadFailed: false,
  });
  
  // Hidden dev feature - tap counter for database stats
  const [hottestTapCount, setHottestTapCount] = useState(0);
  const [showDbStats, setShowDbStats] = useState(false);
  const [dbStats, setDbStats] = useState<{
    total: number;
    approved: number;
    byCategory: { [category: string]: number };
    aiGenerated: number;
    userGenerated: number;
  } | null>(null);
  
  
  const theme = isDarkMode ? colors.dark : colors.light;

  const persistLeaderboardCache = React.useCallback((patch: Partial<Omit<LeaderboardCache, 'savedAt'>>) => {
    leaderboardCacheRef.current = {
      ...leaderboardCacheRef.current,
      ...patch,
    };

    AsyncStorage.setItem(
      LEADERBOARD_CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        ...leaderboardCacheRef.current,
      })
    ).catch(error => {
      console.warn('Unable to write leaderboard cache:', error);
    });
  }, []);

  const setTabLoading = React.useCallback((tab: LeaderboardTab, value: boolean) => {
    setLoadingTabs(previous => ({
      ...previous,
      [tab]: value,
    }));
  }, []);

  const loadLeaderboards = React.useCallback(async () => {
    const hasLeaderboardData = (tab: LeaderboardTab) =>
      Object.keys(leaderboardCacheRef.current[tab]).length > 0;

    setLoadingTabs(previous => ({
      hottest: previous.hottest && !hasLeaderboardData('hottest'),
      nottest: previous.nottest && !hasLeaderboardData('nottest'),
      divisive: previous.divisive && !hasLeaderboardData('divisive'),
      skipped: previous.skipped && !hasLeaderboardData('skipped'),
    }));

    const loadHottest = async () => {
      setTabLoading('hottest', !hasLeaderboardData('hottest'));
      try {
        const value = await getHottestTakesByCategory();
        setHottestTakes(value);
        persistLeaderboardCache({ hottest: value });
      } catch (error) {
        console.warn('Hottest leaderboard unavailable:', error);
      } finally {
        setTabLoading('hottest', false);
      }
    };

    const loadNottest = async () => {
      setTabLoading('nottest', !hasLeaderboardData('nottest'));
      try {
        const value = await getNottestTakesByCategory();
        setNottestTakes(value);
        persistLeaderboardCache({ nottest: value });
      } catch (error) {
        console.warn('Nottest leaderboard unavailable:', error);
      } finally {
        setTabLoading('nottest', false);
      }
    };

    const loadDivisive = async () => {
      setTabLoading('divisive', !hasLeaderboardData('divisive'));
      try {
        const value = await getMostDivisiveTakesByCategory();
        setDivisiveTakes(value);
        persistLeaderboardCache({ divisive: value });
      } catch (error) {
        console.warn('Divisive leaderboard unavailable:', error);
        setDivisiveTakes({});
        persistLeaderboardCache({ divisive: {} });
      } finally {
        setTabLoading('divisive', false);
      }
    };

    const loadSkipped = async () => {
      setTabLoading('skipped', !hasLeaderboardData('skipped'));
      try {
        const value = await getMostSkippedTakesByCategory();
        setSkippedTakes(value);
        setSkippedLoadFailed(false);
        persistLeaderboardCache({ skipped: value, skippedLoadFailed: false });
      } catch (error) {
        console.warn('Skipped leaderboard unavailable:', error);
        setSkippedTakes({});
        setSkippedLoadFailed(true);
        persistLeaderboardCache({ skipped: {}, skippedLoadFailed: true });
      } finally {
        setTabLoading('skipped', false);
      }
    };

    await Promise.all([loadHottest(), loadNottest(), loadDivisive(), loadSkipped()]);
  }, [persistLeaderboardCache, setTabLoading]);

  const onRefresh = async () => {
    // Only refresh if we're at the top
    if (!isAtTop) {
      return;
    }
    
    setRefreshing(true);
    await loadLeaderboards();
    setRefreshing(false);
  };

  const handleScroll = (event: any) => {
    const { contentOffset } = event.nativeEvent;
    // Be very strict - only allow refresh at exactly the top
    const newIsAtTop = contentOffset.y <= 1;
    
    // Only update if the state actually changed to avoid unnecessary re-renders
    if (newIsAtTop !== isAtTop) {
      setIsAtTop(newIsAtTop);
    }
  };

  // Hidden dev feature: Handle hottest tab taps
  const handleHottestTabPress = async () => {
    const newCount = hottestTapCount + 1;
    setHottestTapCount(newCount);
    
    if (newCount >= 5 && !showDbStats) {
      console.log('🔍 Loading database stats (dev feature)...');
      try {
        const stats = await getDatabaseStats();
        setDbStats(stats);
        setShowDbStats(true);
        console.log('📊 Database stats loaded:', stats);
      } catch (error) {
        console.error('Error loading database stats:', error);
      }
    }
    
    setActiveTab('hottest');
  };

  const handleSkippedTabPress = () => {
    setActiveTab('skipped');
  };

  useEffect(() => {
    let isMounted = true;

    const bootstrapLeaderboards = async () => {
      const cached = await readLeaderboardCache();

      if (cached && isMounted) {
        leaderboardCacheRef.current = {
          hottest: cached.hottest,
          nottest: cached.nottest,
          divisive: cached.divisive,
          skipped: cached.skipped,
          skippedLoadFailed: cached.skippedLoadFailed,
        };
        setHottestTakes(cached.hottest);
        setNottestTakes(cached.nottest);
        setDivisiveTakes(cached.divisive);
        setSkippedTakes(cached.skipped);
        setSkippedLoadFailed(cached.skippedLoadFailed);
        setLoadingTabs(READY_TABS);
      }

      if (isMounted) {
        loadLeaderboards();
      }
    };

    bootstrapLeaderboards();

    return () => {
      isMounted = false;
    };
    // Load once on mount; refreshes are triggered manually.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTakePress = (take: Take) => {
    if (onShowTakeStats) {
      // For leaderboard takes, we don't know the user's vote
      onShowTakeStats(take, null);
      // Close the leaderboard modal so user can see the stats clearly
      onClose();
    }
  };

  const renderTakeItem = (take: Take, rank: number, subtitle: string) => {
    // Get medal emoji for top 3, otherwise show number
    const getRankDisplay = (rank: number) => {
      switch (rank) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return rank.toString();
      }
    };

    return (
      <TouchableOpacity
        key={take.id}
        style={[styles.takeItem, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}
        onPress={() => handleTakePress(take)}
        activeOpacity={0.7}
        onPressIn={() => setScrollEnabled(false)}
        onPressOut={() => setScrollEnabled(true)}
      >
        <View style={[
          styles.rankBadge, 
          rank <= 3 ? styles.medalBadge : styles.numberBadge
        ]}>
          <Text style={[
            styles.rankText,
            rank <= 3 ? styles.medalText : styles.numberText
          ]}>
            {getRankDisplay(rank)}
          </Text>
        </View>
      
      <View style={styles.takeContent}>
        <Text style={[styles.takeText, { color: theme.text }]} numberOfLines={3}>
          {take.text}
        </Text>
        <View style={styles.takeMetadata}>
          <Text style={[styles.categoryText, { color: theme.textSecondary }]}>
            #{take.category}
          </Text>
          <Text style={[styles.statsText, { color: theme.primary }]}>
            {subtitle}
          </Text>
        </View>
        {onShowTakeStats && (
          <Text style={[styles.tapHint, { color: theme.textSecondary }]}>
            Tap to view full stats
          </Text>
        )}
      </View>
    </TouchableOpacity>
    );
  };

  const renderSkippedTakeItem = (item: { take: Take; skipCount: number }, rank: number) => (
    renderTakeItem(item.take, rank, `${item.skipCount} skips`)
  );

  const getSplitSubtitle = (take: Take) => {
    const hotPercentage =
      typeof take.hotPercentage === 'number'
        ? take.hotPercentage
        : take.totalVotes > 0
          ? Math.round((take.hotVotes / take.totalVotes) * 100)
          : 50;
    const notPercentage =
      typeof take.notPercentage === 'number'
        ? take.notPercentage
        : 100 - hotPercentage;

    return `🔥 ${hotPercentage}% • ❄️ ${notPercentage}%`;
  };

  const renderCategorySection = (categoryName: string, takes: Take[] | { take: Take; skipCount: number }[]) => (
    <View key={categoryName} style={styles.categorySection}>
      <Text style={[styles.categoryTitle, { color: theme.text }]}>
        {categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}
      </Text>
      <View style={styles.takesContainer}>
        {takes.map((item, index) => {
          if (activeTab === 'skipped') {
            const skippedItem = item as { take: Take; skipCount: number };
            return renderSkippedTakeItem(skippedItem, index + 1);
          }

          const take = item as Take;
          const subtitle = activeTab === 'hottest'
            ? `${take.hotVotes} 🔥 votes`
            : activeTab === 'nottest'
              ? `${take.notVotes} ❄️ votes`
              : getSplitSubtitle(take);
          return renderTakeItem(take, index + 1, subtitle);
        })}
      </View>
    </View>
  );

  const getCurrentData = () => {
    switch (activeTab) {
      case 'hottest':
        return hottestTakes;
      case 'nottest':
        return nottestTakes;
      case 'divisive':
        return divisiveTakes;
      case 'skipped':
        return skippedTakes;
      default:
        return {};
    }
  };

  const currentData = getCurrentData();
  const isCurrentTabLoading = loadingTabs[activeTab] && Object.keys(currentData).length === 0;

  const getEmptyStateCopy = () => {
    if (activeTab === 'hottest') {
      return {
        title: 'No hot takes ranked yet',
        description: 'Once the community starts heating takes up, the strongest reactions will show here.',
      };
    }

    if (activeTab === 'nottest') {
      return {
        title: 'No cold takes ranked yet',
        description: 'The iciest community reactions will appear here after more NOT votes land.',
      };
    }

    if (activeTab === 'divisive') {
      return {
        title: 'No divisive takes yet',
        description: "The room's closest calls will collect here as more people vote.",
      };
    }

    return {
      title: skippedLoadFailed ? 'Skipped rankings are resting' : 'No skipped takes ranked yet',
      description: skippedLoadFailed
        ? 'Skip data is unavailable right now, but the rest of the leaderboards are still ready.'
        : 'When people start passing on takes, the most-skipped debates will collect here.',
    };
  };

  const tabs: { key: LeaderboardTab; label: string; icon: string }[] = [
    { key: 'hottest', label: 'Hottest', icon: '🔥' },
    { key: 'nottest', label: 'Nottest', icon: '❄️' },
    { key: 'divisive', label: 'Most Divisive', icon: '⚔️' },
    { key: 'skipped', label: 'Most Skipped', icon: '⏭️' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable
          style={[styles.closeButton, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}
          onPress={onClose}
          scaleValue={0.9}
          hapticIntensity={motion.haptic.light}
          accessibilityRole="button"
          accessibilityLabel="Close leaderboards"
        >
          <Text style={[styles.closeButtonText, { color: theme.text }]}>✕</Text>
        </AnimatedPressable>
        
        <Text style={[styles.title, { color: theme.text }]}>
          🏆 Leaderboards
        </Text>
        
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <AnimatedPressable
            key={tab.key}
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === tab.key ? theme.primary : (isDarkMode ? theme.surface : '#F0F0F1'),
              },
            ]}
            onPress={
              tab.key === 'hottest' ? handleHottestTabPress :
              tab.key === 'skipped' ? handleSkippedTabPress :
              () => setActiveTab(tab.key)
            }
            scaleValue={0.97}
            hapticIntensity={motion.haptic.light}
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === tab.key }}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === tab.key ? '#FFFFFF' : theme.text,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
            >
              {tab.label}
            </Text>
          </AnimatedPressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        scrollEnabled={scrollEnabled}
      >
        {isCurrentTabLoading ? (
          <View style={styles.contentContainer}>
            <LeaderboardSkeleton isDarkMode={isDarkMode} />
          </View>
        ) : (
          <View style={styles.contentContainer}>
            {/* Database Stats - Hidden Dev Feature */}
            {showDbStats && dbStats && (
              <View style={[styles.dbStatsContainer, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1', borderColor: theme.border }]}>
                <Text style={[styles.dbStatsTitle, { color: theme.text }]}>🔍 Database Stats</Text>
                <Text style={[styles.dbStatsText, { color: theme.textSecondary }]}>
                  Approved Takes: {dbStats.total}
                </Text>
                <Text style={[styles.dbStatsText, { color: theme.textSecondary }]}>
                  AI Generated: {dbStats.aiGenerated} | User Generated: {dbStats.userGenerated}
                </Text>
                <Text style={[styles.dbStatsText, { color: theme.textSecondary }]}>
                  All Categories ({Object.keys(dbStats.byCategory).length} total):
                </Text>
                {Object.entries(dbStats.byCategory)
                  .sort((a, b) => b[1] - a[1]) // Sort by count descending
                  .map(([category, count], index) => {
                    const percentage = ((count / dbStats.total) * 100).toFixed(1);
                    return (
                      <Text key={category} style={[styles.dbCategoryText, { color: theme.textSecondary }]}>
                        {index + 1}. {category}: {count} ({percentage}%)
                      </Text>
                    );
                  })}
                <TouchableOpacity 
                  style={styles.hideStatsButton}
                  onPress={() => {
                    setShowDbStats(false);
                    setHottestTapCount(0);
                  }}
                >
                  <Text style={[styles.hideStatsText, { color: theme.primary }]}>Hide Stats</Text>
                </TouchableOpacity>
              </View>
            )}

            {Object.keys(currentData).length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  {getEmptyStateCopy().title}
                </Text>
                <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>
                  {getEmptyStateCopy().description}
                </Text>
              </View>
            ) : (
              Object.entries(currentData).map(([category, takes]) =>
                renderCategorySection(category, takes)
              )
            )}
          </View>
        )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: dimensions.spacing.lg,
    paddingVertical: dimensions.spacing.md,
  },
  closeButton: {
    width: motion.touchTarget.minimum,
    height: motion.touchTarget.minimum,
    borderRadius: motion.touchTarget.minimum / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  title: {
    fontSize: dimensions.fontSize.xlarge,
    fontWeight: 'bold',
  },
  placeholder: {
    width: motion.touchTarget.minimum,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: dimensions.spacing.lg,
    marginBottom: dimensions.spacing.md,
    gap: dimensions.spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: dimensions.spacing.md,
    minHeight: motion.touchTarget.minimum,
    borderRadius: 12,
    gap: dimensions.spacing.xs,
  },
  tabIcon: {
    fontSize: 16,
  },
  tabText: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: dimensions.spacing.lg,
    paddingBottom: dimensions.spacing.xl,
  },
  categorySection: {
    marginBottom: dimensions.spacing.xl,
  },
  categoryTitle: {
    fontSize: dimensions.fontSize.large,
    fontWeight: 'bold',
    marginBottom: dimensions.spacing.md,
    textAlign: 'center',
  },
  takesContainer: {
    gap: dimensions.spacing.md,
  },
  takeItem: {
    flexDirection: 'row',
    padding: dimensions.spacing.md,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  tapHint: {
    fontSize: dimensions.fontSize.small,
    fontStyle: 'italic',
    marginTop: dimensions.spacing.xs,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: dimensions.spacing.md,
  },
  medalBadge: {
    backgroundColor: 'transparent', // No background for medal emojis
  },
  numberBadge: {
    backgroundColor: '#FFD700', // Keep gold background for numbers
  },
  rankText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: 'bold',
  },
  medalText: {
    fontSize: 20, // Slightly larger for medal emojis
    // Remove color styling to let emojis display properly
  },
  numberText: {
    color: '#000', // Black text for numbered badges
  },
  takeContent: {
    flex: 1,
  },
  takeText: {
    fontSize: dimensions.fontSize.medium,
    lineHeight: 20,
    marginBottom: dimensions.spacing.sm,
  },
  takeMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  statsText: {
    fontSize: dimensions.fontSize.small,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: dimensions.spacing.xxl,
    paddingHorizontal: dimensions.spacing.lg,
  },
  emptyTitle: {
    fontSize: dimensions.fontSize.xlarge,
    fontWeight: 'bold',
    marginBottom: dimensions.spacing.md,
  },
  emptyDescription: {
    fontSize: dimensions.fontSize.medium,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Database stats styles (hidden dev feature)
  dbStatsContainer: {
    marginHorizontal: dimensions.spacing.lg,
    marginBottom: dimensions.spacing.lg,
    padding: dimensions.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  dbStatsTitle: {
    fontSize: dimensions.fontSize.large,
    fontWeight: 'bold',
    marginBottom: dimensions.spacing.xs,
  },
  dbStatsText: {
    fontSize: dimensions.fontSize.small,
    marginBottom: dimensions.spacing.xs,
  },
  dbCategoryText: {
    fontSize: dimensions.fontSize.small,
    marginLeft: dimensions.spacing.sm,
    marginBottom: 2,
  },
  hideStatsButton: {
    alignSelf: 'flex-end',
    marginTop: dimensions.spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  hideStatsText: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '600',
  },
});
