import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, Pressable } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import { useQueue } from '../../state/QueueContext';
import { useNavigation } from '@react-navigation/native';
import { HOME_ROUTES } from '../../navigation/routeNames';
import { Sparkles, ArrowRight, FolderPlus, Bell } from 'lucide-react-native';

const ID_REGEX = /\[IDS:\s*([^\]]+)\]/;

export default function ChatBubble({ message }) {
  const { palette, isDark } = useTheme();
  const { getItemById } = useQueue();
  const navigation = useNavigation();
  const isUser = message.sender === 'user';

  const { cleanText, itemIds } = useMemo(() => {
    const match = message.text.match(ID_REGEX);
    if (match) {
      const ids = match[1].split(',').map(id => id.trim());
      const clean = message.text.replace(ID_REGEX, '').trim();
      return { cleanText: clean, itemIds: ids };
    }
    return { cleanText: message.text, itemIds: [] };
  }, [message.text]);

  const items = useMemo(() => {
    return itemIds.map(id => getItemById(id)).filter(item => !!item);
  }, [itemIds, getItemById]);

  const renderActions = () => {
    if (isUser || !itemIds.length) return null;
    
    return (
      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, { borderColor: palette.border }]}>
          <ArrowRight size={14} color={palette.primary} />
          <Text style={[TYPOGRAPHY.tiny, { color: palette.textPrimary, fontWeight: '700' }]}>Start project board</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, { borderColor: palette.border }]}>
          <FolderPlus size={14} color={palette.primary} />
          <Text style={[TYPOGRAPHY.tiny, { color: palette.textPrimary, fontWeight: '700' }]}>Group into collection</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, { borderColor: palette.border }]}>
          <Bell size={14} color={palette.primary} />
          <Text style={[TYPOGRAPHY.tiny, { color: palette.textPrimary, fontWeight: '700' }]}>Set a reminder</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.wrapper, isUser ? styles.userWrap : styles.aiWrap]}>
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: palette.primaryLight }]}>
          <Sparkles size={14} color={palette.primary} />
        </View>
      )}
      
      <View style={[
        styles.bubble,
        isUser ? [styles.userBubble, { backgroundColor: palette.primary }] : [styles.aiBubble, { backgroundColor: palette.card, borderColor: palette.border }]
      ]}>
        <Markdown 
          style={{
            body: { 
              ...TYPOGRAPHY.body, 
              color: isUser ? '#FFFFFF' : palette.textPrimary,
              marginTop: 0,
              marginBottom: 0,
            },
            paragraph: { marginTop: 0, marginBottom: 0 },
          }}
        >
          {cleanText}
        </Markdown>

        {items.length > 0 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.screenshotScroll}
            contentContainerStyle={styles.screenshotContent}
          >
            {items.map((item, idx) => (
              <Pressable 
                key={idx}
                onPress={() => navigation.navigate(HOME_ROUTES.DETAIL, { itemId: item.id })}
                style={styles.screenshotContainer}
              >
                <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {renderActions()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  userWrap: { justifyContent: 'flex-end' },
  aiWrap: { justifyContent: 'flex-start' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    marginTop: 4,
  },
  bubble: {
    maxWidth: '85%',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  userBubble: {
    borderBottomRightRadius: 4,
    borderWidth: 0,
  },
  aiBubble: {
    borderBottomLeftRadius: 4,
  },
  screenshotScroll: {
    marginTop: SPACING.sm,
    marginHorizontal: -SPACING.sm,
  },
  screenshotContent: {
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xs,
  },
  screenshotContainer: {
    width: 80,
    height: 120,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  actions: {
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
});
