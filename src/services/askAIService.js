import AsyncStorage from '@react-native-async-storage/async-storage';
import { getGroqApiKey } from './settingsStorage';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../constants/storageKeys';

export const ACTION_QUEUE_KEY = STORAGE_KEYS.ACTION_ITEMS;

const GROQ_CHAT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_CHAT_MODEL = 'llama-3.1-8b-instant';
const MAX_MATCHED_ITEMS = 50;
const MAX_HISTORY_TURNS = 10;

function toMillis(value) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function includesIgnoreCase(value, query) {
  return String(value || '').toLowerCase().includes(query.toLowerCase());
}

function isRangeInsideRedactedToken(text, start, end) {
  const redactedRegex = /\[REDACTED:[^\]]+\]/gi;
  let tokenMatch = redactedRegex.exec(text);

  while (tokenMatch) {
    const tokenStart = tokenMatch.index;
    const tokenEnd = tokenStart + tokenMatch[0].length;

    if (start < tokenEnd && end > tokenStart) return true;

    tokenMatch = redactedRegex.exec(text);
  }

  return false;
}

function hasSafeOcrMatch(text, query) {
  if (!text || !query) return false;

  const lowerText = String(text).toLowerCase();
  const lowerQuery = String(query).toLowerCase();
  let startIndex = lowerText.indexOf(lowerQuery);

  while (startIndex !== -1) {
    const endIndex = startIndex + lowerQuery.length;
    if (!isRangeInsideRedactedToken(text, startIndex, endIndex)) {
      return true;
    }
    startIndex = lowerText.indexOf(lowerQuery, startIndex + 1);
  }

  return false;
}

function sanitizeItemForGroq(item) {
  const {
    imagePath,
    ocrText,
    blockedBy,
    privacyGateVersion,
    ...safeFields
  } = item || {};

  return safeFields;
}

async function getApiKey() {
  const savedKey = await getGroqApiKey();
  if (savedKey) return savedKey;

  if (__DEV__) {
    return process.env.EXPO_PUBLIC_GROQ_API_KEY || null;
  }

  return null;
}

function trimToLastTurns(history, turnLimit = MAX_HISTORY_TURNS) {
  if (!Array.isArray(history) || history.length === 0) return [];

  const collected = [];
  let userCount = 0;

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const msg = history[i];
    if (!msg || (msg.role !== 'user' && msg.role !== 'assistant')) {
      continue;
    }

    collected.push(msg);
    if (msg.role === 'user') {
      userCount += 1;
      if (userCount >= turnLimit) {
        break;
      }
    }
  }

  return collected.reverse();
}

async function getActionItemsRawWithMigration() {
  const currentRaw = await AsyncStorage.getItem(ACTION_QUEUE_KEY);
  if (currentRaw !== null) {
    return currentRaw;
  }

  for (const legacyKey of LEGACY_STORAGE_KEYS.ACTION_ITEMS || []) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (legacyRaw !== null) {
      await AsyncStorage.setItem(ACTION_QUEUE_KEY, legacyRaw);
      return legacyRaw;
    }
  }

  return null;
}

export async function searchLocalItems(query, filters = {}, sourceItems) {
  let allItems = sourceItems;
  if (!Array.isArray(allItems)) {
    const rawQueue = await getActionItemsRawWithMigration();
    allItems = rawQueue ? JSON.parse(rawQueue) : [];
  }
  const queryText = String(query || '').trim();
  const normalizedQuery = queryText.toLowerCase();

  const safeItems = Array.isArray(allItems) ? allItems.filter((item) => {
    // Privacy boundary: never include blocked or local-only items in Groq context.
    if (item?.status === 'privacy_blocked') return false;
    if (item?.sentToAI === false) return false;
    return true;
  }) : [];

  const { category, status, dateFrom, dateTo } = filters || {};
  const fromMs = toMillis(dateFrom);
  const toMs = toMillis(dateTo);

  const filtered = safeItems.filter((item) => {
    if (category && item?.category !== category) return false;
    if (status && item?.status !== status) return false;

    const processedMs = toMillis(item?.processedAt);
    if (fromMs && processedMs < fromMs) return false;
    if (toMs && processedMs > toMs) return false;

    if (!normalizedQuery) return true;

    const inTitle = includesIgnoreCase(item?.title, normalizedQuery);
    const inSummary = includesIgnoreCase(item?.summary, normalizedQuery);
    const inCategory = includesIgnoreCase(item?.category, normalizedQuery);
    const inTags = Array.isArray(item?.tags)
      ? item.tags.some((tag) => includesIgnoreCase(tag, normalizedQuery))
      : false;

    const ocrText = String(item?.ocrText || '');
    const inOcr = hasSafeOcrMatch(ocrText, normalizedQuery);

    return inTitle || inSummary || inCategory || inTags || inOcr;
  });

  return filtered
    .sort((a, b) => toMillis(b?.processedAt) - toMillis(a?.processedAt))
    .slice(0, MAX_MATCHED_ITEMS);
}

