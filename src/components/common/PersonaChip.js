import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { RADIUS } from '../../theme/colors';

export default function PersonaChip({ label, isSelected, onPress }) {
  const { palette, typography } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: isSelected ? palette.primary : palette.primaryLight,
          borderColor: isSelected ? palette.primary : palette.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.label,
          {
            color: isSelected ? '#fff' : palette.primary,
            ...typography.caption,
            fontWeight: '700',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
  },
});
