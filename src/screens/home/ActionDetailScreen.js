/**
 * ActionDetailScreen — Full detail view for a single action item.
 *
 * Premium layout with hero image, category badge, tags,
 * and large action buttons — all themed for Light / Dark.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View, Pressable, Image } from 'react-native';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQueue } from '../../state/QueueContext';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import { HOME_ROUTES } from '../../navigation/routeNames';

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
    snoozeQueueItem,
    markAsViewed,
    allItems
  } = useQueue();
  const { palette, isDark } = useTheme();

  const [showOCR, setShowOCR] = useState(false);
  const item = getItemById(itemId);

  // ── Mark as viewed ──
  useEffect(() => {
    if (itemId) {
      markAsViewed(itemId);
    }
  }, [itemId, markAsViewed]);

  // ── Related Items Logic ──
  const relatedItems = useMemo(() => {
    if (!item || !allItems) return [];
    
    return allItems
      .filter(i => 
        i.id !== item.id && 
        i.status !== 'archived' &&
        (i.contentType === item.contentType || 
         (i.summary && item.summary && i.summary.split(' ').some(word => word.length > 4 && item.summary.includes(word))))
      )
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 6);
  }, [item, allItems]);

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
    await snoozeQueueItem(item.id, 60 * 24); // Snooze for 1 day
    navigation.goBack();
  };

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
      <OCRImageOverlay 
        imageUri={item.imageUri} 
        showOCR={showOCR} 
        onToggleOCR={() => setShowOCR(!showOCR)} 
      />

      <View style={styles.sourceRow}>
        <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>
          Saved {getTimeAgo(item.timestamp)} • from {item.source || 'Intelligence'}
        </Text>
      </View>

      <EditableAIPanel 
        item={item} 
        onUpdate={handleUpdate} 
      />

      <ActionZone 
        item={item} 
        onComplete={handleComplete}
        onSnooze={handleSnooze}
        onArchive={handleArchive}
      />

      {/* Dynamic Related Section */}
      {relatedItems.length > 0 && (
        <View style={styles.relatedSection}>
          <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary, marginBottom: SPACING.md }]}>
            Related to this
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relatedScroll}>
            {relatedItems.map((related) => (
              <Pressable 
                key={related.id} 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.push(HOME_ROUTES.DETAIL, { itemId: related.id });
                }}
                style={[styles.relatedThumbnail, { borderColor: palette.border, borderWidth: 1 }]}
              >
                 <Image source={{ uri: related.imageUri }} style={styles.thumbImage} />
                 <View style={styles.relatedLabelBg}>
                   <Text style={styles.relatedLabelText} numberOfLines={1}>{related.contentType}</Text>
                 </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <UserNotesSection 
        item={item} 
        onUpdate={handleUpdate} 
      />

      <Pressable style={[styles.threadBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F3F4F6' }]}>
        <View style={styles.threadInfo}>
          <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>PART OF THREAD</Text>
          <Text style={[TYPOGRAPHY.bodyBold, { color: palette.textPrimary }]}>Smart Organization • Active</Text>
        </View>
        <ChevronRight size={20} color={palette.textSecondary} />
      </Pressable>
    </ScrollView>
  );
}

function getTimeAgo(timestamp) {
  if (!timestamp) return 'recently';
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
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  relatedLabelBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  relatedLabelText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
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
