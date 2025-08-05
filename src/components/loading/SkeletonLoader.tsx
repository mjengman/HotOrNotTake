import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { colors } from '../../constants';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  isDarkMode?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  isDarkMode = false,
}) => {
  const shimmerAnimation = useSharedValue(0);
  const theme = isDarkMode ? colors.dark : colors.light;

  useEffect(() => {
    shimmerAnimation.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      shimmerAnimation.value,
      [0, 0.5, 1],
      [0.3, 0.6, 0.3]
    );

    return {
      opacity,
    };
  });

  const baseColor = isDarkMode ? '#2C2C2E' : '#E1E9EE';
  const highlightColor = isDarkMode ? '#3A3A3C' : '#F2F8FC';

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: highlightColor,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
};

export const SkeletonContainer: React.FC<{
  children: React.ReactNode;
  isDarkMode?: boolean;
}> = ({ children, isDarkMode = false }) => {
  return <View>{children}</View>;
};