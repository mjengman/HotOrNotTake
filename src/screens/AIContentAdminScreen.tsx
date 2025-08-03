import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { colors, dimensions } from '../constants';
import { 
  generateAndPreviewTakes, 
  autoSeedAITakes, 
  convertAITakeToSubmission 
} from '../services/aiContentService';
import { submitTake } from '../services/takeService';
import { useAuth } from '../hooks';

interface AIContentAdminScreenProps {
  onClose: () => void;
  isDarkMode: boolean;
}

interface AITakePreview {
  text: string;
  category: string;
  confidence: number;
  selected: boolean;
}

export const AIContentAdminScreen: React.FC<AIContentAdminScreenProps> = ({
  onClose,
  isDarkMode,
}) => {
  const [previews, setPreviews] = useState<AITakePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [seedCount, setSeedCount] = useState('5');
  const { user } = useAuth();
  
  const theme = isDarkMode ? colors.dark : colors.light;

  const handleGeneratePreview = async () => {
    setGenerating(true);
    try {
      const generated = await generateAndPreviewTakes(3);
      setPreviews(generated.map(take => ({
        ...take,
        selected: true, // Default to selected
      })));
    } catch (error) {
      Alert.alert(
        'Generation Failed',
        error instanceof Error ? error.message : 'Failed to generate AI content',
        [{ text: 'OK' }]
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleAutoSeed = async () => {
    const count = parseInt(seedCount) || 5;
    if (count < 1 || count > 20) {
      Alert.alert('Invalid Count', 'Please enter a number between 1 and 20');
      return;
    }

    Alert.alert(
      'Auto-Seed Database',
      `This will generate and submit ${count} AI takes directly to your database. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setLoading(true);
            try {
              const submitted = await autoSeedAITakes(count);
              Alert.alert(
                'Success!',
                `Generated and submitted ${submitted} AI takes to the database.`,
                [{ text: 'OK' }]
              );
            } catch (error) {
              Alert.alert(
                'Seeding Failed',
                error instanceof Error ? error.message : 'Failed to seed database',
                [{ text: 'OK' }]
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSubmitSelected = async () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in to submit takes');
      return;
    }

    const selectedPreviews = previews.filter(p => p.selected);
    if (selectedPreviews.length === 0) {
      Alert.alert('No Takes Selected', 'Please select at least one take to submit');
      return;
    }

    setSubmitting(true);
    try {
      let submitted = 0;
      for (const preview of selectedPreviews) {
        try {
          const submission = convertAITakeToSubmission(preview);
          await submitTake(submission, user.uid);
          submitted++;
        } catch (error) {
          console.error('Failed to submit take:', preview.text, error);
        }
      }

      Alert.alert(
        'Submission Complete',
        `Successfully submitted ${submitted}/${selectedPreviews.length} takes to the database.`,
        [{ text: 'OK', onPress: () => setPreviews([]) }]
      );
    } catch (error) {
      Alert.alert(
        'Submission Failed',
        error instanceof Error ? error.message : 'Failed to submit takes',
        [{ text: 'OK' }]
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTakeSelection = (index: number) => {
    setPreviews(prev => prev.map((take, i) => 
      i === index ? { ...take, selected: !take.selected } : take
    ));
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#4CAF50'; // Green
    if (confidence >= 0.6) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <Text style={[styles.title, { color: theme.text }]}>
          🤖 AI Content Admin
        </Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <Text style={[styles.closeButtonText, { color: theme.text }]}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Auto-Seed Section */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            🌱 Auto-Seed Database
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
            Automatically generate and submit AI takes to maintain content levels
          </Text>
          
          <View style={styles.seedControls}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Target Take Count:</Text>
            <TextInput
              style={[styles.seedInput, { 
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.border 
              }]}
              value={seedCount}
              onChangeText={setSeedCount}
              keyboardType="numeric"
              placeholder="5"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <TouchableOpacity
            style={[styles.seedButton, { backgroundColor: theme.primary }]}
            onPress={handleAutoSeed}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.seedButtonText}>🚀 Auto-Seed Now</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Manual Generation Section */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            ✨ Generate & Preview
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
            Generate AI takes for manual review and selective submission
          </Text>

          <TouchableOpacity
            style={[styles.generateButton, { backgroundColor: theme.secondary }]}
            onPress={handleGeneratePreview}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.generateButtonText}>🎲 Generate 3 Takes</Text>
            )}
          </TouchableOpacity>

          {/* Preview Section */}
          {previews.length > 0 && (
            <>
              <Text style={[styles.previewTitle, { color: theme.text }]}>
                Generated Takes (tap to toggle selection):
              </Text>
              
              {previews.map((preview, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.previewCard,
                    { 
                      backgroundColor: preview.selected ? theme.primaryLight : theme.background,
                      borderColor: preview.selected ? theme.primary : theme.border,
                    }
                  ]}
                  onPress={() => toggleTakeSelection(index)}
                >
                  <View style={styles.previewHeader}>
                    <Text style={[styles.previewCategory, { color: theme.primary }]}>
                      {preview.category.toUpperCase()}
                    </Text>
                    <View style={styles.confidenceContainer}>
                      <Text style={[styles.confidenceText, { color: getConfidenceColor(preview.confidence) }]}>
                        {Math.round(preview.confidence * 100)}%
                      </Text>
                      <Text style={[styles.selectionIndicator, { color: theme.text }]}>
                        {preview.selected ? '✅' : '⬜'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.previewText, { color: theme.text }]}>
                    "{preview.text}"
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: theme.success }]}
                onPress={handleSubmitSelected}
                disabled={submitting || previews.filter(p => p.selected).length === 0}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    📤 Submit Selected ({previews.filter(p => p.selected).length})
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Usage Instructions */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            📋 Usage Guide
          </Text>
          <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
            • <Text style={{ color: theme.text }}>Auto-Seed:</Text> Automatically maintains your database with fresh AI content{'\n'}
            • <Text style={{ color: theme.text }}>Generate & Preview:</Text> Review AI takes before submitting{'\n'}
            • <Text style={{ color: theme.text }}>Confidence Score:</Text> Higher scores indicate better quality content{'\n'}
            • <Text style={{ color: theme.text }}>Categories:</Text> AI generates takes across all 12 categories
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: dimensions.spacing.lg,
    paddingVertical: dimensions.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: dimensions.fontSize.xlarge,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: dimensions.spacing.sm,
  },
  closeButtonText: {
    fontSize: dimensions.fontSize.xlarge,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: dimensions.spacing.lg,
  },
  section: {
    marginBottom: dimensions.spacing.lg,
    padding: dimensions.spacing.lg,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: dimensions.fontSize.large,
    fontWeight: 'bold',
    marginBottom: dimensions.spacing.sm,
  },
  sectionDescription: {
    fontSize: dimensions.fontSize.medium,
    marginBottom: dimensions.spacing.lg,
    lineHeight: 20,
  },
  seedControls: {
    marginBottom: dimensions.spacing.lg,
  },
  inputLabel: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '600',
    marginBottom: dimensions.spacing.sm,
  },
  seedInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: dimensions.spacing.md,
    paddingVertical: dimensions.spacing.sm,
    fontSize: dimensions.fontSize.medium,
  },
  seedButton: {
    paddingVertical: dimensions.spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  seedButtonText: {
    color: '#FFFFFF',
    fontSize: dimensions.fontSize.medium,
    fontWeight: 'bold',
  },
  generateButton: {
    paddingVertical: dimensions.spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: dimensions.spacing.lg,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: dimensions.fontSize.medium,
    fontWeight: 'bold',
  },
  previewTitle: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '600',
    marginBottom: dimensions.spacing.md,
  },
  previewCard: {
    padding: dimensions.spacing.md,
    borderRadius: 8,
    marginBottom: dimensions.spacing.sm,
    borderWidth: 2,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: dimensions.spacing.sm,
  },
  previewCategory: {
    fontSize: dimensions.fontSize.small,
    fontWeight: 'bold',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceText: {
    fontSize: dimensions.fontSize.small,
    fontWeight: 'bold',
    marginRight: dimensions.spacing.sm,
  },
  selectionIndicator: {
    fontSize: dimensions.fontSize.medium,
  },
  previewText: {
    fontSize: dimensions.fontSize.medium,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  submitButton: {
    paddingVertical: dimensions.spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: dimensions.spacing.md,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: dimensions.fontSize.medium,
    fontWeight: 'bold',
  },
  instructionText: {
    fontSize: dimensions.fontSize.medium,
    lineHeight: 22,
  },
});