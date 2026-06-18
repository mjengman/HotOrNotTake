import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useAuth } from '../hooks';
import { useResponsive } from '../hooks/useResponsive';
import { colors, dimensions, motion } from '../constants';
import { AnimatedPressable } from '../components/transitions/AnimatedPressable';
import { Take } from '../types';
import { getUserSubmittedTakes, deleteTake } from '../services/takeService';

interface MyTakesScreenProps {
  onClose: () => void;
  onOpenSubmit: () => void;
  onShowTakeStats?: (take: Take, vote: 'hot' | 'not' | null) => void;
  isDarkMode?: boolean;
  refreshTrigger?: number; // Timestamp to trigger refresh
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const MyTakesScreen: React.FC<MyTakesScreenProps> = ({
  onClose,
  onOpenSubmit,
  onShowTakeStats,
  isDarkMode = false,
  refreshTrigger,
}) => {
  const { user } = useAuth();
  const responsive = useResponsive();
  const [takes, setTakes] = useState<Take[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const summaryActionFillAnim = useRef(new Animated.Value(0)).current;
  
  const theme = isDarkMode ? colors.dark : colors.light;
  
  // Create responsive styles
  const styles = useMemo(() => createStyles(responsive), [responsive]);
  const summaryActionSurface = isDarkMode ? theme.surface : '#F0F0F1';
  const summaryActionFill = summaryActionFillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [summaryActionSurface, `${theme.primary}5C`],
  });

