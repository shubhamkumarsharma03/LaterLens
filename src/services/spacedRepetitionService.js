import AsyncStorage from '@react-native-async-storage/async-storage';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../constants/storageKeys';

const ACTION_QUEUE_KEY = STORAGE_KEYS.ACTION_ITEMS;
const MAX_HISTORY_ENTRIES = 50;
const MAX_DAILY_QUEUE = 20;

export const SR_DEFAULTS = {
  srEnabled: false,
  srInterval: 1,
  srEaseFactor: 2.5,
  srRepetitions: 0,
  srNextReviewDate: null,
  srLastReviewDate: null,
  srLastRating: null,
  srHistory: [],
};

function toLocalDateString(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayDateString() {
  return toLocalDateString(new Date());
}

function toDateString(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return toLocalDateString(parsed);
}

function addDaysToDateString(dateString, days) {
  const start = new Date(`${dateString}T00:00:00`);
  start.setDate(start.getDate() + days);
  return toLocalDateString(start);
}

function clampRating(rating) {
  if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
    throw new Error('Rating must be an integer between 0 and 5.');
  }
}

async function getAllItems() {
  let raw = await AsyncStorage.getItem(ACTION_QUEUE_KEY);
  if (raw === null) {
    for (const legacyKey of LEGACY_STORAGE_KEYS.ACTION_ITEMS || []) {
      raw = await AsyncStorage.getItem(legacyKey);
      if (raw !== null) {
        await AsyncStorage.setItem(ACTION_QUEUE_KEY, raw);
        break;
      }
    }
  }
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

async function saveAllItems(items) {
  await AsyncStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(Array.isArray(items) ? items : []));
}

async function persistUpdatedItem(item) {
  const items = await getAllItems();
  const existingIndex = items.findIndex((existing) => existing?.id === item?.id);
  const nextItems = [...items];

  if (existingIndex === -1) {
    nextItems.push(item);
  } else {
    nextItems[existingIndex] = item;
  }

  await saveAllItems(nextItems);
}

function normalizeStudyCategory(item) {
  return item?.category || item?.contentType || '';
}

export async function enrollItemInSR(item) {
  const category = normalizeStudyCategory(item);
  if (category !== 'Study Material') {
    return { success: false, reason: 'wrong_category' };
  }

  if (item?.ocrConfidence === 'low') {
    // Low-confidence OCR may be garbled, which creates unreliable study cards.
    return { success: false, reason: 'low_ocr_confidence' };
  }

  if (item?.srEnabled) {
    return { success: false, reason: 'already_enrolled' };
  }

  const today = getTodayDateString();
  const updatedItem = {
    ...SR_DEFAULTS,
    ...item,
    srEnabled: true,
    srNextReviewDate: today,
    srInterval: item?.srInterval || SR_DEFAULTS.srInterval,
    srEaseFactor: item?.srEaseFactor || SR_DEFAULTS.srEaseFactor,
    srRepetitions: item?.srRepetitions || SR_DEFAULTS.srRepetitions,
    srHistory: Array.isArray(item?.srHistory) ? item.srHistory : [],
  };

  await persistUpdatedItem(updatedItem);

  return { success: true, reason: '' };
}

export async function processRating(item, rating) {
  clampRating(rating);

  const today = getTodayDateString();
  const previousInterval = Number(item?.srInterval || SR_DEFAULTS.srInterval);
  const previousEaseFactor = Number(item?.srEaseFactor || SR_DEFAULTS.srEaseFactor);
  const repetitions = Number(item?.srRepetitions || 0);

  let newInterval = 1;
  let newEaseFactor = previousEaseFactor;
  let newRepetitions = repetitions;

  if (rating >= 3) {
    // First successful recall stays at 1 day by SM-2 definition.
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      // Second successful recall jumps to 6 days.
      newInterval = 6;
    } else {
      // Subsequent intervals scale by ease factor and are rounded to whole days.
      newInterval = Math.round(previousInterval * previousEaseFactor);
    }

    // SM-2 ease-factor update formula based on quality rating.
    const q = 5 - rating;
    const nextEase = previousEaseFactor + (0.1 - q * (0.08 + q * 0.02));
    // Ease factor floor prevents intervals from collapsing too aggressively.
    newEaseFactor = Math.max(1.3, nextEase);
    newRepetitions = repetitions + 1;
  } else {
    // Failed recall resets interval and repetition count for next-day relearning.
    newInterval = 1;
    newRepetitions = 0;
    // Ease factor intentionally remains unchanged on failed recall.
  }

  const newNextReviewDate = addDaysToDateString(today, newInterval);
  const priorHistory = Array.isArray(item?.srHistory) ? item.srHistory : [];
  const nextHistory = [
    ...priorHistory,
    {
      date: today,
      rating,
      intervalAfter: newInterval,
    },
  ];

  const trimmedHistory =
    nextHistory.length > MAX_HISTORY_ENTRIES
      ? nextHistory.slice(nextHistory.length - MAX_HISTORY_ENTRIES)
      : nextHistory;

  const updatedItem = {
    ...item,
    srEnabled: true,
    srInterval: newInterval,
    srEaseFactor: newEaseFactor,
    srRepetitions: newRepetitions,
    srNextReviewDate: newNextReviewDate,
    srLastReviewDate: today,
    srLastRating: rating,
    srHistory: trimmedHistory,
  };

  await persistUpdatedItem(updatedItem);
  return updatedItem;
}

