import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Text,
} from 'react-native';
import { Send, Mic, Paperclip, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import * as Haptics from 'expo-haptics';

const PLACEHOLDERS = [
  "What did I save last week about React?",
  "Show me things I want to buy",
  "Find my restaurant screenshots",
  "Summarize my recipes",
];

export default function ChatInput({ onSend, isTyping, onAttachmentPress, onVoicePress }) {
  const { palette, isDark } = useTheme();
  const [input, setInput] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = () => {
    if (input.trim() && !isTyping) {
      onSend(input.trim());
      setInput('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.card, borderTopColor: palette.border }]}>
      <View style={styles.inner}>
        <Pressable 
          style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
          onPress={onAttachmentPress}
        >
          <Paperclip size={20} color={palette.textSecondary} />
        </Pressable>

        <View style={[styles.inputWrapper, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <TextInput
            style={[styles.input, { color: palette.textPrimary }]}
            placeholder={PLACEHOLDERS[placeholderIndex]}
            placeholderTextColor={palette.textSecondary}
            multiline
            numberOfLines={1}
            maxLength={500}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          {input.length === 0 && (
            <Pressable 
              style={({ pressed }) => [styles.voiceButton, { opacity: pressed ? 0.6 : 1 }]}
              onPress={onVoicePress}
            >
              <Mic size={20} color={palette.textSecondary} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.sendButton,
            {
              backgroundColor: input.trim() ? palette.primary : palette.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={handleSend}
          disabled={!input.trim() || isTyping}
        >
          {isTyping ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Send size={18} color="#FFF" style={{ marginLeft: -2 }} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: SPACING.md,
  },
  input: {
    flex: 1,
    ...TYPOGRAPHY.body,
    paddingVertical: 10,
    paddingRight: SPACING.sm,
  },
  voiceButton: {
    padding: SPACING.xs,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
});
