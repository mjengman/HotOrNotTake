import React from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { colors, dimensions } from '../../constants';

interface LoadingSkeletonProps {
  isDarkMode?: boolean;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;
const CARD_HEIGHT = 520;

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  isDarkMode = false,
}) => {
  const theme = isDarkMode ? colors.dark : colors.light;
  const shimmerValue = useSharedValue(0);

  React.useEffect(() => {
    shimmerValue.value = withRepeat(
      withTiming(1, {
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => {
    return {
      opacity: 0.3 + shimmerValue.value * 0.4,
    };
  });

  const baseSkeletonColor = isDarkMode ? '#3A3A3A' : '#E0E0E0';
  const shimmerColor = isDarkMode ? '#4A4A4A' : '#F0F0F0';

  return (
    <View style={styles.container}>
      {/* Card skeleton */}
      <View style={[
        styles.cardSkeleton, 
        { backgroundColor: theme.surface, width: CARD_WIDTH, height: CARD_HEIGHT }
      ]}>
        {/* Category badge skeleton */}
        <Animated.View style={[
          styles.categoryBadge,
          { backgroundColor: baseSkeletonColor },
          shimmerStyle,
        ]} />
        
        {/* Main content area */}
        <View style={styles.contentArea}>
          {/* Title lines */}
          <Animated.View style={[
            styles.titleLine1,
            { backgroundColor: baseSkeletonColor },
            shimmerStyle,
          ]} />
          <Animated.View style={[
            styles.titleLine2,
            { backgroundColor: baseSkeletonColor },
            shimmerStyle,
          ]} />
          <Animated.View style={[
            styles.titleLine3,
            { backgroundColor: baseSkeletonColor },
            shimmerStyle,
          ]} />
        </View>
        
        {/* Stats area skeleton */}
        <View style={styles.statsArea}>
          <Animated.View style={[
            styles.statItem,
            { backgroundColor: baseSkeletonColor },
            shimmerStyle,
          ]} />
          <Animated.View style={[
            styles.statItem,
            { backgroundColor: baseSkeletonColor },
            shimmerStyle,
          ]} />
          <Animated.View style={[
            styles.statItem,
            { backgroundColor: baseSkeletonColor },
            shimmerStyle,
          ]} />
        </View>
      </View>
      
      {/* Next card skeleton (slightly smaller and behind) */}
      <View style={[
        styles.cardSkeleton,
        styles.nextCardSkeleton,
        { backgroundColor: theme.surface, width: CARD_WIDTH * 0.95, height: CARD_HEIGHT * 0.95 }
      ]}>
        <Animated.View style={[
          styles.categoryBadge,
          { backgroundColor: baseSkeletonColor, opacity: 0.6 },
        ]} />
        <View style={styles.contentArea}>
          <Animated.View style={[
            styles.titleLine1,
            { backgroundColor: baseSkeletonColor, opacity: 0.6 },
          ]} />
          <Animated.View style={[
            styles.titleLine2,
            { backgroundColor: baseSkeletonColor, opacity: 0.6 },
          ]} />
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
    borderRadius: 20,
    padding: dimensions.spacing.lg,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  nextCardSkeleton: {
    transform: [{ scale: 0.95 }],
    opacity: 0.5,
    zIndex: -1,
  },
  categoryBadge: {
    width: 80,
    height: 24,
    borderRadius: 12,
    marginBottom: dimensions.spacing.md,
  },
  contentArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: dimensions.spacing.xl,
  },
  titleLine1: {
    width: '90%',
    height: 20,
    borderRadius: 10,
    marginBottom: dimensions.spacing.sm,
  },
  titleLine2: {
    width: '80%',
    height: 20,
    borderRadius: 10,
    marginBottom: dimensions.spacing.sm,
  },
  titleLine3: {
    width: '70%',
    height: 20,
    borderRadius: 10,
    marginBottom: dimensions.spacing.lg,
  },
  statsArea: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: dimensions.spacing.md,
  },
  statItem: {
    width: 60,
    height: 16,
    borderRadius: 8,
  },
});