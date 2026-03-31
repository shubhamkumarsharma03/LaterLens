/**
 * PermissionsScreen — LaterLens Onboarding
 *
 * A beautiful, centered full-screen layout with a glowing
 * camera icon, welcoming copy, and a full-width CTA button.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';

// ─── Pulsing Glow Ring ───────────────────────────────────────

function GlowingIcon({ palette, isDark }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.12,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 0.45,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.25,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, glow]);

  return (
    <View style={styles.iconWrapper}>
      {/* Outer glow ring */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            backgroundColor: isDark
              ? 'rgba(129,140,248,0.10)'
              : 'rgba(99,102,241,0.06)',
            transform: [{ scale: pulse }],
            opacity: glow,
          },
        ]}
      />
      {/* Inner glow ring */}
      <Animated.View
        style={[
          styles.innerGlowRing,
          {
            backgroundColor: isDark
              ? 'rgba(129,140,248,0.15)'
              : 'rgba(99,102,241,0.10)',
            transform: [{ scale: pulse }],
          },
        ]}
      />
      {/* Icon container */}
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: isDark
              ? 'rgba(129,140,248,0.18)'
              : 'rgba(99,102,241,0.10)',
          },
        ]}
      >
        <Camera
          size={44}
          color={palette.primary}
          strokeWidth={1.8}
        />
      </View>
    </View>
  );
}

// ─── PermissionsScreen ───────────────────────────────────────

export default function PermissionsScreen({ onAllow }) {
  const { palette, isDark } = useTheme();
  const btnScale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 50 }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start(() => onAllow?.());
  }, [onAllow, btnScale]);

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* ── Visual ── */}
      <View style={styles.heroArea}>
        <GlowingIcon palette={palette} isDark={isDark} />

        <Text
          style={[
            TYPOGRAPHY.heroTitle,
            styles.heading,
            { color: palette.textPrimary },
          ]}
        >
          LaterLens Needs{'\n'}Your Eyes.
        </Text>

        <Text
          style={[
            TYPOGRAPHY.body,
            styles.subtext,
            { color: palette.textSecondary },
          ]}
        >
          To magically organize your screenshots, please grant access to your
          photo library. We process everything securely on your device.
        </Text>
      </View>

      {/* ── CTA ── */}
      <View style={styles.ctaArea}>
        {/* Subtle trust badge */}
        <View style={styles.trustRow}>
          <View
            style={[
              styles.trustDot,
              { backgroundColor: isDark ? '#34D399' : '#059669' },
            ]}
          />
          <Text
            style={[
              TYPOGRAPHY.tiny,
              { color: palette.textSecondary },
            ]}
          >
            100% on-device processing · Your data never leaves your phone
          </Text>
        </View>

        <Pressable onPress={handlePress} accessibilityRole="button">
          <Animated.View
            style={[
              styles.ctaButton,
              { backgroundColor: palette.primary, transform: [{ scale: btnScale }] },
            ]}
          >
            <Text style={[TYPOGRAPHY.buttonLabel, styles.ctaText]}>
              Allow Photo Access
            </Text>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxxl + SPACING.xl,
    paddingBottom: SPACING.xxl,
  },

  /* ── Hero ── */
  heroArea: {
    alignItems: 'center',
  },
  iconWrapper: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  glowRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  innerGlowRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  subtext: {
    textAlign: 'center',
    paddingHorizontal: SPACING.sm,
    maxWidth: 340,
  },

  /* ── CTA ── */
  ctaArea: {
    gap: SPACING.md,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  trustDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ctaButton: {
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
