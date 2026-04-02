import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { History, PlusCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../theme/useTheme';
import { useQueue } from '../../state/QueueContext';
import { useChat } from '../../state/ChatContext';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import { queryScreenshotLibrary } from '../../services/aiProcessingEngine';

import ChatBubble from '../../components/askAI/ChatBubble';
import ChatInput from '../../components/askAI/ChatInput';
import TypingIndicator from '../../components/askAI/TypingIndicator';
import SuggestedPrompts from '../../components/askAI/SuggestedPrompts';

export default function AskAIScreen() {
  const { allItems } = useQueue();
  const { messages, addMessage, clearHistory, isLoading } = useChat();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef(null);

  const sendMessage = async (text) => {
    const userMessage = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: Date.now(),
    };

    addMessage(userMessage);
    setIsTyping(true);

    try {
      const responseText = await queryScreenshotLibrary(text, allItems);
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        sender: 'ai',
        timestamp: Date.now(),
      };
      addMessage(aiMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I ran into an error accessing your library. Please check your connection.",
        sender: 'ai',
        timestamp: Date.now(),
        isError: true,
      };
      addMessage(errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleNewChat = () => {
    Alert.alert(
      "New Chat",
      "Reset the current conversation thread?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Reset", 
          style: "destructive",
          onPress: () => {
            clearHistory();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }
      ]
    );
  };

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: SPACING.sm, backgroundColor: palette.background }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[TYPOGRAPHY.heroTitle, { color: palette.textPrimary }]}>Ask AI</Text>
          <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>Powered by Gemini 2.5 Flash</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable 
            style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => Alert.alert("History", "Conversation history coming soon!")}
          >
            <History size={22} color={palette.textPrimary} />
          </Pressable>
          <Pressable 
            style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={handleNewChat}
          >
            <PlusCircle size={22} color={palette.textPrimary} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: palette.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {renderHeader()}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: SPACING.xl }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={isTyping ? <TypingIndicator /> : null}
      />

      <View style={{ paddingBottom: insets.bottom }}>
        {messages.length <= 1 && !isTyping && (
          <SuggestedPrompts onSelect={sendMessage} />
        )}
        <ChatInput 
          onSend={sendMessage} 
          isTyping={isTyping} 
          onAttachmentPress={() => Alert.alert("Attachment", "Screenshot analysis will be available in the next sync.")}
          onVoicePress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  headerBtn: {
    padding: SPACING.xs,
  },
  listContent: { 
    paddingTop: SPACING.md,
    gap: SPACING.xs, 
  },
});
