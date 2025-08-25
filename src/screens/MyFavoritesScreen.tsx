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
import { getUserFavorites, FavoriteItem } from '../services/favoritesService';
import { getUserVoteForTake } from '../services/voteService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Take } from '../types/Take';
import { colors, dimensions } from '../constants';

interface MyFavoritesScreenProps {
  onClose: () => void;
  onShowTakeStats: (take: Take, vote: 'hot' | 'not' | null) => void;
  isDarkMode?: boolean;
}

export const MyFavoritesScreen: React.FC<MyFavoritesScreenProps> = ({
  onClose,
  onShowTakeStats,
  isDarkMode = false,
}) => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<(FavoriteItem & { take?: Take })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const theme = isDarkMode ? colors.dark : colors.light;

  useEffect(() => {
    const loadFavorites = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const favoriteItems = await getUserFavorites(user.uid);
        
        // Fetch the actual take data for each favorite
        const favoritesWithTakes = await Promise.all(
          favoriteItems.map(async (favorite) => {
            try {
              const takeDoc = await getDoc(doc(db, 'takes', favorite.takeId));
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
                return { ...favorite, take };
              }
              return favorite; // Return favorite without take if take not found
            } catch (error) {
              console.error('Error fetching take:', error);
              return favorite; // Return favorite without take on error
            }
          })
        );
        
        setFavorites(favoritesWithTakes);
      } catch (err) {
        console.error('Error loading favorites:', err);
        setError('Failed to load favorites');
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, [user]);

  const handleTakePress = async (favorite: FavoriteItem & { take?: Take }) => {
    if (favorite.take && user) {
      try {
        // Look up the user's vote for this take
        const userVoteRecord = await getUserVoteForTake(favorite.take.id, user.uid);
        const vote = userVoteRecord ? userVoteRecord.vote : null;
        
        onShowTakeStats(favorite.take, vote);
        // Close the favorites modal so user can see the stats clearly
        onClose();
      } catch (error) {
        console.error('Error getting user vote:', error);
        // Fallback to showing stats without vote
        onShowTakeStats(favorite.take, null);
        // Close the modal even on error
        onClose();
      }
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
        <Text style={[styles.title, { color: theme.text }]}>⭐ My Favorites</Text>
        <View style={styles.spacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading your favorites...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No favorites yet
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
            Star takes to save them here for later!
          </Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {favorites.map((favorite, index) => (
            <TouchableOpacity
              key={`${favorite.takeId}-${index}`}
              style={[
                styles.favoriteItem,
                { 
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                }
              ]}
              onPress={() => handleTakePress(favorite)}
              activeOpacity={0.7}
            >
              <View style={styles.favoriteHeader}>
                <Text style={[styles.favoritedTime, { color: theme.textSecondary }]}>
                  Saved {formatTimeAgo(favorite.favoritedAt)}
                </Text>
                <Text style={[styles.starIcon, { color: theme.accent }]}>⭐</Text>
              </View>
              
              <Text 
                style={[styles.takeText, { color: theme.text }]}
                numberOfLines={3}
              >
                {favorite.take?.text || 'Take content unavailable'}
              </Text>
              
              {favorite.take && (
                <View style={styles.takeStats}>
                  <Text style={[styles.category, { color: theme.textSecondary }]}>
                    #{favorite.take.category}
                  </Text>
                  <Text style={[styles.voteStats, { color: theme.primary }]}>
                    🔥 {favorite.take.hotVotes} • ❄️ {favorite.take.notVotes}
                  </Text>
                </View>
              )}
              
              <Text style={[styles.tapHint, { color: theme.textSecondary }]}>
                Tap to view current stats
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
    paddingHorizontal: dimensions.spacing.lg,
  },
  favoriteItem: {
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
  favoriteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: dimensions.spacing.sm,
  },
  favoritedTime: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '500',
  },
  starIcon: {
    fontSize: 16,
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
    marginBottom: dimensions.spacing.xs,
  },
  category: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  voteStats: {
    fontSize: dimensions.fontSize.small,
    fontWeight: 'bold',
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