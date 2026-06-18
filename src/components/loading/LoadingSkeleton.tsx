import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { colors, motion } from '../../constants';
import { useResponsive } from '../../hooks/useResponsive';
import { SkeletonLoader } from './SkeletonLoader';

interface LoadingSkeletonProps {
  isDarkMode?: boolean;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  isDarkMode = false,
}) => {
  const responsive = useResponsive();
  const theme = isDarkMode ? colors.dark : colors.light;
  const cardWidth = responsive.card.width;
  const cardHeight = responsive.card.height;
  const cardPadding = Math.max(responsive.spacing.lg, 18);
  const categoryWidth = Math.min(cardWidth * 0.46, 190);
  const contentLineHeight = Math.max(16, responsive.fontSize.medium);
  const statBlockWidth = Math.min(cardWidth * 0.22, 86);

  return (
    <View
      style={styles.container}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.cardSkeleton,
          styles.backCardSkeleton,
          {
            backgroundColor: theme.card,
            width: cardWidth,
            height: cardHeight,
            borderRadius: responsive.card.borderRadius,
          },
        ]}
      />

      <View
        style={[
          styles.cardSkeleton,
          {
            backgroundColor: theme.card,
            width: cardWidth,
            height: cardHeight,
            borderRadius: responsive.card.borderRadius,
            padding: cardPadding,
          },
        ]}
      >
        <View style={styles.header}>
          <SkeletonLoader
            width={categoryWidth}
            height={32}
            borderRadius={16}
            isDarkMode={isDarkMode}
          />
        </View>

        <View style={styles.contentArea}>
          <SkeletonLoader
            width="92%"
            height={contentLineHeight}
            borderRadius={contentLineHeight / 2}
            isDarkMode={isDarkMode}
            style={styles.textLine}
          />
          <SkeletonLoader
            width="82%"
            height={contentLineHeight}
            borderRadius={contentLineHeight / 2}
            isDarkMode={isDarkMode}
            style={styles.textLine}
          />
          <SkeletonLoader
            width="68%"
            height={contentLineHeight}
            borderRadius={contentLineHeight / 2}
            isDarkMode={isDarkMode}
          />
        </View>

        <View style={styles.voteArea}>
          <View style={styles.voteColumn}>
            <SkeletonLoader
              width={34}
              height={20}
              borderRadius={10}
              isDarkMode={isDarkMode}
              style={styles.voteQuestion}
            />
            <SkeletonLoader
              width={statBlockWidth}
              height={18}
              borderRadius={9}
              isDarkMode={isDarkMode}
            />
          </View>

          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

          <View style={styles.voteColumn}>
            <SkeletonLoader
              width={34}
              height={20}
              borderRadius={10}
              isDarkMode={isDarkMode}
              style={styles.voteQuestion}
            />
            <SkeletonLoader
              width={statBlockWidth}
              height={18}
              borderRadius={9}
              isDarkMode={isDarkMode}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSkeleton: {
    position: 'absolute',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  backCardSkeleton: {
    transform: [
      { scale: 0.96 },
      { translateY: 14 },
    ],
    opacity: 0.22,
    zIndex: -1,
  },
  header: {
    alignItems: 'center',
  },
  contentArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  textLine: {
    marginBottom: 10,
  },
  voteArea: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: motion.touchTarget.minimum,
  },
  voteColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteQuestion: {
    marginBottom: 8,
  },
  statDivider: {
    width: 1,
    height: 44,
    opacity: 0.45,
  },
});
