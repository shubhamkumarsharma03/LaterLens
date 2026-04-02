import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Modal, FlatList } from 'react-native';
import { Sparkles, Edit2, Tag as TagIcon, ChevronRight, X, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../../theme/colors';
import { useTheme } from '../../../theme/useTheme';

const ALLOWED_INTENTS = ['Buy', 'Read', 'Build', 'Attend', 'Pay', 'Review', 'Study', 'Visit'];

export default function EditableAIPanel({ item, onUpdate }) {
  const { palette, isDark } = useTheme();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(item.summary);
  const [intentModalVisible, setIntentModalVisible] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (title !== item.summary) {
      onUpdate({ summary: title });
    }
  };

  const handleChangeIntent = (newIntent) => {
    setIntentModalVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdate({ intent: newIntent });
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      const updatedTags = [...(item.tags || []), newTag.trim().toLowerCase()];
      onUpdate({ tags: updatedTags });
      setNewTag('');
      setIsAddingTag(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setIsAddingTag(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── AI Generated Title ── */}
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Sparkles size={12} color={palette.primary} />
          <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary, marginLeft: 4 }]}>
            AI-GENERATED TITLE
          </Text>
        </View>
        
        {isEditingTitle ? (
          <TextInput
            style={[styles.titleInput, { color: palette.textPrimary, borderBottomColor: palette.primary }]}
            value={title}
            onChangeText={setTitle}
            onBlur={handleTitleSubmit}
            onSubmitEditing={handleTitleSubmit}
            autoFocus
            multiline
          />
        ) : (
          <Pressable onPress={() => setIsEditingTitle(true)} style={styles.titlePressable}>
            <Text style={[TYPOGRAPHY.title, { color: palette.textPrimary, flex: 1 }]}>
              {item.summary}
            </Text>
            <Edit2 size={14} color={palette.textSecondary} style={{ marginLeft: 8, marginTop: 4 }} />
          </Pressable>
        )}
      </View>

      {/* ── Intent Chip ── */}
      <View style={styles.section}>
        <Pressable 
          style={[styles.intentChip, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF', borderColor: palette.primary + '40' }]}
          onPress={() => setIntentModalVisible(true)}
        >
          <View style={styles.intentInfo}>
            <Text style={[TYPOGRAPHY.caption, { color: palette.primary, fontWeight: '700' }]}>
              INTENT: {item.intent || 'Analyzing...'}
            </Text>
            <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>
              AI high confidence • Tap to correct
            </Text>
          </View>
          <ChevronRight size={16} color={palette.primary} />
        </Pressable>
      </View>

      {/* ── Key Info Grid ── */}
      <View style={[styles.infoGrid, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB' }]}>
        <InfoItem label="Category" value={item.contentType} />
        <InfoItem label="Saved From" value={item.source || 'Unknown'} />
        {item.contentType === 'Shopping' && <InfoItem label="Price" value="Detecting..." />}
        {item.contentType === 'Event' && <InfoItem label="Date" value="Scanning..." />}
      </View>

      {/* ── Category + Tags Row ── */}
      <View style={styles.tagsSection}>
        <View style={styles.taxonomyRow}>
          <View style={[styles.categoryBadge, { backgroundColor: palette.primary + '20' }]}>
            <Text style={[TYPOGRAPHY.badgeLabel, { color: palette.primary }]}>{item.contentType}</Text>
          </View>
          <View style={styles.tagsList}>
            {item.tags?.map((tag) => (
              <View key={tag} style={[styles.tagChip, { borderColor: palette.border }]}>
                <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>#{tag}</Text>
              </View>
            ))}
            
            {isAddingTag ? (
              <TextInput
                style={[styles.tagInput, { color: palette.textPrimary, borderColor: palette.primary }]}
                value={newTag}
                onChangeText={setNewTag}
                onBlur={handleAddTag}
                onSubmitEditing={handleAddTag}
                autoFocus
                placeholder="tag..."
                placeholderTextColor={palette.textSecondary}
              />
            ) : (
              <Pressable 
                style={[styles.tagChip, { borderStyle: 'dashed', borderColor: palette.primary }]}
                onPress={() => setIsAddingTag(true)}
              >
                <Plus size={10} color={palette.primary} style={{ marginRight: 2 }} />
                <Text style={[TYPOGRAPHY.tiny, { color: palette.primary }]}>Add</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* ── Intent Modal ── */}
      <Modal visible={intentModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary }]}>Choose Intent</Text>
              <Pressable onPress={() => setIntentModalVisible(false)}><X size={20} color={palette.textSecondary} /></Pressable>
            </View>
            <FlatList
              data={ALLOWED_INTENTS}
              keyExtractor={(i) => i}
              renderItem={({ item: i }) => (
                <Pressable 
                  style={[styles.intentOption, { borderBottomColor: palette.border }]} 
                  onPress={() => handleChangeIntent(i)}
                >
                  <Text style={[TYPOGRAPHY.body, { color: i === item.intent ? palette.primary : palette.textPrimary, fontWeight: i === item.intent ? '700' : '400' }]}>{i}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoItem({ label, value }) {
  const { palette } = useTheme();
  return (
    <View style={styles.infoItem}>
      <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[TYPOGRAPHY.bodyBold, { color: palette.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.md,
  },
  section: {
    marginBottom: SPACING.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  titlePressable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleInput: {
    ...TYPOGRAPHY.title,
    padding: 0,
    borderBottomWidth: 1,
  },
  intentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  intentInfo: {
    flex: 1,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  infoItem: {
    minWidth: '40%',
  },
  tagsSection: {
    marginTop: SPACING.sm,
  },
  taxonomyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  tagInput: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    fontSize: 11,
    minWidth: 60,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    padding: SPACING.lg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  intentOption: {
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
