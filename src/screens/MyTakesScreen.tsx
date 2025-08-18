import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '../hooks';
import { colors, dimensions } from '../constants';
import { Take } from '../types';
import { getUserSubmittedTakes, deleteTake } from '../services/takeService';

interface MyTakesScreenProps {
  onClose: () => void;
  onOpenSubmit: () => void;
  isDarkMode?: boolean;
  refreshTrigger?: number; // Timestamp to trigger refresh
}

export const MyTakesScreen: React.FC<MyTakesScreenProps> = ({
  onClose,
  onOpenSubmit,
  isDarkMode = false,
  refreshTrigger,
}) => {
  const { user } = useAuth();
  const [takes, setTakes] = useState<Take[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const theme = isDarkMode ? colors.dark : colors.light;

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
      console.log(`📱 My Takes: Refreshing due to new submission (trigger: ${refreshTrigger})`);
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

  const renderTakeCard = (take: Take) => (
    <View key={take.id} style={[styles.takeCard, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
      {/* Status Header */}
      <View style={styles.statusHeader}>
        <View style={styles.statusLeft}>
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>
            {take.submittedAt.toLocaleDateString()}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}
          onPress={() => handleDeleteTake(take)}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>

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
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}
          onPress={onClose}
        >
          <Text style={[styles.closeButtonText, { color: theme.text }]}>✕</Text>
        </TouchableOpacity>
        
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
        </View>
      </View>

      {/* Takes List */}
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
              Tap the ✏️ button to create your first one!
            </Text>
          </View>
        ) : (
          <View style={styles.takesContainer}>
            {takes.map(renderTakeCard)}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fabButton, { backgroundColor: theme.primary }]}
        onPress={onOpenSubmit}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>✏️</Text>
      </TouchableOpacity>
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
  summaryContainer: {
    marginHorizontal: dimensions.spacing.lg,
    borderRadius: 12,
    padding: dimensions.spacing.lg,
    marginBottom: dimensions.spacing.lg,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
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
  takesContainer: {
    paddingHorizontal: dimensions.spacing.lg,
    paddingBottom: dimensions.spacing.xl,
  },
  takeCard: {
    borderRadius: 12,
    padding: dimensions.spacing.lg,
    marginBottom: dimensions.spacing.lg,
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
    width: 32,
    height: 32,
    borderRadius: 16,
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
    marginBottom: dimensions.spacing.md,
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
  fabButton: {
    position: 'absolute',
    bottom: 130,
    right: dimensions.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  fabText: {
    fontSize: 24,
  },
});