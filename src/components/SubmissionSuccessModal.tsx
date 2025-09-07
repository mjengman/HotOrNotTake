import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants';

interface SubmissionSuccessModalProps {
  visible: boolean;
  onSubmitAnother: () => void;
  onDone: () => void;
  isDarkMode?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

export const SubmissionSuccessModal: React.FC<SubmissionSuccessModalProps> = ({
  visible,
  onSubmitAnother,
  onDone,
  isDarkMode = false,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      rotateAnim.setValue(0);
      fadeAnim.setValue(0);

      // Start animations
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 400,
            delay: 200,
            useNativeDriver: true,
          }),
          Animated.spring(rotateAnim, {
            toValue: 0,
            tension: 100,
            friction: 5,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [visible]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const theme = isDarkMode ? colors.dark : colors.light;

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
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            }
          ]}
        >
          <LinearGradient
            colors={['#FF6B6B', '#FF8B8B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientContainer}
          >
            {/* Success Icon */}
            <Animated.View 
              style={[
                styles.iconContainer,
                { transform: [{ rotate: spin }] }
              ]}
            >
              <Text style={styles.successIcon}>🔥</Text>
            </Animated.View>

            {/* Title */}
            <Text style={styles.title}>TAKE SUBMITTED!</Text>
            
            {/* Subtitle */}
            <Text style={styles.subtitle}>
              Your hot take is now LIVE!
            </Text>

            {/* Stats Preview */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>❄️</Text>
                <Text style={styles.statLabel}>NOT</Text>
                <Text style={styles.statValue}>0</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>🔥</Text>
                <Text style={styles.statLabel}>HOT</Text>
                <Text style={styles.statValue}>0</Text>
              </View>
            </View>

            {/* Motivational Text */}
            <Text style={styles.motivationalText}>
              Let's see if the world can handle it!
            </Text>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={onSubmitAnother}
                activeOpacity={0.8}
              >
                <Text 
                  style={styles.secondaryButtonText}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.8}
                >
                  More To Say? 🚀
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={onDone}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
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
    width: screenWidth * 0.9,
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  gradientContainer: {
    padding: 30,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  successIcon: {
    fontSize: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.95,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 30,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '800',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 20,
  },
  motivationalText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 25,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '700',
  },
});