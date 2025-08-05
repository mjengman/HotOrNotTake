import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { SkeletonLoader } from './SkeletonLoader';
import { colors, dimensions as appDimensions } from '../../constants';

interface LoadingCardProps {
  isDarkMode?: boolean;
  index?: number;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;
const CARD_HEIGHT = 400;

export const LoadingCard: React.FC<LoadingCardProps> = ({ 
  isDarkMode = false,
  index = 0,
}) => {
  const theme = isDarkMode ? colors.dark : colors.light;
  const scaleValue = useSharedValue(1);

  React.useEffect(() => {
    scaleValue.value = withRepeat(
      withTiming(1.02, { duration: 1500 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scaleValue.value,
      [1, 1.02],
      [1, 1.02]
    );
    
    return {
      transform: [
        { scale },
      ],
      opacity: interpolate(
        index,
        [0, 1, 2],
        [1, 0.8, 0.6]
      ),
    };
  });

  return (
    <Animated.View 
      style={[
        styles.container,
        { backgroundColor: theme.surface },
        animatedStyle,
        index > 0 && {
          position: 'absolute',
          top: index * 8,
          zIndex: -index,
        }
      ]}
    >
      <View style={styles.content}>
        <SkeletonLoader 
          width={100} 
          height={28} 
          borderRadius={appDimensions.borderRadius.sm}
          isDarkMode={isDarkMode}
          style={styles.category}
        />
        <SkeletonLoader 
          width="100%" 
          height={20} 
          borderRadius={4}
          isDarkMode={isDarkMode}
          style={styles.textLine}
        />
        <SkeletonLoader 
          width="100%" 
          height={20} 
          borderRadius={4}
          isDarkMode={isDarkMode}
          style={styles.textLine}
        />
        <SkeletonLoader 
          width="70%" 
          height={20} 
          borderRadius={4}
          isDarkMode={isDarkMode}
          style={styles.textLineShort}
        />
        <View style={styles.statsContainer}>
          <SkeletonLoader 
            width={80} 
            height={40} 
            borderRadius={appDimensions.borderRadius.sm}
            isDarkMode={isDarkMode}
          />
          <SkeletonLoader 
            width={80} 
            height={40} 
            borderRadius={appDimensions.borderRadius.sm}
            isDarkMode={isDarkMode}
          />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: appDimensions.borderRadius.lg,
    padding: appDimensions.spacing.lg,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  content: {
    flex: 1,
  },
  category: {
    marginBottom: appDimensions.spacing.md,
  },
  textLine: {
    marginBottom: appDimensions.spacing.sm,
  },
  textLineShort: {
    marginBottom: appDimensions.spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: appDimensions.spacing.xl,
  },
});