  const handleOpenSubmit = () => {
    summaryActionFillAnim.stopAnimation();
    summaryActionFillAnim.setValue(1);
    Animated.timing(summaryActionFillAnim, {
      toValue: 0,
      duration: 170,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
    onOpenSubmit();
  };

  const loadUserTakes = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userTakes = await getUserSubmittedTakes(user.uid);
      setTakes(userTakes);
    } catch (error) {
      console.error('Error loading user takes:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserTakes();
    setRefreshing(false);
  };

  useEffect(() => {
    loadUserTakes();
  }, [user]);

  // Refresh when refreshTrigger changes (new take submitted)
  useEffect(() => {
    if (refreshTrigger && user) {
      loadUserTakes();
    }
  }, [refreshTrigger, user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#4CAF50';
      case 'rejected':
        return theme.error;
      case 'pending':
      default:
        return theme.accent;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return '✅ Approved';
      case 'rejected':
        return '❌ Rejected';
      case 'pending':
      default:
        return '⏳ Pending Review';
    }
  };

  const formatPercentage = (votes: number, total: number) => {
    if (total === 0) return '0%';
    return `${Math.round((votes / total) * 100)}%`;
  };

  const handleDeleteTake = (take: Take) => {
    Alert.alert(
      'Delete Take?',
      `Are you sure you want to delete this take?\n\n"${take.text}"\n\nThis action cannot be undone and all votes will be lost.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user) return;
              await deleteTake(take.id, user.uid);
              // Remove the take from local state immediately
              setTakes(prevTakes => prevTakes.filter(t => t.id !== take.id));
            } catch (error) {
              console.error('Error deleting take:', error);
              Alert.alert(
                'Delete Failed',
                'There was an error deleting your take. Please try again.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  };

  const handleTakePress = (take: Take) => {
    if (onShowTakeStats && take.isApproved) {
      // For user's own takes, we don't know their vote (they created it, not voted)
      onShowTakeStats(take, null);
      // Close the My Takes modal so user can see the stats clearly
      onClose();
    }
  };

  const renderTakeCard = (take: Take) => (
    <View key={take.id} style={[styles.takeCard, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
      {/* Status Header */}
      <View style={styles.statusHeader}>
        <View style={styles.statusLeft}>
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>
            {take.submittedAt.toLocaleDateString()}
          </Text>
        </View>
        <AnimatedPressable
          style={[styles.deleteButton, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}
          onPress={() => handleDeleteTake(take)}
          scaleValue={0.92}
          hapticIntensity={motion.haptic.selection}
          accessibilityRole="button"
          accessibilityLabel="Delete take"
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </AnimatedPressable>
      </View>

      {/* Tappable Content Area - only for approved takes */}
      <TouchableOpacity
        onPress={() => handleTakePress(take)}
        activeOpacity={take.isApproved ? 0.7 : 1}
        disabled={!take.isApproved}
        style={styles.tappableContent}
      >
        {/* Take Text */}
        <Text style={[styles.takeText, { color: theme.text }]}>
          {take.text}
        </Text>

        {/* Category */}
        <View style={styles.categoryContainer}>
          <Text style={[styles.categoryText, { color: theme.textSecondary }]}>
            #{take.category}
          </Text>
        </View>

        {/* Performance Metrics (only for approved takes) */}
        {take.status === 'approved' && take.totalVotes > 0 && (
          <View style={styles.metricsContainer}>
            <Text style={[styles.metricsTitle, { color: theme.text }]}>
              Performance
            </Text>
            
            <View style={styles.voteStats}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#4A90E2' }]}>
                  {take.notVotes}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  ❄️ Not ({formatPercentage(take.notVotes, take.totalVotes)})
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.primary }]}>
                  {take.hotVotes}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  🔥 Hot ({formatPercentage(take.hotVotes, take.totalVotes)})
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {take.totalVotes}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Total Votes
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Tap hint for approved takes */}
        {take.isApproved && take.totalVotes > 0 && (
          <Text style={[styles.tapHint, { color: theme.textSecondary }]}>
            Tap to view full stats and share
          </Text>
        )}

        {/* Rejection Reason (if rejected) */}
        {take.status === 'rejected' && take.rejectionReason && (
          <View style={styles.rejectionContainer}>
            <Text style={[styles.rejectionTitle, { color: theme.error }]}>
              Rejection Reason:
            </Text>
            <Text style={[styles.rejectionReason, { color: theme.textSecondary }]}>
              {take.rejectionReason}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const stats = {
    total: takes.length,
    totalVotes: takes.reduce((sum, t) => sum + t.totalVotes, 0),
  };

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
          accessibilityLabel="Close my takes"
        >
          <Text style={[styles.closeButtonText, { color: theme.text }]}>✕</Text>
        </AnimatedPressable>
        
        <Text style={[styles.title, { color: theme.text }]}>
          My Takes
        </Text>
        
        <View style={styles.placeholder} />
      </View>

      {/* Stats Summary */}
      <View style={[styles.summaryContainer, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.text }]}>
              {stats.total}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              Submitted
            </Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
              {stats.totalVotes}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              Total Votes
            </Text>
          </View>

          <AnimatedTouchableOpacity
            style={[
              styles.summaryAction,
              {
                backgroundColor: summaryActionFill,
                borderColor: theme.primary,
                shadowColor: theme.primary,
              },
            ]}
            onPress={handleOpenSubmit}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel="Submit another hot take"
          >
            <Text style={styles.summaryActionIcon}>✏️</Text>
            <Text style={[styles.summaryActionText, { color: theme.primary }]}>New take</Text>
          </AnimatedTouchableOpacity>
        </View>
      </View>

      {/* Takes List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.text }]}>
              Loading your takes...
            </Text>
          </View>
        ) : takes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No Takes Yet
            </Text>
            <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>
              You haven't submitted any hot takes yet.{'\n'}
              Tap New take to create your first one.
            </Text>
          </View>
        ) : (
          <View style={styles.takesContainer}>
            {takes.map(renderTakeCard)}
          </View>
        )}
      </ScrollView>

    </SafeAreaView>
  );
};

// Create responsive styles function
const createStyles = (responsive: any) => {
  return StyleSheet.create({
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
  summaryContainer: {
    marginHorizontal: dimensions.spacing.lg,
    borderRadius: 12,
    padding: dimensions.spacing.lg,
    marginBottom: dimensions.spacing.lg,
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimensions.spacing.sm,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryAction: {
    minHeight: motion.touchTarget.minimum,
    minWidth: 104,
    borderRadius: 14,
    borderWidth: 1.75,
    paddingHorizontal: dimensions.spacing.md,
    paddingVertical: dimensions.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    elevation: 3,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.22,
    shadowRadius: 5,
  },
  summaryActionIcon: {
    fontSize: responsive.fontSize.medium,
  },
  summaryActionText: {
    color: '#FFFFFF',
    fontSize: dimensions.fontSize.small,
    fontWeight: '800',
  },
  summaryValue: {
    fontSize: dimensions.fontSize.xlarge,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  takesContainer: {
    paddingHorizontal: dimensions.spacing.lg,
    paddingBottom: dimensions.spacing.xl,
  },
  takeCard: {
    borderRadius: 12,
    padding: dimensions.spacing.lg,
    marginBottom: dimensions.spacing.lg,
  },
  tappableContent: {
    flex: 1,
  },
  tapHint: {
    fontSize: dimensions.fontSize.small,
    fontStyle: 'italic',
    textAlign: 'right',
    marginTop: dimensions.spacing.xs,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: dimensions.spacing.md,
  },
  statusLeft: {
    flex: 1,
  },
  statusText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '500',
  },
  deleteButton: {
    width: motion.touchTarget.minimum,
    height: motion.touchTarget.minimum,
    borderRadius: motion.touchTarget.minimum / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  takeText: {
    fontSize: dimensions.fontSize.medium,
    lineHeight: 22,
    marginBottom: dimensions.spacing.sm,
  },
  categoryContainer: {
    // marginBottom: dimensions.spacing.md,
  },
  categoryText: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  metricsContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
    paddingTop: dimensions.spacing.md,
  },
  metricsTitle: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: 'bold',
    marginBottom: dimensions.spacing.sm,
  },
  voteStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: dimensions.fontSize.large,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '500',
    textAlign: 'center',
  },
  rejectionContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
    paddingTop: dimensions.spacing.md,
  },
  rejectionTitle: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: 'bold',
    marginBottom: dimensions.spacing.sm,
  },
  rejectionReason: {
    fontSize: dimensions.fontSize.small,
    lineHeight: 18,
    fontStyle: 'italic',
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
};
