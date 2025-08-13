import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Alert,
  Text,
  Vibration,
  Platform,
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
  withTiming,
  interpolate,
  Extrapolate,
  Easing,
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
  onShowInstructions?: () => void;
  isDarkMode?: boolean;
  hasMore?: boolean;
  loadMore?: (count?: number) => Promise<void>;
  loading?: boolean;
}

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.2;
const SWIPE_DOWN_THRESHOLD = height * 0.2; // 20% of screen height

// Safe flip for Android - no 3D to avoid compositor crashes
const ANDROID_SAFE_FLIP = Platform.OS === 'android';

// Stable style object to avoid reparenting during 3D flips
const absoluteFill = StyleSheet.absoluteFillObject;

export const CustomSwipeableCardDeck: React.FC<CustomSwipeableCardDeckProps> = ({
  takes,
  onVote,
  onSkip,
  onSubmitTake,
  onShowInstructions,
  isDarkMode = false,
  hasMore = true,
  loadMore,
  loading = false,
}) => {
  const [currentVote, setCurrentVote] = useState<'hot' | 'not' | null>(null);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [lastVote, setLastVote] = useState<'hot' | 'not' | null>(null);
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const isAnimating = useSharedValue(false);
  
  // 0 = front, 1 = back (stats)
  const flipSV = useSharedValue(0);

  const theme = isDarkMode ? colors.dark : colors.light;

  // JS-thread helpers for runOnJS
  const jsSetVote = (val: 'hot' | 'not' | null) => setCurrentVote(val);
  const jsOnSkip = (id: string) => onSkip(id);
  
  // Flip the card to reveal stats
  const flipCard = (vote: 'hot' | 'not') => {
    setLastVote(vote);
    
    // Bounce micro-scale then flip
    scale.value = withSpring(0.96, {}, () => {
      'worklet';
      flipSV.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setIsCardFlipped)(true); // set after flip completes
      });
      scale.value = withSpring(1);
    });
  };
  
  // Continue to next card after reveal - now with fly-away animation
  const continueToNext = () => {
    if (!currentTake || isAnimating.value) return;
    
    isAnimating.value = true;
    const voteToSubmit = lastVote;
    const takeId = currentTake.id;
    
    // Fly away animation (like old voting animation)
    const direction = voteToSubmit === 'hot' ? 1 : -1;
    translateX.value = withSpring(
      width * 1.5 * direction,
      { damping: 15, stiffness: 120, mass: 0.8 },
      () => {
        'worklet';
        // Reset everything for next card
        translateX.value = 0;
        translateY.value = 0;
        scale.value = 1;
        flipSV.value = 0;
        runOnJS(setIsCardFlipped)(false);
        runOnJS(setLastVote)(null);
        runOnJS(setCurrentVote)(null);
        isAnimating.value = false;
        
        // Submit vote to advance deck
        if (voteToSubmit && takeId) {
          runOnJS(onVote)(takeId, voteToSubmit);
        }
      }
    );
  };

  // Ensure takes is always an array
  const safeTakes = takes || [];

  // Always use first two items for smooth transitions
  const currentTake = safeTakes[0];
  const nextTake = safeTakes[1];

  // Auto-load more when getting low on cards
  useEffect(() => {
    if (loadMore && safeTakes.length <= 5 && hasMore && !loading) {
      loadMore(20).catch(console.error);
    }
  }, [safeTakes.length, hasMore, loading, loadMore]);

  // Handle button press - now triggers flip animation
  const handleButtonVote = (vote: 'hot' | 'not') => {
    if (!currentTake || isAnimating.value || isCardFlipped) return;
    Vibration.vibrate(25);
    flipCard(vote);
  };

  // Handle skip with animation (for both button press and swipe down)
  const handleSkipWithAnimation = () => {
    if (!currentTake || isAnimating.value) return;
    isAnimating.value = true;
    const id = currentTake.id;
    Vibration.vibrate(15);
    translateY.value = withSpring(
      height * 0.8,
      { damping: 15, stiffness: 120, mass: 0.8 },
      () => {
        'worklet';
        translateX.value = 0;
        translateY.value = 0;
        scale.value = withSpring(1);
        runOnJS(jsOnSkip)(id);
        isAnimating.value = false; // release
      }
    );
  };

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      if (isAnimating.value) return; // ignore new gestures mid-flight
      // If card is flipped, any gesture continues to next
      if (isCardFlipped) {
        runOnJS(continueToNext)();
        return;
      }
      scale.value = withSpring(0.95);
      runOnJS(Vibration.vibrate)(10);
    },
    onActive: (event) => {
      if (isAnimating.value || isCardFlipped) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      
      // Vote indicator based on swipe direction
      const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;
      const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;
      const shouldSwipeDown = event.translationY > SWIPE_DOWN_THRESHOLD;
      
      // Update vote indicator
      if (shouldSwipeRight) {
        runOnJS(jsSetVote)('hot');
      } else if (shouldSwipeLeft) {
        runOnJS(jsSetVote)('not');
      } else if (shouldSwipeDown) {
        runOnJS(jsSetVote)(null); // Clear vote for skip
      } else {
        runOnJS(jsSetVote)(null); // Clear vote when not at threshold
      }
      
      // Horizontal swipe feedback
      if ((shouldSwipeRight || shouldSwipeLeft) && Math.abs(event.translationX) > SWIPE_THRESHOLD && Math.abs(event.translationX) < SWIPE_THRESHOLD + 20) {
        runOnJS(Vibration.vibrate)(15);
      }
      
      // Down swipe feedback
      if (shouldSwipeDown && Math.abs(event.translationY) > SWIPE_DOWN_THRESHOLD && Math.abs(event.translationY) < SWIPE_DOWN_THRESHOLD + 30) {
        runOnJS(Vibration.vibrate)(12);
      }
    },
    onEnd: (event) => {
      if (isAnimating.value) return;
      
      const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;
      const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;
      const shouldSwipeDown = event.translationY > SWIPE_DOWN_THRESHOLD;

      const id = currentTake?.id; // snapshot (may be undefined)
      const reset = () => {
        'worklet';
        translateX.value = 0;
        translateY.value = 0;
        scale.value = withSpring(1);
      };

      if (shouldSwipeDown && id) {
        isAnimating.value = true;
        runOnJS(Vibration.vibrate)(25);
        translateY.value = withSpring(
          height * 0.8,
          { damping: 15, stiffness: 120, mass: 0.8 },
          () => { 'worklet'; reset(); runOnJS(jsOnSkip)(id); isAnimating.value = false; }
        );
        return;
      }

      if (shouldSwipeRight && id && !isCardFlipped) {
        // Front side: Bounce back and flip to reveal
        runOnJS(Vibration.vibrate)(25);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
        runOnJS(flipCard)('hot');
        return;
      }

      if (shouldSwipeLeft && id && !isCardFlipped) {
        // Front side: Bounce back and flip to reveal
        runOnJS(Vibration.vibrate)(25);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
        runOnJS(flipCard)('not');
        return;
      }

      // bounce back - clear vote indicator
      runOnJS(Vibration.vibrate)(8);
      runOnJS(jsSetVote)(null); // Clear vote indicator
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
    },
  });

  // Outer card gets perspective so the 3D reads nicely
  const card3DStyle = useAnimatedStyle(() => {
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
        { perspective: 1000 }, // 3D space
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
        { scale: scale.value },
      ],
      opacity,
      zIndex: 2,
    };
  });

  const nextCardStyle = useAnimatedStyle(() => {
    // Subtle scale + parallax, NO opacity changes
    const progress = Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1);
    const nextScale = 0.98 + 0.02 * progress;       // 0.98 → 1.0
    const nextTranslateY = 8 * (1 - progress);      // 8px → 0px

    return {
      transform: [
        { scale: nextScale },
        { translateY: nextTranslateY },
      ],
      opacity: 1, // Keep fully visible so you see the face immediately
      zIndex: 1,
    };
  });

  // 3D flip animations
  const frontFaceStyle = useAnimatedStyle(() => {
    if (ANDROID_SAFE_FLIP) {
      return { opacity: 1 - flipSV.value };
    }
    const deg = interpolate(flipSV.value, [0, 1], [0, 180]);
    const opacity = interpolate(flipSV.value, [0, 0.45, 0.5], [1, 1, 0], Extrapolate.CLAMP);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${deg}deg` }],
      opacity,
      backfaceVisibility: 'hidden' as const,
    };
  });
  
  const backFaceStyle = useAnimatedStyle(() => {
    if (ANDROID_SAFE_FLIP) {
      return { 
        opacity: flipSV.value,
        ...absoluteFill,
      };
    }
    const deg = interpolate(flipSV.value, [0, 1], [180, 360]);
    const opacity = interpolate(flipSV.value, [0.5, 0.55, 1], [0, 1, 1], Extrapolate.CLAMP);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${deg}deg` }],
      opacity,
      backfaceVisibility: 'hidden' as const,
      ...absoluteFill,
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

  const skipOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [0, SWIPE_DOWN_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP
    );
    return { opacity };
  });

  // Show end screen only when truly no more content
  const noCards = safeTakes.length === 0;
  const atEnd = !currentTake; // No current card means we're at the end

  if (noCards || (atEnd && !hasMore && !loading)) {
    return (
      <View style={styles.container}>
        <View style={styles.endContainer}>
          <Text style={styles.endEmoji}>🎉</Text>
          <Text style={[styles.endTitle, { color: theme.text }]}>
            {noCards ? 'No takes available yet!' : 'You\'ve reached the end!'}
          </Text>
          <Text style={[styles.endMessage, { color: theme.textSecondary }]}>
            {noCards 
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

  // If at end but still has more or loading, show empty container (loading happens in background)
  if (atEnd && (loading || hasMore)) {
    if (loadMore && !loading) loadMore(20).catch(console.error);
    return <View style={styles.container} />;
  }


  return (
    <View style={styles.container}>
      <VoteIndicator vote={currentVote} isDarkMode={isDarkMode} />
      
      
      {/* Next card (background - always visible) */}
      {nextTake && (
        <Animated.View 
          key={`next-${nextTake.id}`} 
          style={[styles.cardContainer, styles.nextCard, nextCardStyle]}
          pointerEvents="none"
        >
          <TakeCard 
            take={nextTake} 
            isDarkMode={isDarkMode} 
            showStats={false}
          />
        </Animated.View>
      )}
      
      {/* Current card (foreground) - Front and Back views */}
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View 
          key={`current-${currentTake?.id}`} 
          style={[styles.cardContainer, card3DStyle]}
          onTouchEnd={() => {
            if (isCardFlipped) {
              continueToNext();
            }
          }}
        >
          {/* 👻 Invisible sizer only when we actually have a card */}
          {!!currentTake && (
            <View pointerEvents="none" style={styles.ghostSizer}>
              <TakeCard
                take={currentTake}
                isDarkMode={isDarkMode}
                showStats={false}
              />
            </View>
          )}
          
          {/* FRONT */}
          {!!currentTake && (
            <Animated.View
              style={[absoluteFill, frontFaceStyle]}
              pointerEvents={isCardFlipped ? 'none' : 'auto'}
            >
              <TakeCard
                take={currentTake}
                isDarkMode={isDarkMode}
                onNotPress={() => handleButtonVote('not')}
                onHotPress={() => handleButtonVote('hot')}
                showStats={false}
                userVote={null}
                isFlipped={false}
              />
            </Animated.View>
          )}

          {/* BACK (stats) */}
          {!!currentTake && (
            <Animated.View
              style={[absoluteFill, backFaceStyle]}
              pointerEvents={isCardFlipped ? 'auto' : 'none'}
            >
              <TakeCard
                take={{
                  ...currentTake,
                  // optional: optimistic single-vote bump so stats include user's vote
                  hotVotes: currentTake.hotVotes + (lastVote === 'hot' ? 1 : 0),
                  notVotes: currentTake.notVotes + (lastVote === 'not' ? 1 : 0),
                  totalVotes: currentTake.totalVotes + (lastVote ? 1 : 0),
                }}
                isDarkMode={isDarkMode}
                showStats={true}
                userVote={lastVote}
                isFlipped={true}
              />
            </Animated.View>
          )}
          
          {/* Overlay indicators - hidden when flipped */}
          {!isCardFlipped && (
            <>
              <Animated.View style={[styles.overlayLeft, { backgroundColor: theme.not }, notOverlayStyle]}>
                <Text style={styles.overlayText}>NOT</Text>
              </Animated.View>
              
              <Animated.View style={[styles.overlayRight, { backgroundColor: theme.hot }, hotOverlayStyle]}>
                <Text style={styles.overlayText}>HOT</Text>
              </Animated.View>

              <Animated.View style={[styles.overlayBottom, { backgroundColor: 'rgba(0,0,0,0.8)' }, skipOverlayStyle]}>
                <Text style={styles.overlayText}>SKIP</Text>
              </Animated.View>
            </>
          )}
        </Animated.View>
      </PanGestureHandler>
      
      {/* Skip Button */}
      <AnimatedPressable 
        style={styles.skipButton} 
        onPress={handleSkipWithAnimation}
        scaleValue={0.9}
        hapticIntensity={12}
      >
        <Text style={styles.skipButtonText}>Skip</Text>
      </AnimatedPressable>

      {/* Instructions Button */}
      {onShowInstructions && (
        <AnimatedPressable 
          style={[styles.skipButton, styles.instructionsButton]} 
          onPress={onShowInstructions}
          scaleValue={0.9}
          hapticIntensity={8}
        >
          <Text style={[styles.skipButtonText, styles.instructionsButtonText]}>
            ❓ Instructions
          </Text>
        </AnimatedPressable>
      )}
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
  cardBack: {
    backfaceVisibility: 'hidden',
  },
  ghostSizer: {
    opacity: 0, // invisible, but participates in layout
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    transform: [{ rotate: '15deg' }],
  },
  overlayRight: {
    position: 'absolute',
    top: 50,
    left: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    transform: [{ rotate: '-15deg' }],
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
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
  instructionsButton: {
    bottom: 15, // Position below skip button
    backgroundColor: 'rgba(255, 107, 107, 0.95)', // More vibrant - less transparency
  },
  instructionsButtonText: {
    fontSize: 14,
  },
});