import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonLoader } from './SkeletonLoader';
import { colors, dimensions, motion } from '../../constants';

interface LeaderboardSkeletonProps {
  isDarkMode?: boolean;
}

export const LeaderboardSkeleton: React.FC<LeaderboardSkeletonProps> = ({ 
  isDarkMode = false 
}) => {
  const theme = isDarkMode ? colors.dark : colors.light;

  return (
    <View
      style={styles.container}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {[1, 2, 3].map((category) => (
        <View key={category} style={styles.categorySection}>
          <SkeletonLoader 
            width={128}
            height={24}
            borderRadius={12}
            isDarkMode={isDarkMode}
            style={styles.categoryTitle}
          />
          {[1, 2, 3].map((item) => (
            <View
              key={item}
              style={[
                styles.takeItem,
                { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' },
              ]}
            >
              <SkeletonLoader 
                width={34}
                height={34}
                borderRadius={17}
                isDarkMode={isDarkMode}
                style={styles.rank}
              />
              <View style={styles.takeContent}>
                <SkeletonLoader 
                  width="90%" 
                  height={16}
                  borderRadius={8}
                  isDarkMode={isDarkMode}
                  style={styles.takeText}
                />
                <SkeletonLoader
                  width="76%"
                  height={16}
                  borderRadius={8}
                  isDarkMode={isDarkMode}
                  style={styles.takeText}
                />
                <SkeletonLoader 
                  width={112}
                  height={14}
                  borderRadius={7}
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
    paddingHorizontal: dimensions.spacing.lg,
    paddingBottom: dimensions.spacing.xl,
  },
  categorySection: {
    marginBottom: dimensions.spacing.xl,
  },
  categoryTitle: {
    marginBottom: dimensions.spacing.md,
    alignSelf: 'center',
  },
  takeItem: {
    flexDirection: 'row',
    marginBottom: dimensions.spacing.md,
    alignItems: 'flex-start',
    padding: dimensions.spacing.md,
    borderRadius: 12,
    minHeight: motion.touchTarget.comfortable + dimensions.spacing.md,
  },
  rank: {
    marginRight: dimensions.spacing.md,
  },
  takeContent: {
    flex: 1,
  },
  takeText: {
    marginBottom: dimensions.spacing.xs,
  },
});
