import React from 'react';
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AnimatedPressable } from '../components/transitions/AnimatedPressable';
import { colors, dimensions, motion } from '../constants';

interface SafetyStandardsScreenProps {
  onClose: () => void;
  isDarkMode?: boolean;
}

const CHILD_SAFETY_EMAIL = 'engmanlabs@gmail.com';
const CHILD_SAFETY_URL = 'https://hot-or-not-takes.web.app/child-safety/';

const openLink = async (url: string) => {
  try {
    if (url.startsWith('mailto:')) {
      await Linking.openURL(url);
      return;
    }

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      throw new Error(`Cannot open URL: ${url}`);
    }
    await Linking.openURL(url);
  } catch (error) {
    console.error('Unable to open safety link:', error);
    Alert.alert('Unable to open link', 'Please try again or email engmanlabs@gmail.com directly.');
  }
};

export const SafetyStandardsScreen: React.FC<SafetyStandardsScreenProps> = ({
  onClose,
  isDarkMode = false,
}) => {
  const theme = isDarkMode ? colors.dark : colors.light;

  const handleEmailSafety = () => {
    const subject = encodeURIComponent('Hot or Not Takes Child Safety Report');
    const body = encodeURIComponent(
      'Please describe the child safety concern, CSAE/CSAM concern, or inappropriate take you are reporting.'
    );
    openLink(`mailto:${CHILD_SAFETY_EMAIL}?subject=${subject}&body=${body}`);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <AnimatedPressable
          style={[styles.closeButton, { backgroundColor: theme.surface }]}
          onPress={onClose}
          scaleValue={0.9}
          hapticIntensity={motion.haptic.light}
          accessibilityRole="button"
          accessibilityLabel="Close safety and reporting screen"
        >
          <Text style={[styles.closeButtonText, { color: theme.text }]}>x</Text>
        </AnimatedPressable>
        <Text
          style={[styles.title, { color: theme.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          Safety & Reporting
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.notice, { backgroundColor: theme.primaryLight, borderColor: theme.primary + '55' }]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>
            Hot or Not Takes by FireThink Studios
          </Text>
          <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
            We have zero tolerance for child sexual abuse and exploitation (CSAE), child sexual abuse material (CSAM), grooming, sextortion, or any behavior that sexualizes, exploits, or endangers minors.
          </Text>
        </View>

        <Section title="How to report" theme={theme}>
          <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
            Use the Report button on any take to flag inappropriate content. For child safety, CSAE, or CSAM concerns, contact our child safety point of contact directly.
          </Text>
          <AnimatedPressable
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={handleEmailSafety}
            scaleValue={0.98}
            hapticIntensity={motion.haptic.selection}
            accessibilityRole="button"
            accessibilityLabel="Email the Hot or Not Takes child safety contact"
          >
            <Text style={styles.primaryButtonText}>Email Child Safety Contact</Text>
          </AnimatedPressable>
          <Text style={[styles.contactText, { color: theme.textSecondary }]}>
            {CHILD_SAFETY_EMAIL}
          </Text>
        </Section>

        <Section title="Prohibited content" theme={theme}>
          <Bullet text="Any form of child sexual abuse material (CSAM)." theme={theme} />
          <Bullet text="Child sexual abuse and exploitation (CSAE)." theme={theme} />
          <Bullet text="Content that sexualizes, grooms, exploits, sextorts, or endangers minors." theme={theme} />
          <Bullet text="Soliciting, promoting, sharing, or attempting to exchange CSAM or CSAE-related content." theme={theme} />
          <Bullet text="Harassment, threats, personal attacks, or sharing personal information." theme={theme} />
        </Section>

        <Section title="Our response" theme={theme}>
          <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
            User-submitted takes are moderated before appearing in the voting queue. Reports are reviewed promptly, violating content is removed, and suspected CSAM is reported to the National Center for Missing & Exploited Children (NCMEC) or other appropriate authorities as required by law.
          </Text>
        </Section>

        <Section title="Published standards" theme={theme}>
          <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
            Our full Child Safety Standards are publicly available and reference Hot or Not Takes and FireThink Studios.
          </Text>
          <AnimatedPressable
            style={[styles.secondaryButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => openLink(CHILD_SAFETY_URL)}
            scaleValue={0.98}
            hapticIntensity={motion.haptic.light}
            accessibilityRole="button"
            accessibilityLabel="Open published child safety standards"
          >
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Open Published Standards</Text>
          </AnimatedPressable>
          <Text style={[styles.urlText, { color: theme.textSecondary }]}>
            {CHILD_SAFETY_URL}
          </Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
};

const Section: React.FC<{
  title: string;
  theme: typeof colors.light;
  children: React.ReactNode;
}> = ({ title, theme, children }) => (
  <View style={styles.section}>
    <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
    {children}
  </View>
);

const Bullet: React.FC<{
  text: string;
  theme: typeof colors.light;
}> = ({ text, theme }) => (
  <View style={styles.bulletRow}>
    <Text style={[styles.bulletDot, { color: theme.primary }]}>•</Text>
    <Text style={[styles.bulletText, { color: theme.textSecondary }]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: dimensions.spacing.lg,
    paddingVertical: dimensions.spacing.md,
  },
  closeButton: {
    width: motion.touchTarget.minimum,
    height: motion.touchTarget.minimum,
    borderRadius: motion.touchTarget.minimum / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: '700',
  },
  title: {
    flex: 1,
    marginHorizontal: dimensions.spacing.md,
    fontSize: dimensions.fontSize.xlarge,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSpacer: {
    width: motion.touchTarget.minimum,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: dimensions.spacing.lg,
    paddingBottom: dimensions.spacing.xxl,
  },
  notice: {
    borderWidth: 1,
    borderRadius: 14,
    padding: dimensions.spacing.lg,
    marginBottom: dimensions.spacing.xl,
  },
  noticeTitle: {
    fontSize: dimensions.fontSize.large,
    fontWeight: '800',
    marginBottom: dimensions.spacing.sm,
  },
  noticeText: {
    fontSize: dimensions.fontSize.medium,
    lineHeight: 23,
  },
  section: {
    marginBottom: dimensions.spacing.xl,
  },
  sectionTitle: {
    fontSize: dimensions.fontSize.large,
    fontWeight: '800',
    marginBottom: dimensions.spacing.sm,
  },
  bodyText: {
    fontSize: dimensions.fontSize.medium,
    lineHeight: 23,
    marginBottom: dimensions.spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: dimensions.spacing.sm,
  },
  bulletDot: {
    fontSize: dimensions.fontSize.large,
    fontWeight: '800',
    marginRight: dimensions.spacing.sm,
    lineHeight: 23,
  },
  bulletText: {
    flex: 1,
    fontSize: dimensions.fontSize.medium,
    lineHeight: 23,
  },
  primaryButton: {
    minHeight: motion.touchTarget.comfortable,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: dimensions.spacing.lg,
    paddingVertical: dimensions.spacing.md,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: dimensions.fontSize.medium,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: motion.touchTarget.comfortable,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: dimensions.spacing.lg,
    paddingVertical: dimensions.spacing.md,
  },
  secondaryButtonText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '800',
  },
  contactText: {
    marginTop: dimensions.spacing.sm,
    fontSize: dimensions.fontSize.small,
    textAlign: 'center',
    fontWeight: '600',
  },
  urlText: {
    marginTop: dimensions.spacing.sm,
    fontSize: dimensions.fontSize.small,
    textAlign: 'center',
  },
});
