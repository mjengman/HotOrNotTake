import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
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

  React.useEffect(() => {
    if (vote) {
      scale.value = withSequence(
        withSpring(1.2, { damping: 8 }),
        withSpring(1, { damping: 10 })
      );
      opacity.value = withDelay(
        100,
        withSpring(1, { damping: 15 })
      );
    } else {
      scale.value = withSpring(0, { damping: 15 });
      opacity.value = withSpring(0, { damping: 15 });
    }
  }, [vote]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!vote) return null;

  const isHot = vote === 'hot';
  const backgroundColor = isHot ? theme.hot : theme.not;
  const icon = isHot ? '🔥' : '🗑️';
  const label = isHot ? 'HOT' : 'NOT';

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
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
    top: '50%',
    left: '50%',
    transform: [{ translateX: -60 }, { translateY: -40 }],
    zIndex: 1000,
  },
  indicator: {
    width: 120,
    height: 80,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  icon: {
    fontSize: dimensions.fontSize.xlarge,
    marginBottom: 4,
  },
  label: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});