import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonLoader } from './SkeletonLoader';
import { dimensions } from '../../constants';

interface LeaderboardSkeletonProps {
  isDarkMode?: boolean;
}

export const LeaderboardSkeleton: React.FC<LeaderboardSkeletonProps> = ({ 
  isDarkMode = false 
}) => {
  return (
    <View style={styles.container}>
      {[1, 2, 3].map((category) => (
        <View key={category} style={styles.categorySection}>
          <SkeletonLoader 
            width={120} 
            height={24} 
            borderRadius={4}
            isDarkMode={isDarkMode}
            style={styles.categoryTitle}
          />
          {[1, 2, 3].map((item) => (
            <View key={item} style={styles.takeItem}>
              <SkeletonLoader 
                width={30} 
                height={30} 
                borderRadius={15}
                isDarkMode={isDarkMode}
                style={styles.rank}
              />
              <View style={styles.takeContent}>
                <SkeletonLoader 
                  width="90%" 
                  height={16} 
                  borderRadius={4}
                  isDarkMode={isDarkMode}
                  style={styles.takeText}
                />
                <SkeletonLoader 
                  width={100} 
                  height={14} 
                  borderRadius={4}
                  isDarkMode={isDarkMode}
                />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: dimensions.spacing.md,
  },
  categorySection: {
    marginBottom: dimensions.spacing.xl,
  },
  categoryTitle: {
    marginBottom: dimensions.spacing.md,
  },
  takeItem: {
    flexDirection: 'row',
    marginBottom: dimensions.spacing.md,
    alignItems: 'flex-start',
  },
  rank: {
    marginRight: dimensions.spacing.sm,
  },
  takeContent: {
    flex: 1,
  },
  takeText: {
    marginBottom: dimensions.spacing.xs,
  },
});