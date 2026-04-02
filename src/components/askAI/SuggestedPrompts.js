import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';

const PROMPTS = [
  "Show my project ideas",
  "What's overdue?",
  "Find study material",
  "Summarise my week",
  "React screenshots",
  "Restaurant ideas",
];

export default function SuggestedPrompts({ onSelect }) {
  const { palette } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {PROMPTS.map((prompt, index) => (
        <Pressable
          key={index}
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={() => onSelect(prompt)}
        >
          <Text style={[TYPOGRAPHY.tiny, { color: palette.textPrimary, fontWeight: '600' }]}>
            {prompt}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
