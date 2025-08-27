import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  SafeAreaView,
  BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  PanGestureHandler, 
  PanGestureHandlerGestureEvent,
  GestureHandlerRootView 
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  runOnJS,
} from 'react-native-reanimated';
import { colors } from '../constants';

interface InstructionsModalProps {
  visible: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');
const SWIPE_THRESHOLD = screenWidth * 0.15; // 15% of screen width to trigger navigation (more sensitive)

export const InstructionsModal: React.FC<InstructionsModalProps> = ({
  visible,
  onClose,
  isDarkMode = false,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const theme = isDarkMode ? colors.dark : colors.light;
  const translateX = useSharedValue(0);

  // Reset to first page when modal closes
  useEffect(() => {
    if (!visible) {
      setCurrentPage(0);
    }
  }, [visible]);

  // Handle back button when instructions modal is open
  useEffect(() => {
    if (!visible) return;

    const backAction = () => {
      if (currentPage > 0) {
        // Go back to previous page
        setCurrentPage(currentPage - 1);
        return true; // Prevent default back behavior
      } else {
        // On first page, close the modal
        onClose();
        return true; // Prevent default back behavior
      }
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [visible, currentPage, onClose]);

  const pages = [
    {
      title: "Welcome to Hot or Not Takes! 🔥",
      content: (
        <>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>What's a "Hot Take"?</Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              A hot take is a bold, controversial opinion that gets people thinking and often sparks debate.{'\n\n'}
              These are opinions that make people say "Oh no they didn't! 😱" or "Finally someone said it! 🤩"
            </Text>
          </View>

          <View style={[styles.exampleBox, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
            <Text style={[styles.exampleTitle, { color: theme.text }]}>Examples:</Text>
            <Text style={[styles.exampleText, { color: theme.textSecondary }]}>• "Pineapple belongs on pizza"</Text>
            <Text style={[styles.exampleText, { color: theme.textSecondary }]}>• "The book is always better than the movie"</Text>
            <Text style={[styles.exampleText, { color: theme.textSecondary }]}>• "Coffee is just dirty water"</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Hot Takes</Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              • <Text style={[styles.bold, { color: theme.text }]}>Completely anonymous</Text> - no usernames or profiles{'\n\n'}
              • <Text style={[styles.bold, { color: theme.text }]}>Your candid opinion</Text> about any topic that matters to you{'\n\n'}
              • <Text style={[styles.bold, { color: theme.text }]}>Only you can delete them</Text> - tap the 📝 icon to manage your takes
            </Text>
          </View>
        </>
      ),
    },
    {
      title: "How to Vote 🗳️",
      content: (
        <>
          <View style={[styles.voteSection, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
            <View style={styles.voteOption}>
              <Text style={styles.voteEmoji}>🔥</Text>
              <Text style={[styles.voteLabel, { color: theme.text }]}>HOT</Text>
              <Text style={[styles.voteDescription, { color: theme.textSecondary }]}>
                I AGREE with this take{'\n'}
                YES, this is true{'\n'}
                This opinion is VALID
              </Text>
            </View>

            <View style={styles.orDivider}>
              <Text style={[styles.orText, { color: theme.textSecondary }]}>- OR -</Text>
            </View>

            <View style={styles.voteOption}>
              <Text style={styles.voteEmoji}>❄️</Text>
              <Text style={[styles.voteLabel, { color: theme.text }]}>NOT</Text>
              <Text style={[styles.voteDescription, { color: theme.textSecondary }]}>
                I DISAGREE with this take{'\n'}
                NO, this is wrong{'\n'}
                This opinion is TRASH
              </Text>
            </View>

            <View style={styles.orDivider}>
              <Text style={[styles.orText, { color: theme.textSecondary }]}>- OR -</Text>
            </View>

            <View style={styles.voteOption}>
              <Text style={styles.voteEmoji}>⏭️</Text>
              <Text style={[styles.voteLabel, { color: theme.text }]}>SKIP</Text>
              <Text style={[styles.voteDescription, { color: theme.textSecondary }]}>
                Not sure how to vote{'\n'}
                Don't understand the topic{'\n'}
                Need more context
              </Text>
            </View>
          </View>

          <Text style={[styles.footnote, { color: theme.textSecondary }]}>
            Remember: It's all about opinions - there's no right or wrong answer!
          </Text>
        </>
      ),
    },
    {
      title: "How to Play 🎮",
      content: (
        <>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Navigation</Text>
            <View style={styles.buttonGrid}>
              <View style={styles.buttonItem}>
                <Text style={styles.buttonIcon}>📝</Text>
                <Text style={[styles.buttonLabel, { color: theme.textSecondary }]}>My Takes</Text>
              </View>
              <View style={styles.buttonItem}>
                <Text style={styles.buttonIcon}>🏆</Text>
                <Text style={[styles.buttonLabel, { color: theme.textSecondary }]}>Leaderboards</Text>
              </View>
              <View style={styles.buttonItem}>
                <Text style={styles.buttonIcon}>⭐</Text>
                <Text style={[styles.buttonLabel, { color: theme.textSecondary }]}>Favorites</Text>
              </View>
              <View style={styles.buttonItem}>
                <Text style={styles.buttonIcon}>↩️</Text>
                <Text style={[styles.buttonLabel, { color: theme.textSecondary }]}>Recent Votes</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Voting Actions</Text>
            
            <View style={[styles.instructionItem, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
              <Text style={styles.instructionEmoji}>👆</Text>
              <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
                <Text style={[styles.bold, { color: theme.text }]}>TAP</Text> the vote buttons at the bottom of each card
              </Text>
            </View>

            <View style={[styles.instructionItem, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
              <Text style={styles.instructionEmoji}>👉</Text>
              <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
                <Text style={[styles.bold, { color: theme.text }]}>SWIPE RIGHT</Text> to vote 🔥 HOT (agree)
              </Text>
            </View>

            <View style={[styles.instructionItem, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
              <Text style={styles.instructionEmoji}>👈</Text>
              <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
                <Text style={[styles.bold, { color: theme.text }]}>SWIPE LEFT</Text> to vote ❄️ NOT (disagree)
              </Text>
            </View>

            <View style={[styles.instructionItem, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
              <Text style={styles.instructionEmoji}>↕️</Text>
              <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
                <Text style={[styles.bold, { color: theme.text }]}>SWIPE UP or DOWN</Text> to skip ⏭️ if you're unsure
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>After Voting</Text>
            
            <View style={[styles.instructionItem, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
              <Text style={styles.instructionEmoji}>📊</Text>
              <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
                <Text style={[styles.bold, { color: theme.text }]}>TAP takes</Text> in Favorites, My Takes, or Leaderboard to see full stats
              </Text>
            </View>

            <View style={[styles.instructionItem, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
              <Text style={styles.instructionEmoji}>🔄</Text>
              <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
                <Text style={[styles.bold, { color: theme.text }]}>CHANGE votes</Text> by tapping "Change your vote" on any stats card
              </Text>
            </View>

            <View style={[styles.instructionItem, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
              <Text style={styles.instructionEmoji}>🗳️</Text>
              <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
                <Text style={[styles.bold, { color: theme.text }]}>VOTE NOW</Text> on takes you haven't voted on yet by tapping the vote button
              </Text>
            </View>

            <View style={[styles.instructionItem, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
              <Text style={styles.instructionEmoji}>📤</Text>
              <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
                <Text style={[styles.bold, { color: theme.text }]}>SHARE</Text> interesting takes using the share button on stats cards
              </Text>
            </View>
          </View>

          {/* <View style={styles.tipBox}>
            <Text style={styles.tipText}>
              💡 Tip: You can change categories using the dropdown at the top!
            </Text>
          </View> */}

          <View style={[styles.tipBox, { backgroundColor: '#E8F5E8', marginTop: -10 }]}>
            <Text style={[styles.tipText, { color: '#2E7D32' }]}>
              🚀 Pro Tip: The more you swipe in a session, the fewer ads you'll see! Keep swiping for longer uninterrupted streaks.
            </Text>
          </View>
        </>
      ),
    },
  ];

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onActive: (event) => {
      // Limit the translation to prevent over-stretching
      const maxTranslation = screenWidth * 0.3;
      translateX.value = Math.max(-maxTranslation, Math.min(maxTranslation, event.translationX));
    },
    onEnd: (event) => {
      const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;
      const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;

      if (shouldSwipeLeft) {
        // Swipe left = go to next page
        runOnJS(handleNext)();
      } else if (shouldSwipeRight) {
        // Swipe right = go to previous page
        runOnJS(handlePrevious)();
      }

      // Instant return to center (no animation)
      translateX.value = 0;
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={styles.header} />

          <PanGestureHandler onGestureEvent={gestureHandler}>
            <Animated.View style={[{ flex: 1 }, animatedStyle]}>
              <ScrollView 
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                scrollEnabled={true}
              >
                <LinearGradient
                  colors={['#FF6B6B', '#FF8B8B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.titleContainer}
                >
                  <Text style={styles.pageTitle}>{pages[currentPage].title}</Text>
                </LinearGradient>

                <View style={styles.pageContent}>
                  {pages[currentPage].content}
                </View>
              </ScrollView>
            </Animated.View>
          </PanGestureHandler>

        <View style={styles.footer}>
          <View style={styles.pagination}>
            {pages.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  { backgroundColor: index === currentPage ? '#FF6B6B' : '#E0E0E0' }
                ]}
              />
            ))}
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.skipButtonBottom]}
              onPress={onClose}
            >
              <Text style={styles.skipButtonBottomText}>Skip</Text>
            </TouchableOpacity>

            {currentPage > 0 && (
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handlePrevious}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleNext}
            >
              <Text style={styles.primaryButtonText}>
                {currentPage === pages.length - 1 ? "Let's Go! 🚀" : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  titleContainer: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  pageContent: {
    flex: 1,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#666',
  },
  exampleBox: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  exampleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  exampleText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#555',
    marginBottom: 5,
  },
  voteSection: {
    flexDirection: 'column',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },
  voteOption: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  voteEmoji: {
    fontSize: 36,
    marginBottom: 6,
  },
  voteLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  voteDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  orDivider: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  orText: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  footnote: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  instructionEmoji: {
    fontSize: 30,
    marginRight: 15,
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  bold: {
    fontWeight: 'bold',
  },
  buttonGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  buttonItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 60,
  },
  buttonIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  tipBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#856404',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#FF6B6B',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#F0F0F0',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButtonBottom: {
    backgroundColor: '#E0E0E0',
  },
  skipButtonBottomText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});