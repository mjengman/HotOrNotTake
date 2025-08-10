import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Alert,
  Text,
  Vibration,
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
import { AnimatedPressable } from './transitions/AnimatedPressable';
import { dimensions, colors } from '../constants';

interface CustomSwipeableCardDeckProps {
  takes: Take[];
  onVote: (takeId: string, vote: 'hot' | 'not') => void;
  onSkip: (takeId: string) => void;
  onSubmitTake?: () => void;
  isDarkMode?: boolean;
}

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;

export const CustomSwipeableCardDeck: React.FC<CustomSwipeableCardDeckProps> = ({
  takes,
  onVote,
  onSkip,
  onSubmitTake,
  isDarkMode = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1); // Track next card explicitly
  const [currentVote, setCurrentVote] = useState<'hot' | 'not' | null>(null);
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const theme = isDarkMode ? colors.dark : colors.light;

  // Ensure takes is always an array
  const safeTakes = takes || [];

  // Update nextIndex when currentIndex changes
  useEffect(() => {
    setNextIndex(currentIndex + 1);
  }, [currentIndex]);

  const handleVote = (vote: 'hot' | 'not') => {
    if (currentIndex < safeTakes.length) {
      const currentTake = safeTakes[currentIndex];
      onVote(currentTake.id, vote);
      setCurrentVote(vote);
      // Clear vote indicator after animation
      setTimeout(() => setCurrentVote(null), 800); // Matches animation duration
    }
  };

  const moveToNextCard = () => {
    setCurrentIndex((prev) => prev + 1);
  };

  const handleSkip = () => {
    if (currentIndex < safeTakes.length) {
      // Immediate haptic feedback for skip action
      Vibration.vibrate(12);
      
      const currentTake = safeTakes[currentIndex];
      
      // Call onSkip asynchronously so it doesn't block the UI
      setTimeout(() => {
        onSkip(currentTake.id);
      }, 0);
      
      // Move to next card immediately
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      
      // Check if we've reached the end - no more content loading for MVP
    }
  };

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      scale.value = withSpring(0.95);
      // Light haptic feedback on touch start
      runOnJS(Vibration.vibrate)(10);
    },
    onActive: (event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.1; // Subtle vertical movement
      
      // Provide haptic feedback when reaching swipe threshold
      const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;
      const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;
      
      if ((shouldSwipeRight || shouldSwipeLeft) && Math.abs(event.translationX) > SWIPE_THRESHOLD && Math.abs(event.translationX) < SWIPE_THRESHOLD + 20) {
        runOnJS(Vibration.vibrate)(15);
      }
    },
    onEnd: (event) => {
      const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;
      const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;

      if (shouldSwipeRight) {
        runOnJS(Vibration.vibrate)(25);
        runOnJS(handleVote)('hot');
        translateX.value = withSpring(
          width * 1.5,
          { damping: 15, stiffness: 120, mass: 0.8 }, // Smoother animation
          () => {
            translateX.value = 0;
            translateY.value = 0;
            scale.value = withSpring(1);
            runOnJS(moveToNextCard)();
          }
        );
      } else if (shouldSwipeLeft) {
        runOnJS(Vibration.vibrate)(25);
        runOnJS(handleVote)('not');
        translateX.value = withSpring(
          -width * 1.5,
          { damping: 15, stiffness: 120, mass: 0.8 },
          () => {
            translateX.value = 0;
            translateY.value = 0;
            scale.value = withSpring(1);
            runOnJS(moveToNextCard)();
          }
        );
      } else {
        // Soft haptic feedback for bounce back
        runOnJS(Vibration.vibrate)(8);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
      }
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
      zIndex: 2, // Ensure current card is above next card
    };
  });

  const nextCardStyle = useAnimatedStyle(() => {
    // Scale up next card as current card swipes away
    const nextScale = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0.95, 1],
      Extrapolate.CLAMP
    );
    const nextOpacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0.5, 1],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ 
        scale: withSpring(nextScale, {
          damping: 99,
          stiffness: 0.1,
          mass: 0.1
        })
      }],
      opacity: withSpring(nextOpacity, {
        damping: 90,
        stiffness: 0.1,
        mass: 0.1
      }),
      zIndex: 1, // Keep below current card
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

  if (currentIndex >= safeTakes.length) {
    return (
      <View style={styles.container}>
        <View style={styles.endContainer}>
          <Text style={styles.endEmoji}>🎉</Text>
          <Text style={[styles.endTitle, { color: theme.text }]}>
            {safeTakes.length === 0 ? 'No takes available yet!' : 'You\'ve reached the end!'}
          </Text>
          <Text style={[styles.endMessage, { color: theme.textSecondary }]}>
            {safeTakes.length === 0 
              ? 'Be the first to submit a hot take!'
              : 'Submit more takes to keep the conversation going!'
            }
          </Text>
          
          {onSubmitTake && (
            <AnimatedPressable
              style={[styles.submitButton, { backgroundColor: theme.primary }]}
              onPress={onSubmitTake}
              scaleValue={0.95}
              hapticIntensity={15}
            >
              <Text style={styles.submitButtonText}>✏️ Submit Take</Text>
            </AnimatedPressable>
          )}
          
          <Text style={[styles.endHint, { color: theme.textSecondary, opacity: 0.7 }]}>
            Tap the clipboard icon (📋) to see all your takes
          </Text>
        </View>
      </View>
    );
  }

  const currentTake = safeTakes[currentIndex];
  const nextTake = safeTakes[nextIndex];

  return (
    <View style={styles.container}>
      <VoteIndicator vote={currentVote} isDarkMode={isDarkMode} />
      
      {/* Next card (background) */}
      {nextTake && (
        <Animated.View style={[styles.cardContainer, styles.nextCard, nextCardStyle]}>
          <TakeCard take={nextTake} isDarkMode={isDarkMode} />
        </Animated.View>
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
      <AnimatedPressable 
        style={styles.skipButton} 
        onPress={handleSkip}
        scaleValue={0.9}
        hapticIntensity={12}
      >
        <Text style={styles.skipButtonText}>Skip</Text>
      </AnimatedPressable>
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
    bottom: 110
  },
  nextCard: {
    // Static styles moved to nextCardStyle for animation
  },
  endContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: dimensions.spacing.xl,
    paddingVertical: dimensions.spacing.xl,
  },
  // Removed endScrollContainer - no longer needed
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
  // Removed pullHint - no longer needed
  submitButton: {
    paddingHorizontal: dimensions.spacing.xl,
    paddingVertical: dimensions.spacing.md,
    borderRadius: 25,
    marginVertical: dimensions.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: dimensions.fontSize.large,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
    bottom: 65,
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