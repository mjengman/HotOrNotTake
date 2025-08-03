import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { colors, dimensions } from '../constants';
import { Take } from '../types';
import {
  getHottestTakesByCategory,
  getNottestTakesByCategory,
  getMostSkippedTakesByCategory,
} from '../services/takeService';

interface LeaderboardScreenProps {
  onClose: () => void;
  isDarkMode?: boolean;
}

type LeaderboardTab = 'hottest' | 'nottest' | 'skipped';

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  onClose,
  isDarkMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('hottest');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [hottestTakes, setHottestTakes] = useState<Record<string, Take[]>>({});
  const [nottestTakes, setNottestTakes] = useState<Record<string, Take[]>>({});
  const [skippedTakes, setSkippedTakes] = useState<Record<string, { take: Take; skipCount: number }[]>>({});
  
  const theme = isDarkMode ? colors.dark : colors.light;

  const loadLeaderboards = async () => {
    try {
      setLoading(true);
      const [hottest, nottest, skipped] = await Promise.all([
        getHottestTakesByCategory(),
        getNottestTakesByCategory(),
        getMostSkippedTakesByCategory(),
      ]);
      
      setHottestTakes(hottest);
      setNottestTakes(nottest);
      setSkippedTakes(skipped);
    } catch (error) {
      console.error('Error loading leaderboards:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboards();
    setRefreshing(false);
  };

  useEffect(() => {
    loadLeaderboards();
  }, []);

  const renderTakeItem = (take: Take, rank: number, subtitle: string) => (
    <View key={take.id} style={[styles.takeItem, { backgroundColor: theme.surface }]}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{rank}</Text>
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
      </View>
    </View>
  );

  const renderSkippedTakeItem = (item: { take: Take; skipCount: number }, rank: number) => (
    renderTakeItem(item.take, rank, `${item.skipCount} skips`)
  );

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
          } else {
            const take = item as Take;
            const subtitle = activeTab === 'hottest' 
              ? `${take.hotVotes} 🔥 votes`
              : `${take.notVotes} 🗑️ votes`;
            return renderTakeItem(take, index + 1, subtitle);
          }
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
      case 'skipped':
        return skippedTakes;
      default:
        return {};
    }
  };

  const tabs: { key: LeaderboardTab; label: string; icon: string }[] = [
    { key: 'hottest', label: 'Hottest', icon: '🔥' },
    { key: 'nottest', label: 'Nottest', icon: '🗑️' },
    { key: 'skipped', label: 'Most Skipped', icon: '⏭️' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: theme.surface }]}
          onPress={onClose}
        >
          <Text style={[styles.closeButtonText, { color: theme.text }]}>✕</Text>
        </TouchableOpacity>
        
        <Text style={[styles.title, { color: theme.text }]}>
          📊 Leaderboards
        </Text>
        
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === tab.key ? theme.primary : theme.surface,
              },
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === tab.key ? '#FFFFFF' : theme.text,
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.text }]}>
              Loading leaderboards...
            </Text>
          </View>
        ) : (
          <View style={styles.contentContainer}>
            {Object.keys(getCurrentData()).length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  No data yet
                </Text>
                <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>
                  {activeTab === 'hottest' && 'No takes have received hot votes yet.'}
                  {activeTab === 'nottest' && 'No takes have received not votes yet.'}
                  {activeTab === 'skipped' && 'No takes have been skipped yet.'}
                </Text>
              </View>
            ) : (
              Object.entries(getCurrentData()).map(([category, takes]) =>
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
    width: 36,
    height: 36,
    borderRadius: 18,
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
    width: 36,
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
    borderRadius: 12,
    gap: dimensions.spacing.xs,
  },
  tabIcon: {
    fontSize: 16,
  },
  tabText: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '600',
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
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: dimensions.spacing.md,
  },
  rankText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: 'bold',
    color: '#000',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: dimensions.spacing.xxl,
  },
  loadingText: {
    fontSize: dimensions.fontSize.large,
    fontWeight: '500',
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
});