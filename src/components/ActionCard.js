/**
 * ActionCard — Premium card for the LaterLens Action Queue.
 *
 * Design spec features:
 *   - 56×56px rounded thumbnail (upgraded from 42px per suggestion)
 *   - Category pill with semantic color mapping
 *   - Urgency badge (amber warnings, red for expiring)
 *   - Deep action button (context-aware CTA)
 *   - Swipe right = complete (green tick reveal)
 *   - Swipe left = snooze options
 *   - Relative timestamp label
 *   - Haptic feedback on all interactions
 *   - Text Detect button with 4-state OCR pipeline feedback
 */

import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import {
  Check,
  Clock,
  Archive,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  ShoppingCart,
  BookOpen,
  Lightbulb,
  MapPin,
  Calendar,
  User,
  Tag,
  ScanText,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../theme/colors';
import { runOCRWithFallback } from '../services/aiProcessingEngine';

// ─── Category Icon Map ───────────────────────────────────────

const CATEGORY_ICONS = {
  Shopping: ShoppingCart,
  Product: ShoppingCart,
  Study: BookOpen,
  'Study material': BookOpen,
  Idea: Lightbulb,
  'Project idea': Lightbulb,
  Place: MapPin,
  Event: Calendar,
  Person: User,
  Receipt: Tag,
  Ticket: Tag,
  Code: Tag,
};

// ─── Category Badge ──────────────────────────────────────────

function CategoryBadge({ contentType, theme }) {
  const badge = theme.getCategoryBadge(contentType);
  return (
    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
      <Text style={[TYPOGRAPHY.badgeLabel, { color: badge.text }]}>
        {contentType || 'Capture'}
      </Text>
    </View>
  );
}

// ─── Urgency Badge ───────────────────────────────────────────

function UrgencyBadge({ item, palette }) {
  if (!item.urgency) return null;

  const isExpiring = item.urgency === 'expiring';
  const bgColor = isExpiring ? palette.urgencyRedBg : palette.urgencyAmberBg;
  const textColor = isExpiring ? palette.urgencyRed : palette.urgencyAmber;
  const label = item.urgencyLabel || (isExpiring ? 'Expiring soon' : 'Time-sensitive');

  return (
    <View style={[styles.urgencyBadge, { backgroundColor: bgColor }]}>
      <AlertTriangle size={10} color={textColor} strokeWidth={2.5} />
      <Text style={[styles.urgencyText, { color: textColor }]}>
        {label}
      </Text>
    </View>
  );
}

// ─── Quick Action Button ─────────────────────────────────────

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

// ─── Thumbnail with Category Fallback ────────────────────────

function SmartThumbnail({ item, palette, isDark }) {
  const [failed, setFailed] = useState(false);
  const FallbackIcon = CATEGORY_ICONS[item.contentType] || Tag;

  if (!item.imageUri || failed) {
    return (
      <View
        style={[
          styles.thumbnail,
          {
            backgroundColor: isDark ? 'rgba(129,140,248,0.1)' : 'rgba(99,102,241,0.06)',
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <FallbackIcon size={22} color={palette.primary} strokeWidth={1.8} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: item.imageUri }}
      style={styles.thumbnail}
      onError={() => setFailed(true)}
    />
  );
}

// ─── Confidence Pill ─────────────────────────────────────────

function ConfidencePill({ confidence, palette }) {
  const colorMap = {
    high: { bg: 'rgba(34,197,94,0.12)', text: '#22C55E' },
    medium: { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B' },
    low: { bg: 'rgba(239,68,68,0.12)', text: '#EF4444' },
  };
  const colors = colorMap[confidence] || colorMap.low;

  return (
    <View style={[styles.confidencePill, { backgroundColor: colors.bg }]}>
      <Text style={[styles.confidenceText, { color: colors.text }]}>
        {confidence}
      </Text>
    </View>
  );
}

// ─── Text Detect Button ──────────────────────────────────────

function TextDetectButton({ item, palette, isDark }) {
  const [ocrState, setOcrState] = useState('idle');
  const [ocrStage, setOcrStage] = useState('');
  const [ocrResult, setOcrResult] = useState(null);
  const [showTextPreview, setShowTextPreview] = useState(false);

  // Animations for success state
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;
  const previewHeightAnim = useRef(new Animated.Value(0)).current;

  const animateSuccess = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(8);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const togglePreview = useCallback(() => {
    const toShow = !showTextPreview;
    setShowTextPreview(toShow);
    Animated.timing(previewHeightAnim, {
      toValue: toShow ? 120 : 0,
      duration: 200,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [showTextPreview, previewHeightAnim]);

  const handleDetectPress = useCallback(async () => {
    if (ocrState === 'processing') return;

    setOcrState('processing');
    setOcrStage('Preparing image...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await runOCRWithFallback(
        item.imagePath || item.imageUri,
        { onStageChange: setOcrStage }
      );

      if (result.ocrFailed) {
        setOcrState('failed');
      } else {
        setOcrResult(result);
        setOcrState('success');
        animateSuccess();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (_err) {
      setOcrState('failed');
    }
  }, [item, ocrState, animateSuccess]);

  const handleRetry = useCallback(() => {
    setOcrState('idle');
    setOcrResult(null);
    setShowTextPreview(false);
    previewHeightAnim.setValue(0);
  }, [previewHeightAnim]);

  // Capture touch to prevent PanResponder/Swipeable from claiming it
  const captureTouch = () => true;

  // ── IDLE state ──
  if (ocrState === 'idle') {
    return (
      <View onStartShouldSetResponder={captureTouch}>
        <Pressable
          onPress={handleDetectPress}
          style={({ pressed }) => [
            styles.detectButton,
            {
              borderColor: palette.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Detect text in screenshot"
        >
          <ScanText size={14} color={palette.textSecondary} strokeWidth={2} />
          <Text style={[styles.detectButtonLabel, { color: palette.textSecondary }]}>
            Detect Text
          </Text>
        </Pressable>
      </View>
    );
  }

  // ── PROCESSING state ──
  if (ocrState === 'processing') {
    return (
      <View onStartShouldSetResponder={captureTouch} style={styles.detectStateRow}>
        <ActivityIndicator size="small" color={palette.primary} />
        <Text style={[styles.detectStageLabel, { color: palette.textSecondary }]}>
          {ocrStage}
        </Text>
      </View>
    );
  }

  // ── FAILED state ──
  if (ocrState === 'failed') {
    return (
      <View onStartShouldSetResponder={captureTouch} style={styles.detectStateColumn}>
        <View style={styles.detectStateRow}>
          <XCircle size={16} color={palette.urgencyRed} strokeWidth={2} />
          <Text style={[styles.detectResultLabel, { color: palette.textPrimary }]}>
            Could not detect text
          </Text>
        </View>
        <Text style={[styles.detectSubLabel, { color: palette.textSecondary }]}>
          Try better lighting or a higher resolution screenshot
        </Text>
        <Pressable onPress={handleRetry}>
          <Text style={[styles.detectRetryLink, { color: palette.primary }]}>
            Try again
          </Text>
        </Pressable>
      </View>
    );
  }

  // ── SUCCESS state ──
  return (
    <View onStartShouldSetResponder={captureTouch} style={styles.detectStateColumn}>
      <Animated.View
        style={[
          styles.detectStateRow,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <CheckCircle size={16} color={palette.completeTint} strokeWidth={2} />
        <Text style={[styles.detectResultLabel, { color: palette.textPrimary }]}>
          {ocrResult?.wordCount || 0} words detected
        </Text>
        {ocrResult?.hasDevanagari && (
          <View style={[styles.devanagariBadge, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            <Text style={styles.devanagariBadgeText}>हि</Text>
          </View>
        )}
        <ConfidencePill confidence={ocrResult?.confidence} palette={palette} />
      </Animated.View>

      {/* Show/Hide text toggle */}
      <Pressable onPress={togglePreview} style={styles.detectToggleRow}>
        <Text style={[styles.detectToggleLabel, { color: palette.primary }]}>
          {showTextPreview ? 'Hide text' : 'Show text'}
        </Text>
        {showTextPreview ? (
          <ChevronUp size={12} color={palette.primary} strokeWidth={2.5} />
        ) : (
          <ChevronDown size={12} color={palette.primary} strokeWidth={2.5} />
        )}
      </Pressable>

      {/* Text preview */}
      <Animated.View
        style={[
          styles.detectPreviewContainer,
          {
            maxHeight: previewHeightAnim,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          },
        ]}
      >
        <ScrollView nestedScrollEnabled style={styles.detectPreviewScroll}>
          <Text
            style={[styles.detectPreviewText, { color: palette.textPrimary }]}
            selectable
          >
            {ocrResult?.text || ''}
          </Text>
        </ScrollView>
      </Animated.View>
    </View>
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
  onUndoAction,
}) {
  const theme = useTheme();
  const { palette, isDark } = theme;
  const swipeRef = useRef(null);

  // ── Swipe Right → Complete ──

  const renderLeftActions = (_progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0.5, 1],
      extrapolate: 'clamp',
    });
    const opacity = dragX.interpolate({
      inputRange: [0, 60],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.swipeLeftAction, { opacity }]}>
        <Animated.View
          style={[
            styles.swipeLeftContent,
            { backgroundColor: palette.swipeComplete, transform: [{ scale }] },
          ]}
        >
          <Check size={24} color="#FFF" strokeWidth={2.8} />
          <Text style={styles.swipeLabel}>Done</Text>
        </Animated.View>
      </Animated.View>
    );
  };

  // ── Swipe Left → Snooze / Archive ──

  const renderRightActions = (_progress, dragX) => {
    const translateSnooze = dragX.interpolate({
      inputRange: [-200, -100, 0],
      outputRange: [0, 0, 100],
      extrapolate: 'clamp',
    });
    const translateArchive = dragX.interpolate({
      inputRange: [-200, -100, 0],
      outputRange: [0, 50, 200],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.swipeRightContainer}>
        <Animated.View style={{ transform: [{ translateX: translateSnooze }] }}>
          <Pressable
            style={[styles.swipeAction, { backgroundColor: palette.snoozeTint }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              swipeRef.current?.close();
              onSnooze(item);
            }}
          >
            <Clock size={18} color="#FFF" strokeWidth={2.2} />
            <Text style={styles.swipeLabel}>Tomorrow</Text>
          </Pressable>
        </Animated.View>
        <Animated.View style={{ transform: [{ translateX: translateArchive }] }}>
          <Pressable
            style={[styles.swipeAction, { backgroundColor: palette.swipeArchive }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              swipeRef.current?.close();
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

  const onSwipeLeft = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(item);
  };

  // ── Render ──

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
      leftThreshold={80}
      rightThreshold={40}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') onSwipeLeft();
      }}
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
          <SmartThumbnail item={item} palette={palette} isDark={isDark} />

          <View style={styles.metaColumn}>
            <View style={styles.badgeRow}>
              <CategoryBadge contentType={item.contentType} theme={theme} />
              <UrgencyBadge item={item} palette={palette} />
            </View>
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

          {/* Deep Action Button — context-aware CTA */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (item.extractedUrl) {
                Linking.openURL(item.extractedUrl).catch(console.error);
              } else {
                onPrimaryPress(item);
              }
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: palette.primary, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Text style={styles.primaryText} numberOfLines={1}>
              {item.suggestedAction}
            </Text>
            {item.extractedUrl ? (
              <ExternalLink size={14} color="#FFF" strokeWidth={2.4} />
            ) : (
              <ChevronRight size={14} color="#FFF" strokeWidth={2.8} />
            )}
          </Pressable>
        </View>

        {/* ── Text Detect Section ── */}
        <View style={[styles.divider, { backgroundColor: palette.border }]} />
        <View style={styles.detectSection}>
          <TextDetectButton item={item} palette={palette} isDark={isDark} />
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
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 14) return 'Posted 2 weeks ago — revisit?';
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
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    backgroundColor: '#E5E7EB',
    marginRight: SPACING.md,
  },
  metaColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },

  /* ── Badge ── */
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: RADIUS.pill,
  },

  /* ── Urgency Badge ── */
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: RADIUS.pill,
    gap: 3,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
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

  /* ── Swipe Left (Complete) ── */
  swipeLeftAction: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: SPACING.md,
    marginBottom: SPACING.md,
  },
  swipeLeftContent: {
    width: 80,
    height: '100%',
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Swipe Right (Snooze/Archive) ── */
  swipeRightContainer: {
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

  /* ── Text Detect Section ── */
  detectSection: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  detectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  detectButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  detectStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  detectStateColumn: {
    gap: 6,
  },
  detectStageLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  detectResultLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  detectSubLabel: {
    fontSize: 11,
    fontWeight: '400',
    marginLeft: 24,
  },
  detectRetryLink: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 24,
    marginTop: 2,
  },
  detectToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  detectToggleLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  detectPreviewContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 6,
  },
  detectPreviewScroll: {
    padding: 8,
  },
  detectPreviewText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },

  /* ── Confidence Pill ── */
  confidencePill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: RADIUS.pill,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  /* ── Devanagari Badge ── */
  devanagariBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: RADIUS.pill,
  },
  devanagariBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
  },
});