export function buildGroqContext(userQuery, matchedItems) {
  const safeItems = (matchedItems || []).map(sanitizeItemForGroq);

  const systemPrompt = [
    'You are the LaterLens assistant. LaterLens is an AI-powered screenshot intelligence app.',
    'Each item is a processed screenshot summary created from OCR and on-device privacy checks.',
    'Only use the provided screenshot items as your source of truth. Do not use outside or general knowledge.',
    'Respond in plain conversational language.',
    'Do not use markdown formatting.',
    'Do not use bullet points unless the user explicitly asks for a list.',
    'When you reference specific evidence, cite the item by its title.',
    safeItems.length === 0
      ? 'No relevant items matched this query. Clearly say that no matching screenshots were found and ask a brief follow-up question.'
      : `Matched screenshot items JSON: ${JSON.stringify(safeItems)}`,
  ].join(' ');

  return {
    systemPrompt,
    userMessage: String(userQuery || '').trim(),
    itemCount: safeItems.length,
  };
}

export async function sendChatMessage(conversationHistory, userQuery, allItems) {
  const matchedItems = await searchLocalItems(userQuery, {}, allItems);
  const { systemPrompt, userMessage, itemCount } = buildGroqContext(userQuery, matchedItems);
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('No Groq API key found. Add one in Profile settings.');
  }

  const history = trimToLastTurns(Array.isArray(conversationHistory) ? conversationHistory : [])
    .map((msg) => ({
      role: msg.role,
      content: String(msg.content || ''),
    }));

  const response = await fetch(GROQ_CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage },
      ],
      max_tokens: 600,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq chat failed (${response.status}): ${errorBody}`);
  }

  const payload = await response.json();
  const reply = payload?.choices?.[0]?.message?.content?.trim();

  return {
    reply: reply || 'I could not generate a response right now.',
    matchedItems,
    itemCount,
  };
}

function getTopCategories(items) {
  const counts = items.reduce((acc, item) => {
    const key = item?.category || 'Other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

const CATEGORY_PROMPT_MAP = {
  Study: 'What study material did I save this week?',
  'Study Material': 'What study material did I save this week?',
  Product: 'What products am I thinking of buying?',
  Idea: 'Summarise my project ideas from this month',
  Code: 'What GitHub repos or tools did I save?',
  Event: 'What events or deadlines did I capture recently?',
  Receipt: 'What receipts did I save this week?',
};

export function getSuggestedPrompts(allItems) {
  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

  const safeItems = (Array.isArray(allItems) ? allItems : []).filter((item) => {
    // Privacy boundary: prompt generation must also ignore blocked/local-only records.
    if (item?.status === 'privacy_blocked') return false;
    if (item?.sentToAI === false) return false;

    const processedMs = toMillis(item?.processedAt);
    return processedMs >= sevenDaysAgo;
  });

  const topCategories = getTopCategories(safeItems);
  const prompts = [];

  for (const category of topCategories) {
    const prompt = CATEGORY_PROMPT_MAP[category];
    if (prompt && !prompts.includes(prompt)) {
      prompts.push(prompt);
    }
    if (prompts.length >= 3) break;
  }

  const defaults = [
    'What did I save yesterday?',
    'What important things did I save this week?',
    'What should I act on first from my saved screenshots?',
    'What patterns do you see in what I have been saving?',
  ];

  for (const fallback of defaults) {
    if (!prompts.includes(fallback)) {
      prompts.push(fallback);
    }
    if (prompts.length >= 4) break;
  }

  if (!prompts.includes('What did I save yesterday?')) {
    prompts[3] = 'What did I save yesterday?';
  }

  return prompts.slice(0, 4);
}
