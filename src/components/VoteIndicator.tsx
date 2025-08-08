import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Vibration,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, dimensions } from '../constants';

interface VoteIndicatorProps {
  vote: 'hot' | 'not' | null;
  isDarkMode?: boolean;
}

export const VoteIndicator: React.FC<VoteIndicatorProps> = ({ 
  vote, 
  isDarkMode = false 
}) => {
  const theme = isDarkMode ? colors.dark : colors.light;
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(0);
  const glowScale = useSharedValue(0);

  React.useEffect(() => {
    if (vote) {
      // Enhanced entrance animation with rotation and glow
      scale.value = withSequence(
        withSpring(0.3, { damping: 10 }),
        withSpring(1.4, { damping: 6 }),
        withSpring(1.0, { damping: 12 })
      );
      
      opacity.value = withTiming(1, { 
        duration: 150, 
        easing: Easing.out(Easing.quad) 
      });
      
      rotation.value = withSequence(
        withTiming(vote === 'hot' ? -5 : 5, { duration: 100 }),
        withSpring(0, { damping: 8 })
      );
      
      // Glow effect
      glowScale.value = withSequence(
        withSpring(1.3, { damping: 8 }),
        withSpring(1.0, { damping: 10 })
      );
      
      // Enhanced haptic feedback based on vote type
      const vibrationPattern = vote === 'hot' ? [0, 20, 40, 20] : [0, 15, 30, 15];
      Vibration.vibrate(vibrationPattern);
      
      // No auto-hide - controlled by parent component
    } else {
      scale.value = withSpring(0, { damping: 15 });
      opacity.value = withSpring(0, { damping: 15 });
      rotation.value = withSpring(0, { damping: 15 });
      glowScale.value = withSpring(0, { damping: 15 });
    }
  }, [vote]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotateZ: `${rotation.value}deg` }
    ],
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: opacity.value * 0.3,
  }));

  if (!vote) return null;

  const isHot = vote === 'hot';
  const backgroundColor = isHot ? theme.hot : theme.not;
  const icon = isHot ? '🔥' : '🗑️';
  const label = isHot ? 'HOT' : 'NOT';

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {/* Glow background effect */}
      <Animated.View style={[styles.glow, { backgroundColor }, glowStyle]} />
      
      <View style={[styles.indicator, { backgroundColor }]}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={[styles.label, { color: '#FFFFFF' }]}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  glow: {
    position: 'absolute',
    width: 180,
    height: 130,
    borderRadius: 25,
    opacity: 0.3,
  },
  indicator: {
    width: 150,
    height: 100,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  icon: {
    fontSize: 45,
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  label: {
    fontSize: dimensions.fontSize.xlarge,
    fontWeight: 'bold',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});