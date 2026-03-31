/**
 * ActionCard — Premium card for the LaterLens Action Queue.
 *
 * Layout:
 *   ┌────────────────────────────────────┐
 *   │ [Thumbnail]  Category Badge        │
 *   │              AI Summary (2 lines)  │
 *   ├────────────────────────────────────┤
 *   │ [✓] [⏱] [📦]      [ Suggested  → ]│
 *   └────────────────────────────────────┘
 *
 * Responds to Light / Dark theme via useTheme().
 * Haptic feedback on quick-action taps via expo-haptics.
 */

import { useCallback, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Check, Clock, Archive, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../theme/colors';

// ─── Category Badge ──────────────────────────────────────────

function CategoryBadge({ contentType, theme }) {
  const badge = theme.getCategoryBadge(contentType);
  return (
    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
      <Text style={[TYPOGRAPHY.badgeLabel, { color: badge.text }]}>
        {contentType || 'Idea'}
      </Text>
    </View>
  );
}

// ─── Quick Action Icon Button ────────────────────────────────

function QuickActionButton({ icon: Icon, tint, bg, onPress, label }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.85, useNativeDriver: true, speed: 50, bounciness: 4 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }),
    ]).start();
    onPress?.();
  }, [onPress, scale]);

  return (
    <Pressable onPress={handlePress} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View style={[styles.quickAction, { backgroundColor: bg, transform: [{ scale }] }]}>
        <Icon size={16} color={tint} strokeWidth={2.4} />
      </Animated.View>
    </Pressable>
  );
}

// ─── Main ActionCard ─────────────────────────────────────────

export default function ActionCard({
  item,
  onPrimaryPress,
  onComplete,
  onSnooze,
  onArchive,
  onCardPress,
}) {
  const theme = useTheme();
  const { palette, isDark } = theme;

  // ── Swipe actions ──

  const renderRightActions = (_progress, dragX) => {
    const translateComplete = dragX.interpolate({
      inputRange: [-180, -90, 0],
      outputRange: [0, 0, 90],
      extrapolate: 'clamp',
    });
    const translateArchive = dragX.interpolate({
      inputRange: [-180, -90, 0],
      outputRange: [0, 45, 180],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.swipeContainer}>
        <Animated.View style={{ transform: [{ translateX: translateComplete }] }}>
          <Pressable
            style={[styles.swipeAction, { backgroundColor: palette.swipeComplete }]}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onComplete(item);
            }}
          >
            <Check size={20} color="#FFF" strokeWidth={2.6} />
            <Text style={styles.swipeLabel}>Done</Text>
          </Pressable>
        </Animated.View>
        <Animated.View style={{ transform: [{ translateX: translateArchive }] }}>
          <Pressable
            style={[styles.swipeAction, { backgroundColor: palette.swipeArchive }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onArchive(item);
            }}
          >
            <Archive size={18} color="#FFF" strokeWidth={2.2} />
            <Text style={styles.swipeLabel}>Archive</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  };

  // ── Render ──

  return (
    <Swipeable
      overshootRight={false}
      friction={2}
      rightThreshold={40}
      renderRightActions={renderRightActions}
    >
      <View style={[theme.cardStyle, styles.card]}>
        {/* ── Top Section ── */}
        <Pressable
          onPress={() => onCardPress?.(item)}
          accessibilityRole="button"
          accessibilityLabel="Open action details"
          style={({ pressed }) => [
            styles.topSection,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />

          <View style={styles.metaColumn}>
            <CategoryBadge contentType={item.contentType} theme={theme} />
            <Text
              style={[TYPOGRAPHY.bodyBold, { color: palette.textPrimary, marginTop: 6 }]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {item.summary}
            </Text>
            <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary, marginTop: 4 }]}>
              {formatRelativeTime(item.timestamp)}
            </Text>
          </View>
        </Pressable>

        {/* ── Divider ── */}
        <View style={[styles.divider, { backgroundColor: palette.border }]} />

        {/* ── Bottom Action Row ── */}
        <View style={styles.bottomSection}>
          <View style={styles.quickActions}>
            <QuickActionButton
              icon={Check}
              tint={palette.completeTint}
              bg={palette.completeBg}
              onPress={() => onComplete(item)}
              label="Complete action"
            />
            <QuickActionButton
              icon={Clock}
              tint={palette.snoozeTint}
              bg={palette.snoozeBg}
              onPress={() => onSnooze(item)}
              label="Snooze action"
            />
            <QuickActionButton
              icon={Archive}
              tint={palette.archiveTint}
              bg={palette.archiveBg}
              onPress={() => onArchive(item)}
              label="Archive action"
            />
          </View>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPrimaryPress(item);
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: palette.primary, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Text style={styles.primaryText} numberOfLines={1}>
              {item.suggestedAction}
            </Text>
            <ChevronRight size={14} color="#FFF" strokeWidth={2.8} />
          </Pressable>
        </View>
      </View>
    </Swipeable>
  );
}

// ─── Relative timestamp helper ────────────────────────────────

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },

  /* ── Top Section ── */
  topSection: {
    flexDirection: 'row',
    padding: SPACING.md,
    paddingBottom: SPACING.sm + 4,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    backgroundColor: '#E5E7EB',
    marginRight: SPACING.md,
  },
  metaColumn: {
    flex: 1,
    justifyContent: 'center',
  },

  /* ── Badge ── */
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: RADIUS.pill,
  },

  /* ── Divider ── */
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: SPACING.md,
  },

  /* ── Bottom Section ── */
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
  },
  quickActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  quickAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Primary CTA ── */
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    gap: 4,
    maxWidth: '48%',
  },
  primaryText: {
    ...TYPOGRAPHY.buttonLabel,
    color: '#FFFFFF',
    flexShrink: 1,
  },

  /* ── Swipe ── */
  swipeContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  swipeAction: {
    width: 82,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    marginLeft: SPACING.sm,
  },
  swipeLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.3,
  },
});
