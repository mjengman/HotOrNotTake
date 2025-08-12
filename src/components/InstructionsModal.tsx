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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants';

interface InstructionsModalProps {
  visible: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

export const InstructionsModal: React.FC<InstructionsModalProps> = ({
  visible,
  onClose,
  isDarkMode = false,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const theme = isDarkMode ? colors.dark : colors.light;

  // Reset to first page when modal closes
  useEffect(() => {
    if (!visible) {
      setCurrentPage(0);
    }
  }, [visible]);

  const pages = [
    {
      title: "Welcome to Hot or Not Takes! 🔥",
      content: (
        <>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>What's a "Hot Take"?</Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              A hot take is a bold, controversial opinion that sparks debate.{'\n\n'}
              These are opinions that make people say "Oh no they didn't!" 😱
            </Text>
          </View>

          <View style={[styles.exampleBox, { backgroundColor: isDarkMode ? theme.surface : '#F5F5F5' }]}>
            <Text style={[styles.exampleTitle, { color: theme.text }]}>Examples:</Text>
            <Text style={[styles.exampleText, { color: theme.textSecondary }]}>• "Pineapple belongs on pizza"</Text>
            <Text style={[styles.exampleText, { color: theme.textSecondary }]}>• "The book is always better than the movie"</Text>
            <Text style={[styles.exampleText, { color: theme.textSecondary }]}>• "Coffee is just dirty water"</Text>
          </View>
        </>
      ),
    },
    {
      title: "How to Vote 🗳️",
      content: (
        <>
          <View style={styles.voteSection}>
            <View style={styles.voteOption}>
              <Text style={styles.voteEmoji}>🔥</Text>
              <Text style={styles.voteLabel}>HOT</Text>
              <Text style={styles.voteDescription}>
                I AGREE with this take{'\n'}
                YES, this is true{'\n'}
                This opinion is VALID
              </Text>
            </View>

            <View style={styles.voteDivider} />

            <View style={styles.voteOption}>
              <Text style={styles.voteEmoji}>❄️</Text>
              <Text style={styles.voteLabel}>NOT</Text>
              <Text style={styles.voteDescription}>
                I DISAGREE with this take{'\n'}
                NO, this is wrong{'\n'}
                This opinion is TRASH
              </Text>
            </View>
          </View>

          <Text style={styles.footnote}>
            Remember: It's all about opinions - there's no right or wrong answer!
          </Text>
        </>
      ),
    },
    {
      title: "How to Play 🎮",
      content: (
        <>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionEmoji}>👆</Text>
            <Text style={styles.instructionText}>
              <Text style={styles.bold}>TAP</Text> the vote buttons at the bottom of each card
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <Text style={styles.instructionEmoji}>👉</Text>
            <Text style={styles.instructionText}>
              <Text style={styles.bold}>SWIPE RIGHT</Text> to vote 🔥 HOT (agree)
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <Text style={styles.instructionEmoji}>👈</Text>
            <Text style={styles.instructionText}>
              <Text style={styles.bold}>SWIPE LEFT</Text> to vote ❄️ NOT (disagree)
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <Text style={styles.instructionEmoji}>⬇️</Text>
            <Text style={styles.instructionText}>
              <Text style={styles.bold}>SWIPE DOWN</Text> to skip if you're unsure
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipText}>
              💡 Tip: You can change categories using the dropdown at the top!
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header} />

        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
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
    backgroundColor: '#F5F5F5',
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
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F8F8F8',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  voteOption: {
    flex: 1,
    alignItems: 'center',
  },
  voteEmoji: {
    fontSize: 50,
    marginBottom: 10,
  },
  voteLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  voteDescription: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    color: '#666',
  },
  voteDivider: {
    width: 1,
    backgroundColor: '#DDD',
    marginHorizontal: 15,
  },
  footnote: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    color: '#888',
    marginTop: 10,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
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
    color: '#555',
  },
  bold: {
    fontWeight: 'bold',
    color: '#333',
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