export async function getTodaysQueue() {
  const today = getTodayDateString();
  const items = await getAllItems();

  const due = items
    .filter((item) => {
      const nextReviewDate = toDateString(item?.srNextReviewDate);
      return item?.srEnabled === true && !!nextReviewDate && nextReviewDate <= today;
    })
    .sort((a, b) => {
      const dateA = toDateString(a?.srNextReviewDate) || '9999-12-31';
      const dateB = toDateString(b?.srNextReviewDate) || '9999-12-31';
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      const easeA = Number(a?.srEaseFactor || SR_DEFAULTS.srEaseFactor);
      const easeB = Number(b?.srEaseFactor || SR_DEFAULTS.srEaseFactor);
      return easeA - easeB;
    });

  // Cap sessions at 20 cards to limit cognitive load and prevent fatigue.
  return due.slice(0, MAX_DAILY_QUEUE);
}

function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function computeLongestStreak(dateKeys) {
  if (dateKeys.length === 0) return 0;

  const sorted = [...new Set(dateKeys)].sort();
  let longest = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const expected = addDaysToDateString(previous, 1);
    if (sorted[i] === expected) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

export async function getStudyStats() {
  const today = getTodayDateString();
  const items = await getAllItems();
  const enrolled = items.filter((item) => item?.srEnabled === true);

  const dueToday = enrolled.filter((item) => {
    const nextReviewDate = toDateString(item?.srNextReviewDate);
    return !!nextReviewDate && nextReviewDate <= today;
  }).length;

  const reviewedToday = enrolled.filter((item) => toDateString(item?.srLastReviewDate) === today).length;

  const easeTotal = enrolled.reduce(
    (acc, item) => acc + Number(item?.srEaseFactor || SR_DEFAULTS.srEaseFactor),
    0
  );

  const reviewDates = enrolled.flatMap((item) => {
    const historyDates = Array.isArray(item?.srHistory)
      ? item.srHistory.map((entry) => toDateString(entry?.date)).filter(Boolean)
      : [];
    const last = toDateString(item?.srLastReviewDate);
    return last ? [...historyDates, last] : historyDates;
  });

  return {
    totalEnrolled: enrolled.length,
    dueToday,
    reviewedToday,
    averageEaseFactor: enrolled.length > 0 ? roundToTwo(easeTotal / enrolled.length) : 0,
    masteredCount: enrolled.filter((item) => Number(item?.srRepetitions || 0) >= 5).length,
    strugglingCount: enrolled.filter(
      (item) => Number(item?.srEaseFactor ?? SR_DEFAULTS.srEaseFactor) <= 1.5
    ).length,
    longestStreak: computeLongestStreak(reviewDates),
  };
}

export async function autoEnrollNewStudyItems() {
  const items = await getAllItems();
  let enrolled = 0;
  let skipped = 0;

  for (const item of items) {
    const category = normalizeStudyCategory(item);
    const isStudyMaterial = category === 'Study Material';
    const notEnrolled = item?.srEnabled !== true;

    if (!isStudyMaterial || !notEnrolled) continue;

    if (item?.ocrConfidence === 'low') {
      skipped += 1;
      continue;
    }

    const result = await enrollItemInSR(item);
    if (result.success) {
      enrolled += 1;
    } else {
      skipped += 1;
    }
  }

  return { enrolled, skipped };
}

export function getRetentionEstimate(item) {
  const repetitions = Number(item?.srRepetitions || 0);

  if (repetitions <= 0) return '~40% retained';
  if (repetitions === 1) return '~60% retained';
  if (repetitions === 2) return '~75% retained';
  if (repetitions <= 4) return '~85% retained';
  return '~95% retained';
}
