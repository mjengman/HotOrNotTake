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
  externalStatsCard?: {take: Take, vote: 'hot' | 'not'} | null;
  onExternalStatsCardDismiss?: () => void;
  onShowRecentVotes?: () => void;
}

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.2;
const SWIPE_DOWN_THRESHOLD = height * 0.2; // 20% of screen height
const SWIPE_UP_THRESHOLD = height * 0.2; // 20% of screen height for upward swipe

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
  externalStatsCard = null,
  onExternalStatsCardDismiss,
  onShowRecentVotes,
}) => {
  const [currentVote, setCurrentVote] = useState<'hot' | 'not' | null>(null);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [lastVote, setLastVote] = useState<'hot' | 'not' | null>(null);
  const [autoDismissTimeout, setAutoDismissTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const isAnimating = useSharedValue(false);
  
  // 0 = front, 1 = back (stats)
  const flipSV = useSharedValue(0);
  
  // Freeze system to prevent promotion flicker
  const frozenCurrent = React.useRef<Take | null>(null);
  const frozenNext = React.useRef<Take | null>(null);
  const [useFrozen, setUseFrozen] = useState(false);
  
  // Drives the local promotion animation of the next card
  const promoteSV = useSharedValue(0);
  
  // Reactive shared values for worklets (prevents stale boolean capture)
  const frozenSV = useSharedValue(0);
  const flippedSV = useSharedValue(0);
  const animatingSV = useSharedValue(0);

  useEffect(() => { frozenSV.value = useFrozen ? 1 : 0; }, [useFrozen]);
  useEffect(() => { flippedSV.value = isCardFlipped ? 1 : 0; }, [isCardFlipped]);

  // Cleanup auto-dismiss timeout on unmount
  useEffect(() => {
    return () => {
      if (autoDismissTimeout) {
        clearTimeout(autoDismissTimeout);
      }
    };
  }, [autoDismissTimeout]);

  // Handle external stats card
  useEffect(() => {
    if (externalStatsCard) {
      // Clear any existing timeout since this is manual
      if (autoDismissTimeout) {
        clearTimeout(autoDismissTimeout);
        setAutoDismissTimeout(null);
      }
      
      // Set the external stats card as the current flipped state
      setIsCardFlipped(true);
      setLastVote(externalStatsCard.vote);
      setCurrentVote(null); // No current vote since this is historical
      
      // Set the flip animation to show the stats
      flipSV.value = 1;
      promoteSV.value = 1;
      animatingSV.value = 0;
    }
  }, [externalStatsCard]);

  const theme = isDarkMode ? colors.dark : colors.light;

  // JS-thread helpers for runOnJS
  const jsSetVote = (val: 'hot' | 'not' | null) => setCurrentVote(val);
  const jsOnSkip = (id: string) => onSkip(id);
  const jsSetAutoDismiss = () => {
    const timeout = setTimeout(() => {
      continueToNext();
    }, 1200);
    setAutoDismissTimeout(timeout);
  };
  
  // Flip the card to reveal stats
  const flipCard = (vote: 'hot' | 'not') => {
    setLastVote(vote);
    
    // 🧊 FREEZE: Capture current state immediately when vote is cast
    if (renderCurrent) {
      frozenCurrent.current = renderCurrent;
      frozenNext.current = renderNext;
      setUseFrozen(true);
      
      // Submit vote immediately to advance deck behind the stats card
      onVote(renderCurrent.id, vote);
    }
    
    // Let VoteIndicator handle its own auto-hide timing
    
    // Set animating flag and bounce micro-scale then flip
    animatingSV.value = 1;
    scale.value = withSpring(0.96, {}, () => {
      'worklet';
      flipSV.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          runOnJS(setIsCardFlipped)(true); // set after flip completes
          // Auto-dismiss stats card after 2.5 seconds
          runOnJS(jsSetAutoDismiss)();
          // Start promoting next card behind the stats card
          promoteSV.value = withTiming(1, { duration: 300 }, () => {
            'worklet';
            animatingSV.value = 0; // Clear animation flag
          });
        }
      });
      scale.value = withSpring(1);
    });
  };
  
  // Continue to next card after reveal - promotion already happened behind stats
  const continueToNext = (skipAnimation = false) => {
    if (isAnimating.value) return;
    
    // Clear auto-dismiss timeout if it exists
    if (autoDismissTimeout) {
      clearTimeout(autoDismissTimeout);
      setAutoDismissTimeout(null);
    }
    
    // If this is an external stats card, dismiss it properly
    if (externalStatsCard && onExternalStatsCardDismiss) {
      // Reset all animation values immediately
      translateX.value = 0;
      translateY.value = 0;
      scale.value = 1;
      flipSV.value = 0;
      promoteSV.value = 0;
      animatingSV.value = 0;
      
      // Reset state
      setIsCardFlipped(false);
      setLastVote(null);
      setCurrentVote(null);
      
      // Clear timeout
      if (autoDismissTimeout) {
        clearTimeout(autoDismissTimeout);
        setAutoDismissTimeout(null);
      }
      
      onExternalStatsCardDismiss();
      return;
    }
    
    isAnimating.value = true;
    
    if (skipAnimation) {
      // Skip animation - just reset everything immediately
      translateX.value = 0;
      translateY.value = 0;
      scale.value = 1;
      flipSV.value = 0;
      promoteSV.value = 0;
      setIsCardFlipped(false);
      setLastVote(null);
      setCurrentVote(null);
      setUseFrozen(false); // 🔓 UNFREEZE - reveal new cards
      isAnimating.value = false;
    } else {
      // Simple clean transition - just reset everything since promotion already happened
      translateX.value = withTiming(0, { duration: 200 }, () => {
        'worklet';
        // Reset everything for next card
        translateY.value = 0;
        scale.value = 1;
        flipSV.value = 0;
        promoteSV.value = 0;
        runOnJS(setIsCardFlipped)(false);
        runOnJS(setLastVote)(null);
        runOnJS(setCurrentVote)(null);
        runOnJS(setUseFrozen)(false); // 🔓 UNFREEZE - reveal new cards
        isAnimating.value = false;
      });
    }
  };

  // Ensure takes is always an array
  const safeTakes = takes || [];

  // Always use first three items for smooth transitions
  const currentTake = safeTakes[0];
  const nextTake = safeTakes[1];
  const thirdTake = safeTakes[2];
  
  // Safety check: if current take is somehow undefined but we have takes, log error
  if (!currentTake && safeTakes.length > 0) {
    console.error('⚠️ No current take but safeTakes has items! This should not happen.');
  }
  
  // Derive what to render - external stats card takes priority, then frozen data during promotion, then live props
  const renderCurrent = externalStatsCard ? externalStatsCard.take : 
    (useFrozen && frozenCurrent.current ? frozenCurrent.current : currentTake);
  const renderNext = useFrozen && frozenNext.current ? frozenNext.current : nextTake;

  // If we run out of takes, clean up frozen state to prevent crashes
  useEffect(() => {
    if (!currentTake && !nextTake && useFrozen && !isCardFlipped) {
      console.log('🚨 No more takes - cleaning up frozen state');
      // Use setTimeout to defer state cleanup to next tick, avoiding hooks mismatch
      setTimeout(() => {
        setUseFrozen(false);
        frozenCurrent.current = null;
        frozenNext.current = null;
        promoteSV.value = 0;
      }, 0);
    }
  }, [currentTake, nextTake, useFrozen, isCardFlipped]);

  // Auto-load more when getting low on cards
  useEffect(() => {
    if (loadMore && safeTakes.length <= 5 && hasMore && !loading) {
      loadMore(20).catch(console.error);
    }
  }, [safeTakes.length, hasMore, loading, loadMore]);

  // Handle button press - now triggers pronounced swipe animation then flip
  const handleButtonVote = (vote: 'hot' | 'not') => {
    if (!currentTake || isAnimating.value || isCardFlipped || externalStatsCard) return;
    
    // Show vote indicator just like swipe gestures do
    setCurrentVote(vote);
    
    // Simulate dramatic swipe animation - more pronounced than gesture
    const direction = vote === 'hot' ? 1 : -1; // right for hot, left for not
    const swipeDistance = SWIPE_THRESHOLD * 0.8; // Much bigger swipe for impact
    
    // Quick leap to edge with timing (no lingering)
    translateX.value = withTiming(swipeDistance * direction, { 
      duration: 150, // Quick leap
      easing: Easing.out(Easing.quad)
    }, () => {
      'worklet';
      // Immediate bouncy return
      translateX.value = withSpring(0, { damping: 15, stiffness: 300 });
      translateY.value = withSpring(0);
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      runOnJS(Vibration.vibrate)(30);
      runOnJS(flipCard)(vote);
    });
    
    // Quick scale down
    scale.value = withTiming(0.92, { duration: 150, easing: Easing.out(Easing.quad) });
  };

  // Handle skip with animation (for both button press and swipe up/down)
  const handleSkipWithAnimation = (direction: 'up' | 'down' = 'down') => {
    if (!currentTake || isAnimating.value || externalStatsCard) return;
    
    // 🧊 FREEZE: Capture current state immediately when skip is triggered
    if (renderCurrent) {
      frozenCurrent.current = renderCurrent;
      frozenNext.current = renderNext;
      setUseFrozen(true);
      
      // Submit skip immediately to advance deck behind the animation
      onSkip(renderCurrent.id);
    }
    
    isAnimating.value = true;
    animatingSV.value = 1;
    Vibration.vibrate(15);
    
    // Animate up or down based on direction
    const targetY = direction === 'up' ? -height * 0.8 : height * 0.8;
    
    translateY.value = withSpring(
      targetY,
      { damping: 15, stiffness: 120, mass: 0.8 },
      () => {
        'worklet';
        // Start promoting next card during return animation
        promoteSV.value = withTiming(1, { duration: 200 }, () => {
          'worklet';
          // Reset everything for next card
          translateX.value = 0;
          translateY.value = 0;
          scale.value = 1;
          runOnJS(setUseFrozen)(false); // 🔓 UNFREEZE
          animatingSV.value = 0;
          isAnimating.value = false;
        });
      }
    );
  };

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      if (isAnimating.value) return; // ignore new gestures mid-flight
      scale.value = withSpring(0.95);
      runOnJS(Vibration.vibrate)(10);
    },
    onActive: (event) => {
      if (isAnimating.value) return;
      
      // Allow dragging the stats card too
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      
      // Only show vote indicators when NOT flipped (front card only) and not showing external stats
      if (!flippedSV.value && !externalStatsCard) {
        // Vote indicator based on swipe direction
        const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;
        const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;
        const shouldSwipeDown = event.translationY > SWIPE_DOWN_THRESHOLD;
        const shouldSwipeUp = event.translationY < -SWIPE_UP_THRESHOLD;
        
        // Update vote indicator
        if (shouldSwipeRight) {
          runOnJS(jsSetVote)('hot');
        } else if (shouldSwipeLeft) {
          runOnJS(jsSetVote)('not');
        } else if (shouldSwipeDown || shouldSwipeUp) {
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
        
        // Up swipe feedback
        if (shouldSwipeUp && Math.abs(event.translationY) > SWIPE_UP_THRESHOLD && Math.abs(event.translationY) < SWIPE_UP_THRESHOLD + 30) {
          runOnJS(Vibration.vibrate)(12);
        }
      }
    },
    onEnd: (event) => {
      if (isAnimating.value) return;
      
      // If card is flipped (showing stats), any swipe continues to next
      if (flippedSV.value) {
        // Check if they actually swiped (not just a tap)
        const didSwipe = Math.abs(event.translationX) > 20 || Math.abs(event.translationY) > 20;
        // Continue immediately with no animation if they swiped
        runOnJS(continueToNext)(didSwipe);
        return;
      }
      
      // Don't allow voting on external stats cards - they're just for viewing
      if (externalStatsCard) {
        // Spring back to original position
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
        return;
      }
      
      const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;
      const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;
      const shouldSwipeDown = event.translationY > SWIPE_DOWN_THRESHOLD;
      const shouldSwipeUp = event.translationY < -SWIPE_UP_THRESHOLD;

      const id = currentTake?.id; // snapshot (may be undefined)
      const reset = () => {
        'worklet';
        translateX.value = 0;
        translateY.value = 0;
        scale.value = withSpring(1);
      };

      if ((shouldSwipeDown || shouldSwipeUp) && id) {
        // Use the same skip logic as button press for consistency (both up and down skip)
        // Pass direction based on which way they swiped
        const direction = shouldSwipeUp ? 'up' : 'down';
        runOnJS(handleSkipWithAnimation)(direction);
        return;
      }

      if (shouldSwipeRight && id && !flippedSV.value) {
        // Front side: Bounce back and flip to reveal
        runOnJS(Vibration.vibrate)(25);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
        runOnJS(flipCard)('hot');
        return;
      }

      if (shouldSwipeLeft && id && !flippedSV.value) {
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
      zIndex: flippedSV.value || animatingSV.value ? 5 : 2, // Highest z-index during animation and stats
    };
  });

  const nextCardStyle = useAnimatedStyle(() => {
    // When frozen, animate by promoteSV only (0 -> 1), otherwise use drag progress
    const p = frozenSV.value ? promoteSV.value : Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1);
    const nextScale = 0.98 + 0.02 * p;
    const nextTranslateY = 8 * (1 - p);

    return {
      transform: [
        { scale: nextScale },
        { translateY: nextTranslateY },
      ],
      opacity: 1,
      zIndex: frozenSV.value ? 3 : 1, // Higher during promotion, but lower than stats (5)
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
    const downOpacity = interpolate(
      translateY.value,
      [0, SWIPE_DOWN_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP
    );
    const upOpacity = interpolate(
      translateY.value,
      [-SWIPE_UP_THRESHOLD, 0],
      [1, 0],
      Extrapolate.CLAMP
    );
    return { opacity: Math.max(downOpacity, upOpacity) };
  });

  // Third card style - sits behind next card (MUST be before any returns!)
  const thirdCardStyle = useAnimatedStyle(() => {
    const thirdScale = 0.96;
    const thirdTranslateY = 16;

    return {
      transform: [
        { scale: thirdScale },
        { translateY: thirdTranslateY },
      ],
      opacity: 1,
      zIndex: 0,
    };
  });

  // Show end screen only when truly no more content and not in frozen state
  const noCards = safeTakes.length === 0;
  const atEnd = !currentTake && !renderCurrent; // No current card means we're at the end
  
  // Special case: if frozen but we have no actual cards left, show end screen
  const frozenButEmpty = useFrozen && !frozenCurrent.current && !frozenNext.current && noCards;
  
  // Don't show end screen if we're mid-animation or flipped (unless frozen but empty)
  // Note: removed isAnimating.value check to avoid Reanimated warning
  const shouldShowEnd = (!useFrozen && !isCardFlipped && (noCards || (atEnd && !hasMore && !loading))) || frozenButEmpty;
  if (shouldShowEnd) {
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
            Tap the memo icon (📝) to see all your takes
          </Text>
        </View>
      </View>
    );
  }

  // If at end but still has more or loading, show empty container (loading happens in background)
  if (atEnd && (loading || hasMore) && !useFrozen && !isCardFlipped) {
    if (loadMore && !loading) loadMore(20).catch(console.error);
    return <View style={styles.container} />;
  }
  
  // Safety fallback: if we have no current card to render but are frozen, show end screen
  if (!renderCurrent && useFrozen) {
    console.log('⚠️ No renderCurrent but frozen - transitioning to end screen');
    // Defer cleanup to avoid hooks issues
    setTimeout(() => {
      setUseFrozen(false);
      frozenCurrent.current = null;
      frozenNext.current = null;
    }, 0);
    return (
      <View style={styles.container}>
        <View style={styles.endContainer}>
          <Text style={styles.endEmoji}>🎉</Text>
          <Text style={[styles.endTitle, { color: theme.text }]}>
            You've reached the end!
          </Text>
          <Text style={[styles.endMessage, { color: theme.textSecondary }]}>
            Submit more takes to keep the conversation going!
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
            Tap the memo icon (📝) to see all your takes
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VoteIndicator vote={currentVote} isDarkMode={isDarkMode} />
      
      {/* Third card (furthest back - prevents flicker during promotion) */}
      <Animated.View 
        key="third-slot" 
        style={[styles.cardContainer, styles.nextCard, thirdCardStyle]}
        pointerEvents="none"
        collapsable={false}
      >
        {thirdTake ? (
          <TakeCard 
            take={thirdTake} 
            isDarkMode={isDarkMode} 
            showStats={false}
          />
        ) : (
          <View style={{ width: 1, height: 1 }} />
        )}
      </Animated.View>
      
      {/* Next card (background - always mounted) */}
      <Animated.View 
        key="next-slot" 
        style={[styles.cardContainer, styles.nextCard, nextCardStyle]}
        pointerEvents="none"
        collapsable={false}
      >
        {renderNext ? (
          <TakeCard 
            take={renderNext} 
            isDarkMode={isDarkMode} 
            showStats={false}
          />
        ) : (
          <View style={{ width: 1, height: 1 }} />
        )}
      </Animated.View>
      
      {/* Current card (foreground) - Front and Back views */}
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View 
          key="current-slot" 
          style={[styles.cardContainer, card3DStyle]}
          collapsable={false}
        >
          {/* 👻 Invisible sizer only when we actually have a card */}
          {!!renderCurrent && (
            <View pointerEvents="none" style={styles.ghostSizer}>
              <TakeCard
                take={renderCurrent}
                isDarkMode={isDarkMode}
                showStats={false}
              />
            </View>
          )}
          
          {/* FRONT */}
          {!!renderCurrent && (
            <Animated.View
              style={[absoluteFill, frontFaceStyle]}
              pointerEvents={isCardFlipped ? 'none' : 'auto'}
            >
              <TakeCard
                take={renderCurrent}
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
          {!!renderCurrent && (
            <Animated.View
              style={[absoluteFill, backFaceStyle]}
              pointerEvents={isCardFlipped ? 'auto' : 'none'}
            >
              <TakeCard
                take={{
                  ...renderCurrent,
                  // For external stats cards, don't add optimistic votes since they're historical
                  // For regular votes, add optimistic single-vote bump so stats include user's vote
                  hotVotes: renderCurrent.hotVotes + (!externalStatsCard && lastVote === 'hot' ? 1 : 0),
                  notVotes: renderCurrent.notVotes + (!externalStatsCard && lastVote === 'not' ? 1 : 0),
                  totalVotes: renderCurrent.totalVotes + (!externalStatsCard && lastVote ? 1 : 0),
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
      
      {/* Recent Votes Button */}
      {onShowRecentVotes && (
        <AnimatedPressable 
          style={[
            styles.skipButton,
            styles.recentVotesButton,
            isDarkMode 
              ? { backgroundColor: theme.surface } 
              : { backgroundColor: '#F0F0F1', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }
          ]} 
          onPress={onShowRecentVotes}
          scaleValue={0.9}
          hapticIntensity={8}
        >
          <Text style={[styles.recentVotesButtonIcon, isDarkMode && { color: theme.text }]}>📊</Text>
        </AnimatedPressable>
      )}

      {/* Skip Button */}
      <AnimatedPressable 
        style={[
          styles.skipButton,
          isDarkMode 
            ? { backgroundColor: theme.surface } // Match card color in dark mode
            : { backgroundColor: '#F0F0F1', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }
        ]} 
        onPress={() => handleSkipWithAnimation('up')}
        scaleValue={0.9}
        hapticIntensity={12}
      >
        <Text style={[styles.skipButtonText, isDarkMode ? { color: theme.text } : { color: '#333' }]}>⏭️</Text>
      </AnimatedPressable>

      {/* Instructions Button */}
      {onShowInstructions && (
        <AnimatedPressable 
          style={[
            styles.instructionsButton,
            !isDarkMode && { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }
          ]} 
          onPress={onShowInstructions}
          scaleValue={0.9}
          hapticIntensity={8}
        >
          <Text style={styles.instructionsButtonText}>
            ❔ Instructions
          </Text>
        </AnimatedPressable>
      )}
      
      {/* One-frame blocker to avoid any compositor seam */}
      {useFrozen && <View pointerEvents="none" style={StyleSheet.absoluteFill} />}
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
    left: 20,
    right: 20,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  overlayText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipButton: {
    position: 'absolute',
    bottom: 70,
    left: '50%',
    marginLeft: 5, // Small gap from center - skip on right
    backgroundColor: 'rgba(0,0,0,0.7)', // Keep as default, will override inline for dark mode
    width: 45,
    height: 45,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  skipButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  recentVotesButton: {
    position: 'absolute',
    bottom: 70,
    left: '50%',
    marginLeft: -55, // Position to left of center (45 width + 10 gap)
    width: 45,
    height: 45,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0, // Override the skip button padding
    paddingVertical: 0, // Override the skip button padding
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2.62,
  },
  recentVotesButtonIcon: {
    fontSize: dimensions.fontSize.xlarge,
  },
  instructionsButton: {
    position: 'absolute',
    bottom: 15, // Position below skip button
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.95)', // More vibrant - less transparency
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  instructionsButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});