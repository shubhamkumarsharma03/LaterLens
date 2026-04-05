import { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../constants/storageKeys';

const ChatContext = createContext(null);

const STORAGE_KEY = STORAGE_KEYS.CHAT_HISTORY;

async function getHistoryWithMigration() {
  const currentRaw = await AsyncStorage.getItem(STORAGE_KEY);
  if (currentRaw !== null) {
    return currentRaw;
  }

  for (const legacyKey of LEGACY_STORAGE_KEYS.CHAT_HISTORY || []) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (legacyRaw !== null) {
      await AsyncStorage.setItem(STORAGE_KEY, legacyRaw);
      return legacyRaw;
    }
  }

  return null;
}

const INITIAL_STATE = {
  messages: [],
  isLoading: true,
};

const CHAT_ACTIONS = {
  SET_MESSAGES: 'SET_MESSAGES',
  ADD_MESSAGE: 'ADD_MESSAGE',
  CLEAR_HISTORY: 'CLEAR_HISTORY',
  SET_LOADING: 'SET_LOADING',
};

function chatReducer(state, action) {
  switch (action.type) {
    case CHAT_ACTIONS.SET_MESSAGES:
      return { ...state, messages: action.payload, isLoading: false };
    case CHAT_ACTIONS.ADD_MESSAGE:
      return { ...state, messages: [...state.messages, action.payload] };
    case CHAT_ACTIONS.CLEAR_HISTORY:
      return { ...state, messages: [], isLoading: false };
    case CHAT_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(chatReducer, INITIAL_STATE);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const stored = await getHistoryWithMigration();
      if (stored) {
        dispatch({ type: CHAT_ACTIONS.SET_MESSAGES, payload: JSON.parse(stored) });
      } else {
        dispatch({
          type: CHAT_ACTIONS.SET_MESSAGES,
          payload: [
            {
              id: 'initial',
              text: 'Hi! I have your entire screenshot library memorized. What are you looking for?',
              sender: 'ai',
              timestamp: Date.now(),
            },
          ],
        });
      }
    } catch (e) {
      console.error('Failed to load chat history', e);
      dispatch({ type: CHAT_ACTIONS.SET_LOADING, payload: false });
    }
  };

  const saveHistory = async (messages) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error('Failed to save chat history', e);
    }
  };

  const addMessage = useCallback(async (message) => {
    dispatch({ type: CHAT_ACTIONS.ADD_MESSAGE, payload: message });
  }, []);

  // Update storage whenever messages change (except initial load)
  useEffect(() => {
    if (!state.isLoading) {
      saveHistory(state.messages);
    }
  }, [state.messages, state.isLoading]);

  const clearHistory = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    for (const legacyKey of LEGACY_STORAGE_KEYS.CHAT_HISTORY || []) {
      await AsyncStorage.removeItem(legacyKey);
    }
    dispatch({ type: CHAT_ACTIONS.CLEAR_HISTORY });
  }, []);

  const value = {
    messages: state.messages,
    isLoading: state.isLoading,
    addMessage,
    clearHistory,
    loadHistory,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
