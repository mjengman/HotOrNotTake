import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, dimensions } from '../constants';

interface AdConsentModalProps {
  isDarkMode: boolean;
}

const CONSENT_KEY = 'ad_consent_given';

export const AdConsentModal: React.FC<AdConsentModalProps> = ({ isDarkMode }) => {
  const [showModal, setShowModal] = useState(false);
  const theme = isDarkMode ? colors.dark : colors.light;

  useEffect(() => {
    checkConsentStatus();
  }, []);

  const checkConsentStatus = async () => {
    try {
      const consent = await AsyncStorage.getItem(CONSENT_KEY);
      if (!consent) {
        // Small delay to let the app load first
        setTimeout(() => setShowModal(true), 2000);
      }
    } catch (error) {
      console.error('Error checking consent status:', error);
    }
  };

  const handleAcceptAll = async () => {
    try {
      await AsyncStorage.setItem(CONSENT_KEY, 'accepted');
      setShowModal(false);
      console.log('📝 User accepted personalized ads');
    } catch (error) {
      console.error('Error saving consent:', error);
    }
  };

  const handleAcceptLimited = async () => {
    try {
      await AsyncStorage.setItem(CONSENT_KEY, 'limited');
      setShowModal(false);
      console.log('📝 User accepted limited ads only');
    } catch (error) {
      console.error('Error saving consent:', error);
    }
  };

  const handleLearnMore = () => {
    Alert.alert(
      'About Ads',
      'We show ads to keep this app free. Personalized ads are more relevant to you and help us earn more to improve the app. Non-personalized ads are still effective but less targeted.\n\nYou can change your preference anytime in the app settings.',
      [{ text: 'Got it', style: 'default' }]
    );
  };

  if (!showModal) return null;

  return (
    <Modal
      visible={showModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}} // Prevent dismissing without choice
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.title, { color: theme.text }]}>
              🎯 Privacy & Ads
            </Text>
            
            <Text style={[styles.description, { color: theme.text }]}>
              Hot or Not Takes is free thanks to ads. We'd like to show you personalized ads that are more relevant to your interests.
            </Text>

            <View style={[styles.infoBox, { backgroundColor: theme.background }]}>
              <Text style={[styles.infoTitle, { color: theme.primary }]}>
                ✨ Personalized Ads:
              </Text>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                • More relevant to your interests{'\n'}
                • Help us earn more to improve the app{'\n'}
                • Uses your device advertising ID
              </Text>
            </View>

            <View style={[styles.infoBox, { backgroundColor: theme.background }]}>
              <Text style={[styles.infoTitle, { color: theme.secondary }]}>
                🔒 Limited Ads:
              </Text>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                • Less personalized but still effective{'\n'}
                • Better privacy protection{'\n'}
                • No advertising ID usage
              </Text>
            </View>

            <TouchableOpacity
              style={styles.learnMoreButton}
              onPress={handleLearnMore}
            >
              <Text style={[styles.learnMoreText, { color: theme.primary }]}>
                Learn more about our ads →
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.acceptButton, { backgroundColor: theme.primary }]}
              onPress={handleAcceptAll}
            >
              <Text style={styles.acceptButtonText}>
                Accept Personalized
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.limitedButton, { 
                backgroundColor: 'transparent',
                borderColor: theme.border,
                borderWidth: 1,
              }]}
              onPress={handleAcceptLimited}
            >
              <Text style={[styles.limitedButtonText, { color: theme.text }]}>
                Limited Ads Only
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: dimensions.spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: dimensions.spacing.xl,
    maxHeight: '80%',
  },
  title: {
    fontSize: dimensions.fontSize.xxlarge,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: dimensions.spacing.lg,
  },
  description: {
    fontSize: dimensions.fontSize.medium,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: dimensions.spacing.lg,
  },
  infoBox: {
    padding: dimensions.spacing.md,
    borderRadius: 8,
    marginBottom: dimensions.spacing.md,
  },
  infoTitle: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: 'bold',
    marginBottom: dimensions.spacing.xs,
  },
  infoText: {
    fontSize: dimensions.fontSize.small,
    lineHeight: 18,
  },
  learnMoreButton: {
    alignSelf: 'center',
    paddingVertical: dimensions.spacing.sm,
    marginBottom: dimensions.spacing.lg,
  },
  learnMoreText: {
    fontSize: dimensions.fontSize.small,
    fontWeight: '600',
  },
  buttonContainer: {
    gap: dimensions.spacing.sm,
  },
  acceptButton: {
    paddingVertical: dimensions.spacing.md + 2,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: dimensions.fontSize.medium,
    fontWeight: 'bold',
  },
  limitedButton: {
    paddingVertical: dimensions.spacing.md + 2,
    borderRadius: 12,
    alignItems: 'center',
  },
  limitedButtonText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '600',
  },
});