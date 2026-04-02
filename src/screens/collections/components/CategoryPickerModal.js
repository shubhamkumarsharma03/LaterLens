import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../../theme/useTheme';
import { SPACING, RADIUS } from '../../../theme/colors';
import { getCategoryIcon } from '../../../utils/categoryIcons';
import { X } from 'lucide-react-native';

const { height } = Dimensions.get('window');

export default function CategoryPickerModal({ visible, onClose, onSelect, categories }) {
  const { palette } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={[styles.content, { backgroundColor: palette.card }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.textPrimary }]}>Move to Collection</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={palette.textSecondary} />
            </Pressable>
          </View>

          <FlatList
            data={categories}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const Icon = getCategoryIcon(item);
              return (
                <Pressable
                  style={[styles.item, { borderBottomColor: palette.border }]}
                  onPress={() => onSelect(item)}
                >
                  <View style={[styles.iconBox, { backgroundColor: palette.primaryLight }]}>
                    <Icon size={18} color={palette.primary} />
                  </View>
                  <Text style={[styles.itemText, { color: palette.textPrimary }]}>{item}</Text>
                </Pressable>
              );
            }}
          />
          <View style={{ height: 40 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  dismiss: {
    flex: 1,
  },
  content: {
    height: height * 0.6,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
