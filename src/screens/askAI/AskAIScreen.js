import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { History, PlusCircle, Mic, Send, Circle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import { HOME_ROUTES } from '../../navigation/routeNames';
import { getGroqApiKey } from '../../services/settingsStorage';
import {
  ACTION_QUEUE_KEY,
  getSuggestedPrompts,
  sendChatMessage,
} from '../../services/askAIService';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../../constants/storageKeys';

import ChatMessage from '../../components/ChatMessage';

const ASK_AI_HISTORY_KEY = STORAGE_KEYS.ASKAI_HISTORY;
const ASK_AI_SESSION_INDEX_KEY = STORAGE_KEYS.ASKAI_SESSION_INDEX;
const ASK_AI_SESSION_PREFIX = STORAGE_KEYS.ASKAI_SESSION_PREFIX;
const MAX_STORED_MESSAGES = 30;
const MAX_RESTORED_MESSAGES = 20;
const ESTIMATED_MESSAGE_HEIGHT = 140;
const INPUT_MIN_HEIGHT = 44;
const INPUT_MAX_HEIGHT = 112;

function createMessage(role, content, extra = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function safeParse(rawValue, fallback) {
  if (!rawValue) return fallback;
  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

async function getWithLegacyMigration(primaryKey, legacyKeys = []) {
  const currentRaw = await AsyncStorage.getItem(primaryKey);
  if (currentRaw !== null) {
    return currentRaw;
  }

  for (const legacyKey of legacyKeys) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (legacyRaw !== null) {
      await AsyncStorage.setItem(primaryKey, legacyRaw);
      return legacyRaw;
    }
  }

  return null;
}

async function transcribeAudioWithGroq(audioUri) {
  const key = (await getGroqApiKey()) || (__DEV__ ? process.env.EXPO_PUBLIC_GROQ_API_KEY : null);
  if (!key) {
    throw new Error('No Groq API key found. Add one in Profile settings.');
  }

  const body = new FormData();
  body.append('file', {
    uri: audioUri,
    name: 'ask-ai-recording.m4a',
    type: 'audio/m4a',
  });
  body.append('model', 'whisper-large-v3');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Transcription failed (${response.status}): ${errorBody}`);
  }

  const payload = await response.json();
  return String(payload?.text || '').trim();
}

export default function AskAIScreen({ navigation }) {
  const { palette, getCategoryBadge } = useTheme();
  const insets = useSafeAreaInsets();

  const [conversationHistory, setConversationHistory] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [allItems, setAllItems] = useState([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);
  const [historySessions, setHistorySessions] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [activeSessionKey, setActiveSessionKey] = useState(null);
  const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recording, setRecording] = useState(null);

  const recordingPulse = useRef(new Animated.Value(0.35)).current;
  const flatListRef = useRef(null);

  const reversedMessages = useMemo(
    () => [...conversationHistory].reverse(),
    [conversationHistory]
  );

  const loadHistorySessions = useCallback(async () => {
    const rawIndex = await getWithLegacyMigration(
      ASK_AI_SESSION_INDEX_KEY,
      LEGACY_STORAGE_KEYS.ASKAI_SESSION_INDEX || []
    );
    const parsedIndex = safeParse(rawIndex, []);
    const sessions = Array.isArray(parsedIndex)
      ? parsedIndex.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      : [];
    setHistorySessions(sessions);
  }, []);

  const persistConversation = useCallback(async (messages, sessionKey) => {
    const trimmed = messages.slice(-MAX_STORED_MESSAGES);
    await AsyncStorage.setItem(ASK_AI_HISTORY_KEY, JSON.stringify(trimmed));

    if (!sessionKey) return;

    await AsyncStorage.setItem(sessionKey, JSON.stringify(trimmed));
    const firstUserMessage = trimmed.find((msg) => msg.role === 'user');

    const rawIndex = await AsyncStorage.getItem(ASK_AI_SESSION_INDEX_KEY);
    const currentIndex = safeParse(rawIndex, []);
    const nextEntry = {
      key: sessionKey,
      timestamp: Number(sessionKey.replace(ASK_AI_SESSION_PREFIX, '')) || Date.now(),
      preview: firstUserMessage?.content || 'Conversation',
    };

    const withoutDupes = (Array.isArray(currentIndex) ? currentIndex : []).filter((item) => item?.key !== sessionKey);
    const nextIndex = [nextEntry, ...withoutDupes]
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 100);
    await AsyncStorage.setItem(ASK_AI_SESSION_INDEX_KEY, JSON.stringify(nextIndex));
    setHistorySessions(nextIndex);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const rawItems = await AsyncStorage.getItem(ACTION_QUEUE_KEY);
      const parsedItems = safeParse(rawItems, []);
      const itemArray = Array.isArray(parsedItems) ? parsedItems : [];
      setAllItems(itemArray);
      setSuggestedPrompts(getSuggestedPrompts(itemArray));

      const rawHistory = await getWithLegacyMigration(
        ASK_AI_HISTORY_KEY,
        LEGACY_STORAGE_KEYS.ASKAI_HISTORY || []
      );
      const parsedHistory = safeParse(rawHistory, []);
      const restored = Array.isArray(parsedHistory)
        ? parsedHistory.slice(-MAX_RESTORED_MESSAGES)
        : [];
      setConversationHistory(restored);

      await loadHistorySessions();
    };

    bootstrap();
  }, [loadHistorySessions]);

  useEffect(() => {
    if (!isRecording) {
      recordingPulse.stopAnimation();
      recordingPulse.setValue(0.35);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(recordingPulse, {
          toValue: 1,
          duration: 540,
          useNativeDriver: true,
        }),
        Animated.timing(recordingPulse, {
          toValue: 0.35,
          duration: 540,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [isRecording, recordingPulse]);

  const beginRecording = useCallback(async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone permission required', 'Enable microphone access to use voice input.');
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const result = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    setRecording(result.recording);
    setIsRecording(true);
  }, []);

  const endRecordingAndTranscribe = useCallback(async () => {
    if (!recording) return;

    setIsRecording(false);
    setIsTranscribing(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (!uri) {
        throw new Error('Recording file was not available.');
      }

      const transcript = await transcribeAudioWithGroq(uri);
      if (transcript) {
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    } catch (error) {
      Alert.alert('Transcription error', 'Could not transcribe your voice note. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  }, [recording]);

  const onVoicePress = useCallback(async () => {
    if (isTranscribing) return;
    if (isRecording) {
      await endRecordingAndTranscribe();
      return;
    }

    await beginRecording();
  }, [beginRecording, endRecordingAndTranscribe, isRecording, isTranscribing]);

  const onSend = useCallback(async (promptText) => {
    const trimmed = String(promptText || '').trim();
    if (!trimmed || isLoading) return;

    const userMessage = createMessage('user', trimmed);
    const loadingMessage = createMessage('assistant', '', { isLoading: true });
    const existingHistory = [...conversationHistory];
    const optimistic = [...existingHistory, userMessage, loadingMessage];

    setConversationHistory(optimistic);
    setInputText('');
    setInputHeight(INPUT_MIN_HEIGHT);
    setIsLoading(true);

    const sessionKey = activeSessionKey || `${ASK_AI_SESSION_PREFIX}${Date.now()}`;
    if (!activeSessionKey) {
      setActiveSessionKey(sessionKey);
    }

    try {
      const { reply, matchedItems, itemCount } = await sendChatMessage(existingHistory, trimmed, allItems);
      const assistantMessage = createMessage('assistant', reply, {
        matchedItems,
        itemCount,
      });

      const nextConversation = [...existingHistory, userMessage, assistantMessage].slice(-MAX_STORED_MESSAGES);
      setConversationHistory(nextConversation);
      await persistConversation(nextConversation, sessionKey);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const fallback = createMessage('assistant', 'Something went wrong — try again');
      const nextConversation = [...existingHistory, userMessage, fallback].slice(-MAX_STORED_MESSAGES);
      setConversationHistory(nextConversation);
      await persistConversation(nextConversation, sessionKey);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionKey, allItems, conversationHistory, isLoading, persistConversation]);

  const onPromptPress = useCallback((prompt) => {
    setInputText(prompt);
  }, []);

  const handleNewChat = () => {
    Alert.alert(
      'Start a new conversation?',
      'Your history will still be accessible.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start New',
          onPress: () => {
            setConversationHistory([]);
            setActiveSessionKey(null);
            setSuggestedPrompts(getSuggestedPrompts(allItems));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  };

  const openHistory = useCallback(async () => {
    await loadHistorySessions();
    setShowHistoryModal(true);
  }, [loadHistorySessions]);

  const loadSession = useCallback(async (sessionKey) => {
    const raw = await AsyncStorage.getItem(sessionKey);
    const parsed = safeParse(raw, []);
    const messages = Array.isArray(parsed) ? parsed.slice(-MAX_RESTORED_MESSAGES) : [];

    setConversationHistory(messages);
    setActiveSessionKey(sessionKey);
    setShowHistoryModal(false);
    await AsyncStorage.setItem(ASK_AI_HISTORY_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  }, []);

  useEffect(() => {
    if (!flatListRef.current) return;
    flatListRef.current.scrollToOffset({ offset: 0, animated: true });
  }, [conversationHistory.length]);

  const renderMessage = useCallback(({ item }) => (
    <ChatMessage
      message={item}
      theme={{ palette, getCategoryBadge }}
      onItemPress={(selectedItem) => navigation.navigate(HOME_ROUTES.DETAIL, { item: selectedItem, itemId: selectedItem?.id })}
    />
  ), [getCategoryBadge, navigation, palette]);

  const getItemLayout = useCallback((_, index) => ({
    length: ESTIMATED_MESSAGE_HEIGHT,
    offset: ESTIMATED_MESSAGE_HEIGHT * index,
    index,
  }), []);

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + SPACING.sm, backgroundColor: palette.background }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary }]}>Ask your screenshots</Text>
          <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>LaterLens AI Assistant</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={openHistory}
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom : 0}
    >
      {renderHeader()}

      <FlatList
        ref={flatListRef}
        data={reversedMessages}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        getItemLayout={getItemLayout}
      />

      {conversationHistory.length === 0 && (
        <View style={styles.promptSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptContent}>
            {suggestedPrompts.map((prompt) => (
              <Pressable
                key={prompt}
                onPress={() => onPromptPress(prompt)}
                style={({ pressed }) => [
                  styles.promptChip,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[TYPOGRAPHY.caption, { color: palette.textPrimary }]}>{prompt}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={[styles.inputContainer, { borderTopColor: palette.border, paddingBottom: insets.bottom + SPACING.sm }]}> 
        <View style={[styles.inputRow, { backgroundColor: palette.card, borderColor: palette.border }]}> 
          <TextInput
            style={[
              styles.textInput,
              {
                color: palette.textPrimary,
                height: Math.min(INPUT_MAX_HEIGHT, Math.max(INPUT_MIN_HEIGHT, inputHeight)),
              },
            ]}
            placeholder="Ask anything about your saved screenshots"
            placeholderTextColor={palette.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1200}
            onContentSizeChange={(event) => {
              const nextHeight = event.nativeEvent.contentSize.height + 10;
              setInputHeight(Math.min(INPUT_MAX_HEIGHT, Math.max(INPUT_MIN_HEIGHT, nextHeight)));
            }}
          />

          <Pressable
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={onVoicePress}
            disabled={isTranscribing}
          >
            <Mic size={18} color={isRecording ? palette.urgencyRed : palette.textSecondary} />
            {isRecording ? (
              <Animated.View style={[styles.recordingDotWrap, { opacity: recordingPulse }]}> 
                <Circle size={8} fill={palette.urgencyRed} color={palette.urgencyRed} />
              </Animated.View>
            ) : null}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: inputText.trim() ? palette.primary : palette.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={() => onSend(inputText)}
            disabled={!inputText.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={palette.toastText} />
            ) : (
              <Send size={16} color={palette.toastText} />
            )}
          </Pressable>
        </View>

        {(isTranscribing || isRecording) && (
          <Text style={[TYPOGRAPHY.tiny, styles.voiceCaption, { color: palette.textSecondary }]}>
            {isRecording ? 'Recording... tap mic to stop' : 'Transcribing voice note...'}
          </Text>
        )}
      </View>

      <Modal
        visible={showHistoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: palette.overlayBg }]}> 
          <View style={[styles.modalSheet, { backgroundColor: palette.card, borderColor: palette.border }]}> 
            <View style={styles.modalHeader}>
              <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary }]}>Conversation History</Text>
              <Pressable onPress={() => setShowHistoryModal(false)}>
                <Text style={[TYPOGRAPHY.caption, { color: palette.primary }]}>Close</Text>
              </Pressable>
            </View>

            <FlatList
              data={historySessions}
              keyExtractor={(item) => item.key}
              getItemLayout={(_, index) => ({ length: 72, offset: 72 * index, index })}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => loadSession(item.key)}
                  style={({ pressed }) => [
                    styles.sessionRow,
                    { borderBottomColor: palette.border, opacity: pressed ? 0.65 : 1 },
                  ]}
                >
                  <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary }]}> 
                    {new Date(item.timestamp).toLocaleString()}
                  </Text>
                  <Text style={[TYPOGRAPHY.body, { color: palette.textPrimary }]} numberOfLines={1}>
                    {item.preview}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary, padding: SPACING.md }]}>No saved sessions yet.</Text>
              }
            />
          </View>
        </View>
      </Modal>
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
    paddingBottom: SPACING.md,
  },
  promptSection: {
    paddingBottom: SPACING.sm,
  },
  promptContent: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  promptChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    maxWidth: 280,
  },
  inputContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  inputRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  textInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    paddingRight: SPACING.sm,
    textAlignVertical: 'top',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  recordingDotWrap: {
    position: 'absolute',
    right: 4,
    top: 6,
  },
  voiceCaption: {
    marginTop: 4,
    paddingLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  modalSheet: {
    maxHeight: '70%',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  sessionRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 72,
    justifyContent: 'center',
  },
});
