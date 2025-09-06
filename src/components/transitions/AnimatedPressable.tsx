import React from 'react';
import {
  GestureResponderEvent,
  TouchableOpacity,
  TouchableOpacityProps,
  Vibration,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

interface AnimatedPressableProps extends TouchableOpacityProps {
  children: React.ReactNode;
  scaleValue?: number;
  hapticFeedback?: boolean;
  hapticIntensity?: number;
  springConfig?: {
    damping?: number;
    stiffness?: number;
  };
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  onPress,
  onPressIn,
  onPressOut,
  scaleValue = 0.95,
  hapticFeedback = true,
  hapticIntensity = 10,
  springConfig = { damping: 15, stiffness: 300 },
  style,
  disabled = false,
  ...props
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = (event: GestureResponderEvent) => {
    if (!disabled) {
      scale.value = withSpring(scaleValue, springConfig);
      opacity.value = withTiming(0.8, { duration: 100 });
      
      if (hapticFeedback) {
        runOnJS(Vibration.vibrate)(hapticIntensity);
      }
    }
    
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    if (!disabled) {
      scale.value = withSpring(1, springConfig);
      opacity.value = withTiming(1, { duration: 150 });
    }
    
    onPressOut?.(event);
  };

  const handlePress = (event: GestureResponderEvent) => {
    if (!disabled && onPress) {
      // Add a slight delay to ensure the animation is visible
      setTimeout(() => {
        onPress(event);
      }, 50);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedTouchable
      style={[style, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={1}
      {...props}
    >
      {children}
    </AnimatedTouchable>
  );
};