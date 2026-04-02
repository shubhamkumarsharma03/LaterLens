import React from 'react';
import { StyleSheet, Text, View, Pressable, Animated } from 'react-native';
import { useTheme } from '../../../theme/useTheme';
import { SPACING, RADIUS, TYPOGRAPHY } from '../../../theme/colors';
import { UI_ICONS } from '../../../utils/categoryIcons';
import * as Haptics from 'expo-haptics';

export default function BatchActionsBar({ selectedCount, onAction, onClear }) {
  const { palette } = useTheme();

  const handleAction = (action) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAction(action);
  };

  if (selectedCount === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.header}>
        <Text style={[styles.countText, { color: palette.textPrimary }]}>{selectedCount} items selected</Text>
        <Pressable onPress={onClear}>
          <Text style={[styles.clearText, { color: palette.primary }]}>Deselect</Text>
        </Pressable>
      </View>
      
      <View style={styles.actionsRow}>
        <ActionButton icon="Move" label="Move" color={palette.textPrimary} onPress={() => handleAction('move')} />
        <ActionButton icon="Delete" label="Delete" color="#EF4444" onPress={() => handleAction('delete')} />
        <ActionButton icon="Share" label="Share" color={palette.textPrimary} onPress={() => handleAction('share')} />
        <ActionButton icon="Add" label="Project" color={palette.textPrimary} onPress={() => handleAction('project')} />
        <ActionButton icon="Complete" label="Done" color="#10B981" onPress={() => handleAction('done')} />
      </View>
    </View>
  );
}

function ActionButton({ icon, label, color, onPress }) {
  const Icon = UI_ICONS[icon];
  return (
    <Pressable style={styles.actionBtn} onPress={onPress}>
      <View style={[styles.iconCircle, { backgroundColor: '#F3F4F6' }]}>
        <Icon size={18} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: SPACING.md,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    // Shadow for premium feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  countText: {
    fontSize: 14,
    fontWeight: '700',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    alignItems: 'center',
    width: '18%',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
});
