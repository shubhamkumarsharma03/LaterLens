import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Pressable } from 'react-native';
import { Inbox, Sparkles, PlusCircle } from 'lucide-react-native';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';

/**
 * Premium Empty State component for LaterLens
 */
export default function EmptyState({ 
  icon: Icon = Inbox, 
  title, 
  subtitle, 
  actionLabel, 
  onAction,
  illustration: Illustration 
}) {
  const { palette, isDark } = useTheme();
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -12,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconWrap, { transform: [{ translateY: floatAnim }] }]}>
        <View style={[styles.iconBg, { backgroundColor: isDark ? 'rgba(129,140,248,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <Icon size={48} color={palette.primary} strokeWidth={1.5} />
        </View>
        {Illustration && <Illustration />}
      </Animated.View>

      <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary, textAlign: 'center', marginTop: SPACING.md }]}>
        {title || "Nothing here yet"}
      </Text>
      
      <Text style={[TYPOGRAPHY.body, { color: palette.textSecondary, textAlign: 'center', marginTop: SPACING.xs, maxWidth: 280, lineHeight: 20 }]}>
        {subtitle || "Take a screenshot to automatically queue a new action and build your visual library."}
      </Text>

      {onAction && (
        <Pressable 
          style={({ pressed }) => [
            styles.actionBtn, 
            { backgroundColor: palette.primary, opacity: pressed ? 0.8 : 1 }
          ]} 
          onPress={onAction}
        >
          <Text style={[TYPOGRAPHY.buttonLabel, { color: '#FFF' }]}>{actionLabel || "Get Started"}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
    paddingHorizontal: SPACING.lg,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: SPACING.md,
  },
  iconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});
