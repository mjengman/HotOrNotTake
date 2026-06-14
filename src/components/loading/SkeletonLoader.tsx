import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';

interface SkeletonLoaderProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
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

  useEffect(() => {
    shimmerAnimation.value = withRepeat(
      withTiming(1, {
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      shimmerAnimation.value,
      [0, 1],
      [0.35, 0.72]
    );

    return {
      opacity,
    };
  });

  const baseColor = isDarkMode ? '#333333' : '#E7EAEE';
  const highlightColor = isDarkMode ? '#444444' : '#F8FAFC';

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
