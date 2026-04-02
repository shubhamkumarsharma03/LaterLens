/**
 * ActionDetailScreen — Full detail view for a single action item.
 *
 * Premium layout with hero image, category badge, tags,
 * and large action buttons — all themed for Light / Dark.
 */

import React, { useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View, Pressable, Image } from 'react-native';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQueue } from '../../state/QueueContext';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';

// ── Components ──
import OCRImageOverlay from './components/OCRImageOverlay';
import EditableAIPanel from './components/EditableAIPanel';
import ActionZone from './components/ActionZone';
import UserNotesSection from './components/UserNotesSection';

export default function ActionDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { itemId } = route.params || {};
  const { 
    getItemById, 
    updateQueueItem, 
    completeQueueItem, 
    archiveQueueItem, 
    snoozeQueueItem 
  } = useQueue();
  const { palette, isDark } = useTheme();

  const [showOCR, setShowOCR] = useState(false);
  const item = getItemById(itemId);

  // ── Handlers ──
  const handleUpdate = async (updates) => {
    if (!item) return;
    await updateQueueItem(item.id, updates);
  };

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
    await snoozeQueueItem(item.id, 60 * 24); // Snooze for 1 day by default
    navigation.goBack();
  };

  // ── Not found ──
  if (!item) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: palette.background }]}>
        <Text style={[TYPOGRAPHY.title, { color: palette.textPrimary, marginBottom: SPACING.sm }]}>
          Item not found
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

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── 1. Screenshot View ── */}
      <OCRImageOverlay 
        imageUri={item.imageUri} 
        showOCR={showOCR} 
        onToggleOCR={() => setShowOCR(!showOCR)} 
      />

      {/* ── 2. Date + Source Label ── */}
      <View style={styles.sourceRow}>
        <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>
          Saved {getTimeAgo(item.timestamp)} • from {item.source || 'Instagram'}
        </Text>
      </View>

      {/* ── 3. AI Analysis Panel ── */}
      <EditableAIPanel 
        item={item} 
        onUpdate={handleUpdate} 
      />

      {/* ── 4. Action Zone ── */}
      <ActionZone 
        item={item} 
        onComplete={handleComplete}
        onSnooze={handleSnooze}
        onArchive={handleArchive}
      />

      {/* ── 5. Related Items Strip ── */}
      <View style={styles.relatedSection}>
        <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary, marginBottom: SPACING.md }]}>
          Related to this
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relatedScroll}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.relatedThumbnail, { backgroundColor: i % 2 === 0 ? '#E5E7EB' : '#D1D5DB', borderColor: palette.border, borderWidth: 1 }]}>
               {/* Placeholders for related screenshots */}
               <Image source={{ uri: item.imageUri }} style={styles.thumbImage} />
            </View>
          ))}
        </ScrollView>
      </View>

      {/* ── 6. User Notes (Markdown + Autosave) ── */}
      <UserNotesSection 
        item={item} 
        onUpdate={handleUpdate} 
      />

      {/* ── 7. Thread Membership ── */}
      <Pressable style={[styles.threadBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F3F4F6' }]}>
        <View style={styles.threadInfo}>
          <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>PART OF THREAD</Text>
          <Text style={[TYPOGRAPHY.bodyBold, { color: palette.textPrimary }]}>Your app ideas • 4 screenshots</Text>
        </View>
        <ChevronRight size={20} color={palette.textSecondary} />
      </Pressable>
    </ScrollView>
  );
}

function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  sourceRow: {
    marginBottom: SPACING.sm,
  },
  relatedSection: {
    marginBottom: SPACING.lg,
  },
  relatedScroll: {
    flexDirection: 'row',
  },
  relatedThumbnail: {
    width: 100,
    height: 140,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  threadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.md,
  },
  threadInfo: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    gap: 8,
  },
});
