import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native';
import Markdown from 'react-native-markdown-display';
import debounce from 'lodash.debounce';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../../theme/colors';
import { useTheme } from '../../../theme/useTheme';

export default function UserNotesSection({ item, onUpdate }) {
  const { palette, isDark } = useTheme();
  const [notes, setNotes] = useState(item.notes || '');
  const [isEditing, setIsEditing] = useState(false);

  // Autosave logic
  const debouncedUpdate = useCallback(
    debounce((newNotes) => {
      onUpdate({ notes: newNotes });
    }, 1000),
    [onUpdate]
  );

  const handleNotesChange = (text) => {
    setNotes(text);
    debouncedUpdate(text);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary }]}>
          User notes
        </Text>
        <Pressable onPress={() => setIsEditing(!isEditing)} style={styles.editToggle}>
          <Text style={[TYPOGRAPHY.tiny, { color: palette.primary, fontWeight: '700' }]}>
            {isEditing ? 'VIEW RENDER' : 'EDIT MARKDOWN'}
          </Text>
        </Pressable>
      </View>

      {isEditing ? (
        <TextInput
          style={[
            styles.input,
            { 
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FBFF',
              color: palette.textPrimary,
              borderColor: palette.border,
            }
          ]}
          value={notes}
          onChangeText={handleNotesChange}
          placeholder="Add a note — why did you save this?"
          placeholderTextColor={palette.textSecondary}
          multiline
          textAlignVertical="top"
        />
      ) : (
        <View style={[styles.preview, { borderLeftColor: palette.primary + '40' }]}>
          {notes ? (
            <Markdown
              style={{
                body: { color: palette.textPrimary, fontSize: 15 },
                paragraph: { marginBottom: 8 },
                strong: { fontWeight: '700' },
              }}
            >
              {notes}
            </Markdown>
          ) : (
            <Text style={[TYPOGRAPHY.body, { color: palette.textSecondary, fontStyle: 'italic' }]}>
              No notes added yet. Tap to add.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  editToggle: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(99,102,241,0.1)',
  },
  input: {
    minHeight: 120,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    ...TYPOGRAPHY.body,
    lineHeight: 22,
  },
  preview: {
    minHeight: 60,
    paddingVertical: 4,
    paddingLeft: SPACING.md,
    borderLeftWidth: 3,
  }
});
