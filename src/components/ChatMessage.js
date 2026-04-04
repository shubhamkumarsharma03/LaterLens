import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import ScreenshotResultStrip from './ScreenshotResultStrip';
import { TYPOGRAPHY, SPACING, RADIUS } from '../theme/colors';

function formatTime(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function LoadingDots({ color }) {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const animations = dots.map((dot, index) => Animated.loop(
      Animated.sequence([
        Animated.delay(index * 120),
        Animated.timing(dot, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(dot, {
          toValue: 0.3,
          duration: 280,
          useNativeDriver: true,
        }),
      ])
    ));

    animations.forEach((anim) => anim.start());

    return () => animations.forEach((anim) => anim.stop());
  }, [dots]);

  return (
    <View style={styles.dotRow}>
      {dots.map((opacity, index) => (
        <Animated.View
          key={index}
          style={[styles.dot, { backgroundColor: color, opacity }]}
        />
      ))}
    </View>
  );
}

export default function ChatMessage({ message, theme, onItemPress }) {
  const palette = theme?.palette || {};
  const isUser = message?.role === 'user';
  const [showCopied, setShowCopied] = useState(false);

  const bubbleStyle = useMemo(() => {
    if (isUser) {
      return [styles.bubble, styles.userBubble, { backgroundColor: palette.primary }];
    }

    return [
      styles.bubble,
      styles.assistantBubble,
      { backgroundColor: palette.card, borderColor: palette.border, borderWidth: StyleSheet.hairlineWidth },
    ];
  }, [isUser, palette]);

  const handleCopy = async () => {
    if (!message?.content) return;
    await Clipboard.setStringAsync(message.content);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 900);
  };

  return (
    <View style={[styles.outer, isUser ? styles.outerUser : styles.outerAssistant]}>
      <Pressable onLongPress={handleCopy} delayLongPress={240}>
        <View style={bubbleStyle}>
          {message?.isLoading ? (
            <LoadingDots color={palette.textSecondary} />
          ) : (
            <Text style={[TYPOGRAPHY.body, { color: isUser ? palette.toastText : palette.textPrimary }]}>
              {message?.content}
            </Text>
          )}

          {!message?.isLoading && Array.isArray(message?.matchedItems) && message.matchedItems.length > 0 ? (
            <ScreenshotResultStrip
              items={message.matchedItems}
              onItemPress={onItemPress}
              theme={theme}
            />
          ) : null}
        </View>
      </Pressable>

      <Text style={[TYPOGRAPHY.tiny, styles.timestamp, { color: palette.textSecondary }]}>
        {formatTime(message?.timestamp)}
      </Text>

      {showCopied ? (
        <View style={[styles.copyToast, { backgroundColor: palette.toastBg }]}> 
          <Text style={[TYPOGRAPHY.tiny, { color: palette.toastText }]}>Copied</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: SPACING.md,
    marginVertical: SPACING.xs,
  },
  outerUser: {
    alignItems: 'flex-end',
  },
  outerAssistant: {
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    maxWidth: '88%',
  },
  userBubble: {
    borderBottomRightRadius: RADIUS.sm,
  },
  assistantBubble: {
    borderBottomLeftRadius: RADIUS.sm,
  },
  timestamp: {
    marginTop: 4,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  copyToast: {
    marginTop: 4,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
});
