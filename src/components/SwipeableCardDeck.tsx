import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Text,
} from 'react-native';
import CardStack, { Card } from 'react-native-deck-swiper';
import { Take, TakeVote } from '../types';
import { TakeCard } from './TakeCard';
import { VoteIndicator } from './VoteIndicator';
import { dimensions } from '../constants';

interface SwipeableCardDeckProps {
  takes: Take[];
  onVote: (takeId: string, vote: 'hot' | 'not') => void;
  onEndReached?: () => void;
  isDarkMode?: boolean;
}

export const SwipeableCardDeck: React.FC<SwipeableCardDeckProps> = ({
  takes,
  onVote,
  onEndReached,
  isDarkMode = false,
}) => {
  const [currentVote, setCurrentVote] = useState<'hot' | 'not' | null>(null);
  const cardStackRef = useRef<CardStack<Take> | null>(null);

  // Safety check - return early if no takes data
  if (!takes || !Array.isArray(takes) || takes.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No takes available</Text>
        </View>
      </View>
    );
  }

  const handleSwipeLeft = (cardIndex: number) => {
    const take = takes[cardIndex];
    setCurrentVote('not');
    onVote(take.id, 'not');
    
    // Clear vote indicator after animation
    setTimeout(() => setCurrentVote(null), 1000);
  };

  const handleSwipeRight = (cardIndex: number) => {
    const take = takes[cardIndex];
    setCurrentVote('hot');
    onVote(take.id, 'hot');
    
    // Clear vote indicator after animation
    setTimeout(() => setCurrentVote(null), 1000);
  };

  const handleSwipedAll = () => {
    Alert.alert(
      'No more takes!',
      'You\'ve voted on all available takes. Great job!',
      [
        {
          text: 'Restart',
          onPress: () => {
            if (cardStackRef.current) {
              cardStackRef.current.jumpToCardIndex(0);
            }
          },
        },
      ]
    );
    onEndReached?.();
  };

  const renderCard = (take: Take, index: number) => {
    if (!take) return null;
    
    return (
      <View style={styles.cardContainer}>
        <TakeCard take={take} isDarkMode={isDarkMode} />
      </View>
    );
  };

  const renderNoMoreCards = () => {
    return (
      <View style={styles.noMoreCards}>
        {/* Empty view - we handle this with alert */}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <VoteIndicator vote={currentVote} isDarkMode={isDarkMode} />
      
      <CardStack
        ref={cardStackRef}
        data={takes}
        renderCard={renderCard}
        renderNoMoreCards={renderNoMoreCards}
        onSwipedLeft={handleSwipeLeft}
        onSwipedRight={handleSwipeRight}
        onSwipedAll={handleSwipedAll}
        cardIndex={0}
        backgroundColor="transparent"
        infinite={false}
        showSecondCard={true}
        stackSize={3}
        stackSeparation={8}
        animateCardOpacity={true}
        swipeBackCard={false}
        disableBottomSwipe={true}
        disableTopSwipe={true}
        verticalSwipe={false}
        horizontalSwipe={true}
        horizontalThreshold={dimensions.window.width * 0.3}
        verticalThreshold={dimensions.window.height * 0.3}
        cardVerticalMargin={dimensions.spacing.lg}
        cardHorizontalMargin={dimensions.spacing.sm}
        marginTop={50}
        marginBottom={50}
        useViewOverflow={false}
        animateOverlayLabelsOpacity={true}
        overlayLabels={{
          left: {
            title: 'HOT',
            style: {
              label: {
                backgroundColor: '#FF4757',
                color: 'white',
                fontSize: dimensions.fontSize.xlarge,
                fontWeight: 'bold',
                padding: dimensions.spacing.md,
                borderRadius: 8,
              },
              wrapper: {
                flexDirection: 'column',
                alignItems: 'flex-end',
                justifyContent: 'flex-start',
                marginTop: 30,
                marginLeft: -50,
              },
            },
          },
          right: {
            title: 'NOT',
            style: {
              label: {
                backgroundColor: '#FF3838',
                color: 'white',
                fontSize: dimensions.fontSize.xlarge,
                fontWeight: 'bold',
                padding: dimensions.spacing.md,
                borderRadius: 8,
              },
              wrapper: {
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                marginTop: 30,
                marginLeft: 50,
              },
            },
          },
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMoreCards: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});