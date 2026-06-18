import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { colors, motion } from '../constants';
import { AnimatedPressable } from './transitions/AnimatedPressable';

interface SubmissionSuccessModalProps {
  visible: boolean;
  onSubmitAnother: () => void;
  onDone: () => void;
  isDarkMode?: boolean;
}

export const SubmissionSuccessModal: React.FC<SubmissionSuccessModalProps> = ({
  visible,
  onSubmitAnother,
  onDone,
  isDarkMode = false,
}) => {
  const { width } = useWindowDimensions();
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.96);
      fadeAnim.setValue(0);

      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const theme = isDarkMode ? colors.dark : colors.light;
  const successSoft = isDarkMode ? 'rgba(46, 213, 115, 0.14)' : '#E9FAEF';
  const successBorder = isDarkMode ? 'rgba(46, 213, 115, 0.38)' : '#A9ECC2';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              width: Math.min(width * 0.9, 400),
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            }
          ]}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: successSoft,
                  borderColor: successBorder,
                },
              ]}
            >
              <Text style={[styles.successIcon, { color: theme.success }]}>✓</Text>
            </View>

            <Text style={[styles.title, { color: theme.text }]}>Take submitted</Text>

            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              We'll review it before it joins the voting queue.
            </Text>

            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: successSoft,
                  borderColor: successBorder,
                },
              ]}
            >
              <Text style={[styles.statusText, { color: theme.success }]}>
                Success
              </Text>
            </View>

            <Text style={[styles.helperText, { color: theme.textSecondary }]}>
              Thanks for helping keep the room interesting.
            </Text>

            <View style={styles.buttonContainer}>
              <AnimatedPressable
                style={[
                  styles.button,
                  styles.secondaryButton,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F4F4F6',
                    borderColor: theme.border,
                  },
                ]}
                onPress={onSubmitAnother}
                scaleValue={0.97}
                hapticFeedback={false}
              >
                <Text
                  style={[styles.secondaryButtonText, { color: theme.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.8}
                >
                  Submit another
                </Text>
              </AnimatedPressable>
              
              <AnimatedPressable
                style={[styles.button, styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={onDone}
                scaleValue={0.97}
                hapticFeedback={false}
              >
                <Text style={styles.primaryButtonText}>Done</Text>
              </AnimatedPressable>
            </View>
          </View>
        </Animated.View>
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
  },
  modalContainer: {
    maxWidth: 400,
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  card: {
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
  },
  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successIcon: {
    fontSize: 32,
    fontWeight: '900',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 23,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '800',
  },
  helperText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 13,
    minHeight: motion.touchTarget.minimum,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
  },
  primaryButton: {
    shadowColor: '#FF4757',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
