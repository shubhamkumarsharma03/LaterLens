/**
 * ActionDetailScreen — Full detail view for a single action item.
 *
 * Premium layout with hero image, category badge, tags,
 * and large action buttons — all themed for Light / Dark.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, Clock, Archive, ChevronRight, ArrowLeft, Tag } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQueue } from '../../state/QueueContext';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';

export default function ActionDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { itemId } = route.params || {};
  const { getItemById, completeQueueItem, archiveQueueItem, snoozeQueueItem } = useQueue();
  const { palette, isDark, getCategoryBadge: getBadge } = useTheme();

  const item = getItemById(itemId);

  const handleComplete = async () => {
    if (!item) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeQueueItem(item.id);
    navigation.goBack();
  };

  const handleArchive = async () => {
    if (!item) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await archiveQueueItem(item.id);
    navigation.goBack();
  };

  const handleSnooze = async () => {
    if (!item) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await snoozeQueueItem(item.id, 60);
    navigation.goBack();
  };

  const handleSuggestedAction = () => {
    if (!item) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[ActionDetail] Suggested action pressed:', item.suggestedAction, item.id);
  };

  // ── Not found ──
  if (!item) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: palette.background }]}>
        <Text style={[TYPOGRAPHY.title, { color: palette.textPrimary, marginBottom: SPACING.sm }]}>
          Action not found
        </Text>
        <Text
          style={[TYPOGRAPHY.body, { color: palette.textSecondary, textAlign: 'center', marginBottom: SPACING.lg }]}
        >
          This item may have been completed or archived already.
        </Text>
        <Pressable
          style={[styles.backButton, { backgroundColor: palette.primary }]}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={16} color="#FFF" strokeWidth={2.4} />
          <Text style={[TYPOGRAPHY.buttonLabel, { color: '#FFF' }]}>Back to queue</Text>
        </Pressable>
      </View>
    );
  }

  const badge = getBadge(item.contentType);

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero Image ── */}
      <View style={[styles.heroWrap, isDark ? { borderColor: palette.border, borderWidth: 1 } : {}]}>
        <Image source={{ uri: item.imageUri }} style={styles.heroImage} />
      </View>

      {/* ── Meta Row ── */}
      <View style={styles.metaRow}>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[TYPOGRAPHY.badgeLabel, { color: badge.text }]}>
            {item.contentType}
          </Text>
        </View>
        <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
      </View>

      {/* ── Summary ── */}
      <Text style={[TYPOGRAPHY.title, { color: palette.textPrimary, marginBottom: SPACING.sm }]}>
        {item.summary}
      </Text>

      {/* ── Intent ── */}
      <Text style={[TYPOGRAPHY.body, { color: palette.textSecondary, marginBottom: SPACING.md }]}>
        Intent: {item.intent}
      </Text>

      {/* ── Tags ── */}
      <View style={styles.tagsRow}>
        {item.tags?.map((tag) => (
          <View
            key={tag}
            style={[
              styles.tagChip,
              {
                backgroundColor: isDark ? 'rgba(148,163,184,0.10)' : '#F3F4F6',
                borderColor: palette.border,
              },
            ]}
          >
            <Tag size={10} color={palette.textSecondary} strokeWidth={2.2} />
            <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>
              {tag}
            </Text>
          </View>
        ))}
      </View>

      {/* ── Primary CTA ── */}
      <Pressable
        style={({ pressed }) => [
          styles.ctaButton,
          { backgroundColor: palette.primary, opacity: pressed ? 0.88 : 1 },
        ]}
        onPress={handleSuggestedAction}
      >
        <Text style={[TYPOGRAPHY.buttonLabel, { color: '#FFF', fontSize: 15 }]}>
          {item.suggestedAction}
        </Text>
        <ChevronRight size={16} color="#FFF" strokeWidth={2.8} />
      </Pressable>

      {/* ── Secondary actions ── */}
      <View style={styles.secondaryRow}>
        <Pressable
          style={[
            styles.secondaryBtn,
            { backgroundColor: palette.completeBg },
          ]}
          onPress={handleComplete}
        >
          <Check size={18} color={palette.completeTint} strokeWidth={2.4} />
          <Text style={[TYPOGRAPHY.buttonLabel, { color: palette.completeTint, fontSize: 13 }]}>
            Complete
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.secondaryBtn,
            { backgroundColor: palette.snoozeBg },
          ]}
          onPress={handleSnooze}
        >
          <Clock size={18} color={palette.snoozeTint} strokeWidth={2.4} />
          <Text style={[TYPOGRAPHY.buttonLabel, { color: palette.snoozeTint, fontSize: 13 }]}>
            Snooze
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.secondaryBtn,
            { backgroundColor: palette.archiveBg },
          ]}
          onPress={handleArchive}
        >
          <Archive size={18} color={palette.archiveTint} strokeWidth={2.2} />
          <Text style={[TYPOGRAPHY.buttonLabel, { color: palette.archiveTint, fontSize: 13 }]}>
            Archive
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },

  /* Hero */
  heroWrap: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  heroImage: {
    width: '100%',
    height: 340,
    backgroundColor: '#E5E7EB',
  },

  /* Meta */
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
  },

  /* Tags */
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },

  /* CTA */
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },

  /* Secondary */
  secondaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 4,
  },

  /* Back */
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.pill,
  },
});
