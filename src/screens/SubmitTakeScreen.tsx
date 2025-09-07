import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ScrollView as GHScrollView, NativeViewGestureHandler } from 'react-native-gesture-handler';
import { useAuth, useFirebaseTakes } from '../hooks';
import { colors, dimensions } from '../constants';
import { TakeCard } from '../components/TakeCard';
import { SubmissionSuccessModal } from '../components/SubmissionSuccessModal';
import { Take } from '../types';

const CATEGORIES = [
  'food', 'work', 'pets', 'technology', 'life', 'entertainment', 'environment',
  'wellness', 'society', 'politics', 'sports', 'travel', 'relationships',
] as const;

const MIN_LENGTH = 10;
const MAX_LENGTH = 150;
const OVERFLOW_SLACK = 50; // Allow users to paste then trim

interface SubmitTakeScreenProps {
  onClose: () => void;
  onSuccess?: () => void; // Called when take is successfully submitted
  isDarkMode?: boolean;
}

export const SubmitTakeScreen: React.FC<SubmitTakeScreenProps> = ({
  onClose,
  onSuccess,
  isDarkMode = false,
}) => {
  const { user } = useAuth();
  const { submitNewTake } = useFirebaseTakes();
  const textInputRef = useRef<TextInput>(null);
  const scrollRef = useRef(null);
  const inputGRef = useRef(null);
  
  const [text, setText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const theme = isDarkMode ? colors.dark : colors.light;
  
  const isValidText = text.length >= MIN_LENGTH && text.length <= MAX_LENGTH;
  const isValidCategory = selectedCategory !== '';
  const canSubmit = isValidText && isValidCategory && !isSubmitting;
  
  const characterCount = text.length;
  const isNearLimit = characterCount > MAX_LENGTH * 0.8;
  const isOverLimit = characterCount > MAX_LENGTH;

  const previewTake: Take = useMemo(
    () => ({
      id: 'preview',
      text,
      category: selectedCategory,
      hotVotes: 0,
      notVotes: 0,
      totalVotes: 0,
      createdAt: new Date(),
      userId: user?.uid || '',
      isApproved: false,
      status: 'pending',
      submittedAt: new Date(),
      reportCount: 0,
      isAIGenerated: false,
    }),
    [text, selectedCategory, user?.uid]
  );

  const handleSubmitAnother = () => {
    setText('');
    setSelectedCategory('');
    setShowPreview(false);
    setModerationError(null);
    setShowSuccessModal(false);
  };

  const handleDone = () => {
    setShowSuccessModal(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;

    try {
      setIsSubmitting(true);
      setModerationError(null); // Clear any previous error
      
      await submitNewTake({
        text: text.trim(),
        category: selectedCategory,
      });

      // Notify parent about successful submission
      onSuccess?.();

      // Show success modal
      setShowSuccessModal(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Submission error:', error);
      console.log(`🔍 Error message: "${errorMessage}"`);
      
      // Check if this is a moderation rejection
      if (errorMessage.startsWith('Your take was not approved:')) {
        const reason = errorMessage.replace('Your take was not approved: ', '');
        console.log(`🔍 Setting moderation error: "${reason}"`);
        setModerationError(reason);
      } else {
        console.log(`🔍 Not a moderation error, showing alert`);
        // General error - show alert
        Alert.alert(
          'Submission Failed',
          'There was an error submitting your take. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {(() => {
          const ScrollComponent = Platform.OS === 'android' ? GHScrollView : ScrollView;
          return (
            <ScrollComponent
              ref={Platform.OS === 'android' ? scrollRef : undefined}
              style={styles.scrollView} 
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              nestedScrollEnabled={true}
            >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.surface }]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close submit take screen"
            >
              <Text style={[styles.closeButtonText, { color: theme.text }]}>✕</Text>
            </TouchableOpacity>
            
            <Text style={[styles.title, { color: theme.text }]}>
              Submit a Hot Take
            </Text>
            
            <TouchableOpacity
              style={[styles.previewButton, { backgroundColor: theme.surface }]}
              onPress={() => setShowPreview(!showPreview)}
              disabled={!isValidText || !isValidCategory}
              accessibilityRole="button"
              accessibilityLabel={showPreview ? 'Switch to edit mode' : 'Preview your take'}
            >
              <Text style={[
                styles.previewButtonText, 
                { color: isValidText && isValidCategory ? theme.primary : theme.textSecondary }
              ]}>
                {showPreview ? 'Edit' : 'Preview'}
              </Text>
            </TouchableOpacity>
          </View>

          {showPreview && isValidText && isValidCategory ? (
            /* Preview Mode */
            <View style={styles.previewSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Preview
              </Text>
              <View style={styles.previewContainer}>
                <TakeCard take={previewTake} isDarkMode={isDarkMode} />
              </View>
            </View>
          ) : (
            /* Form Mode */
            <>
              {/* Guidelines */}
              <View style={styles.guidelines}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Guidelines
                </Text>
                <View style={styles.guidelinesList}>
                  <Text style={[styles.guideline, { color: theme.textSecondary }]}>
                    • Share a genuine opinion or belief
                  </Text>
                  <Text style={[styles.guideline, { color: theme.textSecondary }]}>
                    • Be respectful and constructive
                  </Text>
                  <Text style={[styles.guideline, { color: theme.textSecondary }]}>
                    • Avoid personal attacks or hate speech
                  </Text>
                  <Text style={[styles.guideline, { color: theme.textSecondary }]}>
                    • Make it debatable and engaging
                  </Text>
                </View>
              </View>

              {/* Text Input */}
              <View style={styles.inputSection}>
                {moderationError && (
                  <View style={styles.errorContainer}>
                    <Text style={[styles.errorText, { color: theme.error }]}>
                      ❌ {moderationError}
                    </Text>
                    <Text style={[styles.errorHint, { color: theme.textSecondary }]}>
                      Please revise your take and try again
                    </Text>
                  </View>
                )}
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Your Hot Take
                </Text>
                {Platform.OS === 'android' ? (
                  // Android-specific wrapper with NativeViewGestureHandler
                  <View
                    pointerEvents="box-none"
                    style={{
                      borderWidth: 1,
                      borderRadius: 12,
                      borderColor: isOverLimit ? theme.error : theme.border,
                      backgroundColor: theme.surface,
                    }}
                  >
                    <NativeViewGestureHandler
                      ref={inputGRef}
                      disallowInterruption
                      simultaneousHandlers={scrollRef}
                    >
                      <TextInput
                        ref={textInputRef}
                        style={[
                          styles.textInput,
                          {
                            backgroundColor: theme.surface,
                            color: theme.text,
                            borderWidth: 0, // Remove border since wrapper has it
                            textAlign: 'left',
                          },
                        ]}
                        placeholder="What's your controversial opinion?"
                        placeholderTextColor={theme.textSecondary}
                        value={text}
                        onChangeText={(newText) => {
                          setText(newText);
                          if (moderationError) {
                            setModerationError(null);
                          }
                        }}
                        multiline
                        textAlignVertical="top"
                        maxLength={MAX_LENGTH + OVERFLOW_SLACK}
                        numberOfLines={5}
                        scrollEnabled={true}
                        disableFullscreenUI={true}
                        underlineColorAndroid="transparent"
                        importantForAutofill="no"
                        selectTextOnFocus={false}
                        autoCapitalize="sentences"
                        autoCorrect={true}
                        selectionColor={theme.primary}
                        accessibilityLabel="Enter your hot take"
                        accessibilityHint="Type your controversial opinion here, minimum 10 characters"
                        // No touch handlers needed - RNGH handles it all
                      />
                    </NativeViewGestureHandler>
                  </View>
                ) : (
                  // iOS - works fine without wrapper
                  <TextInput
                    ref={textInputRef}
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.surface,
                        color: theme.text,
                        borderColor: isOverLimit ? theme.error : theme.border,
                      },
                    ]}
                    placeholder="What's your controversial opinion?"
                    placeholderTextColor={theme.textSecondary}
                    value={text}
                    onChangeText={(newText) => {
                      setText(newText);
                      if (moderationError) {
                        setModerationError(null);
                      }
                    }}
                    multiline
                    textAlignVertical="top"
                    maxLength={MAX_LENGTH + OVERFLOW_SLACK}
                    accessibilityLabel="Enter your hot take"
                    accessibilityHint="Type your controversial opinion here, minimum 10 characters"
                  />
                )}
                <View style={styles.textInputFooter}>
                  <Text style={[
                    styles.characterCount,
                    {
                      color: isOverLimit
                        ? theme.error
                        : isNearLimit
                        ? theme.accent
                        : theme.textSecondary,
                    },
                  ]}>
                    {characterCount}/{MAX_LENGTH}
                  </Text>
                  {!isValidText && (
                    <Text style={[styles.validationHint, { color: theme.textSecondary }]}>
                      {characterCount < MIN_LENGTH
                        ? `${MIN_LENGTH - characterCount} more characters needed`
                        : 'Too long! Please shorten your take'
                      }
                    </Text>
                  )}
                </View>
              </View>

              {/* Category Selection */}
              <View style={styles.categorySection}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Category
                </Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        {
                          backgroundColor: selectedCategory === category
                            ? theme.primary
                            : theme.surface,
                          borderColor: selectedCategory === category
                            ? theme.primary
                            : theme.border,
                        },
                      ]}
                      onPress={() => setSelectedCategory(category)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${category} category`}
                      accessibilityState={{ selected: selectedCategory === category }}
                    >
                      <Text
                        style={[
                          styles.categoryButtonText,
                          {
                            color: selectedCategory === category
                              ? '#FFFFFF'
                              : theme.text,
                          },
                        ]}
                      >
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* Submit Button */}
          <View style={styles.submitSection}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: canSubmit ? theme.primary : theme.surface,
                  opacity: canSubmit ? 1 : 0.6,
                },
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel={isSubmitting ? 'Submitting your take' : 'Submit your hot take'}
              accessibilityState={{ disabled: !canSubmit }}
            >
              <Text style={[
                styles.submitButtonText,
                { color: canSubmit ? '#FFFFFF' : theme.textSecondary },
              ]}>
                {isSubmitting ? 'Submitting...' : 'Submit Hot Take'}
              </Text>
            </TouchableOpacity>
            
            <Text style={[styles.submitNote, { color: theme.textSecondary }]}>
              Your take will appear immediately in the voting queue
            </Text>
          </View>
            </ScrollComponent>
          );
        })()}
      </KeyboardAvoidingView>
      
      {/* Success Modal */}
      <SubmissionSuccessModal
        visible={showSuccessModal}
        onSubmitAnother={handleSubmitAnother}
        onDone={handleDone}
        isDarkMode={isDarkMode}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: dimensions.spacing.lg,
    paddingVertical: dimensions.spacing.md,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  title: {
    fontSize: dimensions.fontSize.xlarge,
    fontWeight: 'bold',
  },
  previewButton: {
    paddingHorizontal: dimensions.spacing.md,
    paddingVertical: dimensions.spacing.sm,
    borderRadius: 8,
  },
  previewButtonText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '600',
  },
  previewSection: {
    paddingHorizontal: dimensions.spacing.lg,
    marginBottom: dimensions.spacing.lg,
  },
  previewContainer: {
    alignItems: 'center',
    marginTop: dimensions.spacing.md,
  },
  guidelines: {
    paddingHorizontal: dimensions.spacing.lg,
    marginBottom: dimensions.spacing.lg,
  },
  sectionTitle: {
    fontSize: dimensions.fontSize.large,
    fontWeight: 'bold',
    marginBottom: dimensions.spacing.md,
  },
  guidelinesList: {
    gap: dimensions.spacing.sm,
  },
  guideline: {
    fontSize: dimensions.fontSize.medium,
    lineHeight: 22,
  },
  inputSection: {
    paddingHorizontal: dimensions.spacing.lg,
    marginBottom: dimensions.spacing.lg,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 0, 0.3)',
    borderRadius: 8,
    padding: dimensions.spacing.md,
    marginBottom: dimensions.spacing.md,
  },
  errorText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '600',
    marginBottom: dimensions.spacing.xs,
  },
  errorHint: {
    fontSize: dimensions.fontSize.small,
    fontStyle: 'italic',
  },
  textInput: {
    height: 120,
    borderWidth: 1,
    borderRadius: 12,
    padding: dimensions.spacing.md,
    fontSize: dimensions.fontSize.medium,
    lineHeight: 22,
  },
  textInputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: dimensions.spacing.sm,
  },
  characterCount: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '600',
  },
  validationHint: {
    fontSize: dimensions.fontSize.small,
    fontStyle: 'italic',
  },
  categorySection: {
    paddingHorizontal: dimensions.spacing.lg,
    marginBottom: dimensions.spacing.lg,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: dimensions.spacing.sm,
  },
  categoryButton: {
    paddingHorizontal: dimensions.spacing.md,
    paddingVertical: dimensions.spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryButtonText: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '600',
  },
  submitSection: {
    paddingHorizontal: dimensions.spacing.lg,
    paddingBottom: dimensions.spacing.xxl,
  },
  submitButton: {
    paddingVertical: dimensions.spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: dimensions.spacing.md,
  },
  submitButtonText: {
    fontSize: dimensions.fontSize.large,
    fontWeight: 'bold',
  },
  submitNote: {
    fontSize: dimensions.fontSize.small,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});