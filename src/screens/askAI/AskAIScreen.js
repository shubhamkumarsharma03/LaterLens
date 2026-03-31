import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, Sparkles } from 'lucide-react-native';
import { useQueue } from '../../state/QueueContext';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import { queryScreenshotLibrary } from '../../services/aiProcessingEngine';
import * as Haptics from 'expo-haptics';

export default function AskAIScreen() {
  const { allItems } = useQueue();
  const theme = useTheme();
  const { palette, isDark } = theme;
  const insets = useSafeAreaInsets();
  
  const [messages, setMessages] = useState([
    { id: 'initial', text: "Hi! I have your entire screenshot library memorized. What are you looking for?", sender: 'ai' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userText = input.trim();
    setInput('');
    Keyboard.dismiss();

    const newMessages = [...messages, { id: Date.now().toString(), text: userText, sender: 'user' }];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const responseText = await queryScreenshotLibrary(userText, allItems);
      setMessages((prev) => [...prev, { id: Date.now().toString(), text: responseText, sender: 'ai' }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setMessages((prev) => [...prev, { id: Date.now().toString(), text: "Sorry, I ran into an error accessing your library.", sender: 'error' }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsTyping(false);
    }
  };

  const renderBubble = ({ item }) => {
    const isUser = item.sender === 'user';
    const isError = item.sender === 'error';
    
    return (
      <View style={[styles.bubbleWrapper, isUser ? styles.bubbleUserWrap : styles.bubbleAiWrap]}>
        {!isUser && (
          <View style={[styles.aiAvatar, { backgroundColor: palette.primaryLight }]}>
            <Sparkles size={14} color={palette.primary} />
          </View>
        )}
        <View style={[
          styles.bubble, 
          isUser ? [styles.bubbleUser, { backgroundColor: palette.primary }] : [styles.bubbleAi, { backgroundColor: palette.card, borderColor: palette.border }],
          isError && { borderColor: '#EF4444', backgroundColor: '#FEF2F2' }
        ]}>
          <Text style={[TYPOGRAPHY.body, { color: isUser ? '#FFFFFF' : isError ? '#EF4444' : palette.textPrimary }]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: palette.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: palette.background }]}>
        <Text style={[TYPOGRAPHY.heroTitle, { color: palette.textPrimary, paddingHorizontal: SPACING.md }]}>Ask AI</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(i) => i.id}
        renderItem={renderBubble}
        contentContainerStyle={[styles.listContent, { paddingBottom: SPACING.xl }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + SPACING.md, backgroundColor: palette.card, borderTopColor: palette.border }]}>
        <TextInput
          style={[styles.input, { color: palette.textPrimary, backgroundColor: palette.background, borderColor: palette.border }]}
          placeholder="e.g., What was the recipe about?"
          placeholderTextColor={palette.textSecondary}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <Pressable 
          style={({ pressed }) => [styles.sendButton, { backgroundColor: palette.primary, opacity: pressed || input.trim().length === 0 ? 0.7 : 1 }]}
          onPress={sendMessage}
          disabled={input.trim().length === 0 || isTyping}
        >
          {isTyping ? <ActivityIndicator color="#FFF" size="small" /> : <Send size={18} color="#FFF" style={{ marginLeft: -2 }} />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: SPACING.sm, zIndex: 10 },
  listContent: { padding: SPACING.md, gap: SPACING.md },
  
  bubbleWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: SPACING.sm },
  bubbleUserWrap: { justifyContent: 'flex-end' },
  bubbleAiWrap: { justifyContent: 'flex-start' },
  
  aiAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  bubble: { maxWidth: '80%', padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth },
  
  bubbleUser: { borderBottomRightRadius: 4, borderWidth: 0 },
  bubbleAi: { borderBottomLeftRadius: 4 },
  
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, paddingHorizontal: SPACING.md, height: 44, borderRadius: RADIUS.pill, borderWidth: StyleSheet.hairlineWidth, marginRight: SPACING.sm },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }
});
