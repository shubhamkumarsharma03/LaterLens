import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert, Modal } from 'react-native';
import { ExternalLink, Share as ShareIcon, Bell, Copy, Check, Clock, Archive, X } from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../../theme/colors';
import { useTheme } from '../../../theme/useTheme';

export default function ActionZone({ item, onComplete, onSnooze, onArchive }) {
  const { palette, isDark } = useTheme();
  const [reminderVisible, setReminderVisible] = useState(false);

  const handlePrimaryAction = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (item.extractedUrl) {
      const canOpen = await Linking.canOpenURL(item.extractedUrl);
      if (canOpen) {
        await Linking.openURL(item.extractedUrl);
      } else {
        handleSearchWeb();
      }
    } else {
      handleSearchWeb();
    }
  };

  const handleSearchWeb = () => {
    const query = encodeURIComponent(item.summary);
    Linking.openURL(`https://www.google.com/search?q=${query}`);
  };

  const handleShare = async () => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing not available', 'Your device doesn\'t support sharing.');
      return;
    }
    await Sharing.shareAsync(item.imageUri);
  };

  const handleCopyText = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(`${item.summary}\n\nIntent: ${item.intent}\nTags: ${item.tags?.join(', ')}`);
    Alert.alert('Copied', 'Item details copied to clipboard.');
  };

  return (
    <View style={styles.container}>
      {/* ── Primary CTA ── */}
      <Pressable 
        style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
        onPress={handlePrimaryAction}
      >
        <Text style={[TYPOGRAPHY.buttonLabel, { color: '#FFF', fontSize: 16 }]}>
          {item.extractedUrl ? `Open ${getDomain(item.extractedUrl)}` : `Search: ${item.contentType}`}
        </Text>
        <ExternalLink size={18} color="#FFF" style={{ marginLeft: 8 }} />
      </Pressable>

      {/* ── Secondary Actions Row ── */}
      <View style={styles.secondaryRow}>
        <ActionButton icon={ShareIcon} label="Share" onPress={handleShare} />
        <ActionButton icon={Bell} label="Reminder" onPress={() => setReminderVisible(true)} />
        <ActionButton icon={Copy} label="Copy Text" onPress={handleCopyText} />
        <ActionButton icon={ExternalLink} label="Search Web" onPress={handleSearchWeb} />
      </View>

      {/* ── Status Buttons ── */}
      <View style={[styles.statusBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB' }]}>
        <StatusBtn 
          icon={Check} 
          label="Mark done" 
          color={palette.completeTint} 
          bg={palette.completeBg} 
          onPress={onComplete}
        />
        <StatusBtn 
          icon={Clock} 
          label="Snooze" 
          color={palette.snoozeTint} 
          bg={palette.snoozeBg} 
          onPress={onSnooze}
        />
        <StatusBtn 
          icon={Archive} 
          label="Archive" 
          color={palette.archiveTint} 
          bg={palette.archiveBg} 
          onPress={onArchive}
        />
      </View>

      {/* ── Reminder Modal (Simple) ── */}
      <Modal visible={reminderVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary }]}>Set Reminder</Text>
              <Pressable onPress={() => setReminderVisible(false)}>
                <X size={20} color={palette.textSecondary} />
              </Pressable>
            </View>
            <Text style={[TYPOGRAPHY.body, { color: palette.textSecondary, marginBottom: SPACING.md }]}>
              When should we remind you about this?
            </Text>
            {['In 1 hour', 'Tonight', 'Tomorrow morning', 'Flexible'].map((option) => (
              <Pressable 
                key={option} 
                style={[styles.optionBtn, { borderColor: palette.border }]}
                onPress={() => {
                  setReminderVisible(false);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert('Reminder set', `We'll remind you ${option.toLowerCase()}.`);
                }}
              >
                <Text style={[TYPOGRAPHY.body, { color: palette.textPrimary }]}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getDomain(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch (e) {
    return 'Source';
  }
}

function ActionButton({ icon: Icon, label, onPress }) {
  const { palette } = useTheme();
  return (
    <Pressable style={styles.actionBtn} onPress={onPress}>
      <View style={[styles.iconCircle, { borderColor: palette.border }]}>
        <Icon size={18} color={palette.textSecondary} />
      </View>
      <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary, marginTop: 4 }]}>{label}</Text>
    </Pressable>
  );
}

function StatusBtn({ icon: Icon, label, color, bg, onPress }) {
  return (
    <Pressable 
      style={[styles.statusBtn, { backgroundColor: bg }]} 
      onPress={onPress}
    >
      <Icon size={18} color={color} />
      <Text style={[TYPOGRAPHY.buttonLabel, { color, fontSize: 13, marginLeft: 6 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.lg,
  },
  primaryBtn: {
    height: 56,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: SPACING.xl,
  },
  actionBtn: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBar: {
    flexDirection: 'row',
    padding: SPACING.sm,
    borderRadius: RADIUS.xl,
    gap: SPACING.sm,
  },
  statusBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: SPACING.lg,
  },
  modalContent: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  optionBtn: {
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
