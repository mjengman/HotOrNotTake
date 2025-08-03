import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Alert,
  Text,
  TouchableOpacity,
} from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  runOnJS,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Take } from '../types';
import { TakeCard } from './TakeCard';
import { VoteIndicator } from './VoteIndicator';
import { dimensions, colors } from '../constants';

interface CustomSwipeableCardDeckProps {
  takes: Take[];
  onVote: (takeId: string, vote: 'hot' | 'not') => void;
  onSkip: (takeId: string) => void;
  onEndReached?: () => void;
  isDarkMode?: boolean;
}

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;

export const CustomSwipeableCardDeck: React.FC<CustomSwipeableCardDeckProps> = ({
  takes,
  onVote,
  onSkip,
  onEndReached,
  isDarkMode = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentVote, setCurrentVote] = useState<'hot' | 'not' | null>(null);
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const theme = isDarkMode ? colors.dark : colors.light;

  // Safety check
  if (!takes || !Array.isArray(takes) || takes.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No takes available</Text>
        </View>
      </View>
    );
  }

  const handleVote = (vote: 'hot' | 'not') => {
    if (currentIndex < takes.length) {
      const currentTake = takes[currentIndex];
      onVote(currentTake.id, vote);
      
      // Show vote indicator briefly
      setCurrentVote(vote);
      setTimeout(() => setCurrentVote(null), 300);
      
      // Move to next card immediately
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      
      // Check if we've reached the end
      if (nextIndex >= takes.length) {
        setTimeout(() => {
          onEndReached?.();
        }, 500);
      }
    }
  };

  const handleSkip = () => {
    if (currentIndex < takes.length) {
      const currentTake = takes[currentIndex];
      onSkip(currentTake.id);
      
      // Move to next card immediately
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      
      // Check if we've reached the end
      if (nextIndex >= takes.length) {
        setTimeout(() => {
          onEndReached?.();
        }, 500);
      }
    }
  };

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      scale.value = withSpring(0.95);
    },
    onActive: (event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.1; // Subtle vertical movement
    },
    onEnd: (event) => {
      const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;
      const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;

      if (shouldSwipeRight) {
        translateX.value = withSpring(width * 1.5, { damping: 15, stiffness: 120 }, () => {
          runOnJS(handleVote)('hot');
          // Reset position immediately for the next card
          translateX.value = 0;
          translateY.value = 0;
        });
      } else if (shouldSwipeLeft) {
        translateX.value = withSpring(-width * 1.5, { damping: 15, stiffness: 120 }, () => {
          runOnJS(handleVote)('not');
          // Reset position immediately for the next card
          translateX.value = 0;
          translateY.value = 0;
        });
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
      
      scale.value = withSpring(1);
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-width, 0, width],
      [-15, 0, 15],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [1, 0.7],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
        { scale: scale.value },
      ],
      opacity,
    };
  });

  const hotOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP
    );
    return { opacity };
  });

  const notOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolate.CLAMP
    );
    return { opacity };
  });

  if (currentIndex >= takes.length) {
    return (
      <View style={styles.container}>
        <View style={styles.endContainer}>
          <Text style={styles.endEmoji}>🎉</Text>
          <Text style={[styles.endTitle, { color: theme.text }]}>Wow! You've reached the end!</Text>
          <Text style={[styles.endMessage, { color: theme.textSecondary }]}>
            You've voted on all available hot takes.{'\n'}
            How about adding some of your own?
          </Text>
          <Text style={[styles.endHint, { color: theme.textSecondary, opacity: 0.7 }]}>
            Tap the clipboard icon (📋) to see your takes{'\n'}
            and submit new ones!
          </Text>
        </View>
      </View>
    );
  }

  const currentTake = takes[currentIndex];
  const nextTake = takes[currentIndex + 1];

  return (
    <View style={styles.container}>
      <VoteIndicator vote={currentVote} isDarkMode={isDarkMode} />
      
      {/* Next card (background) */}
      {nextTake && (
        <View style={[styles.cardContainer, styles.nextCard]}>
          <TakeCard take={nextTake} isDarkMode={isDarkMode} />
        </View>
      )}
      
      {/* Current card (foreground) */}
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[styles.cardContainer, animatedStyle]}>
          <TakeCard take={currentTake} isDarkMode={isDarkMode} />
          
          {/* Overlay indicators */}
          <Animated.View style={[styles.overlayLeft, notOverlayStyle]}>
            <Text style={styles.overlayText}>NOT</Text>
          </Animated.View>
          
          <Animated.View style={[styles.overlayRight, hotOverlayStyle]}>
            <Text style={styles.overlayText}>HOT</Text>
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
      
      {/* Skip Button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipButtonText}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextCard: {
    transform: [{ scale: 0.95 }],
    opacity: 0.5,
  },
  noDataContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
  },
  endContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: dimensions.spacing.xl,
  },
  endEmoji: {
    fontSize: 64,
    marginBottom: dimensions.spacing.lg,
  },
  endTitle: {
    fontSize: dimensions.fontSize.xxlarge,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: dimensions.spacing.md,
  },
  endMessage: {
    fontSize: dimensions.fontSize.large,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: dimensions.spacing.lg,
  },
  endHint: {
    fontSize: dimensions.fontSize.medium,
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  overlayLeft: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#FF3838',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    transform: [{ rotate: '15deg' }],
  },
  overlayRight: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: '#FF4757',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    transform: [{ rotate: '-15deg' }],
  },
  overlayText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipButton: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  skipButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});