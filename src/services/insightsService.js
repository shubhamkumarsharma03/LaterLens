import AsyncStorage from '@react-native-async-storage/async-storage';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../constants/storageKeys';

const ACTION_QUEUE_KEY = STORAGE_KEYS.ACTION_ITEMS;
const BULK_IMPORT_SUMMARY_KEY = STORAGE_KEYS.BULK_IMPORT_SUMMARY;
const STREAK_DATA_KEY = STORAGE_KEYS.STREAK_DATA;

const MS_IN_DAY = 24 * 60 * 60 * 1000;

function startOfDay(input) {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(input, days) {
  const date = startOfDay(input);
  date.setDate(date.getDate() + days);
  return date;
}

function getLocalDateString(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDateKey(value) {
  if (!value || typeof value !== 'string') return null;
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const localDate = new Date(year, month - 1, day);
  return Number.isNaN(localDate.getTime()) ? null : localDate;
}

function normalizeItem(item) {
  const processedAt = item?.processedAt || (item?.timestamp ? new Date(item.timestamp).toISOString() : null);
  const category = item?.category || item?.contentType || 'Idea';

  return {
    ...item,
    category,
    processedAt,
  };
}

function isValidDateString(value) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function roundToOne(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function toLocalDayKey(input) {
  return getLocalDateString(input);
}

function getDateDiffInDays(fromDate, toDate) {
  const from = startOfDay(fromDate).getTime();
  const to = startOfDay(toDate).getTime();
  return Math.floor((to - from) / MS_IN_DAY);
}

async function getItemWithLegacyMigration(primaryKey, legacyKeys = []) {
  const currentRaw = await AsyncStorage.getItem(primaryKey);
  if (currentRaw !== null) return currentRaw;

  for (const legacyKey of legacyKeys) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (legacyRaw !== null) {
      await AsyncStorage.setItem(primaryKey, legacyRaw);
      return legacyRaw;
    }
  }

  return null;
}

async function getAllItems() {
  const rawValue = await getItemWithLegacyMigration(
    ACTION_QUEUE_KEY,
    LEGACY_STORAGE_KEYS.ACTION_ITEMS || []
  );
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeItem);
  } catch (_error) {
    return [];
  }
}

function getItemsFromRange(items, fromDate) {
  const cutoff = startOfDay(fromDate).getTime();

  return items.filter((item) => {
    // Keep legacy items visible even when processedAt is missing.
    if (!item?.processedAt) {
      return true;
    }

    const itemDate = parseLocalDateKey(getLocalDateString(item.processedAt));
    if (!itemDate) {
      return false;
    }
    const itemTime = itemDate.getTime();
    return !Number.isNaN(itemTime) && itemTime >= cutoff;
  });
}

function getItemsBetweenDates(items, fromDate, toDate) {
  const from = startOfDay(fromDate).getTime();
  const to = startOfDay(toDate).getTime();

  return (Array.isArray(items) ? items : []).filter((item) => {
    if (!item?.processedAt) {
      return false;
    }

    const itemDate = parseLocalDateKey(getLocalDateString(item.processedAt));
    if (!itemDate) {
      return false;
    }
    const itemTime = itemDate.getTime();
    return !Number.isNaN(itemTime) && itemTime >= from && itemTime <= to;
  });
}

export async function getItemsForPeriod(period = 'week', sourceItems) {
  const items = Array.isArray(sourceItems) ? sourceItems : await getAllItems();

  if (period === 'alltime') {
    return items;
  }

  const today = startOfDay(new Date());
  const days = period === 'week' ? 7 : 30;
  const startDate = addDays(today, -days);

  return getItemsFromRange(items, startDate);
}

export async function getPreviousItemsForPeriod(period = 'week', sourceItems) {
  const items = Array.isArray(sourceItems) ? sourceItems : await getAllItems();

  if (period === 'alltime') {
    return [];
  }

  const today = startOfDay(new Date());
  const days = period === 'week' ? 7 : 30;
  const currentStart = addDays(today, -days);
  const previousStart = addDays(currentStart, -days);
  const previousEnd = addDays(currentStart, -1);

  return getItemsBetweenDates(items, previousStart, previousEnd);
}

export async function computeTopStats(items = [], previousPeriodItems = []) {
  const safeItems = Array.isArray(items) ? items : [];
  const previousItems = Array.isArray(previousPeriodItems) ? previousPeriodItems : [];

  const totalSaved = safeItems.length;
  const totalActedOn = safeItems.filter((item) => item?.status === 'completed').length;
  const completionRate = totalSaved > 0 ? roundToOne((totalActedOn / totalSaved) * 100) : 0;

  const completedDayKeys = new Set(
    safeItems
      .filter((item) => item?.status === 'completed' && isValidDateString(item?.processedAt))
      .map((item) => toLocalDayKey(item.processedAt))
      .filter(Boolean)
  );

  const queueClearedDays = completedDayKeys.size;
  const studyReviewed = safeItems.filter(
    (item) => item?.status === 'completed' && item?.category === 'Study Material'
  ).length;
  const privacyBlocked = safeItems.filter((item) => item?.status === 'privacy_blocked').length;
  const ocrFailed = safeItems.filter((item) => item?.status === 'ocr_failed').length;

  const previousTotalSaved = previousItems.length;
  const previousTotalActedOn = previousItems.filter((item) => item?.status === 'completed').length;
  const previousCompletionRate =
    previousTotalSaved > 0 ? roundToOne((previousTotalActedOn / previousTotalSaved) * 100) : 0;

  return {
    totalSaved,
    totalActedOn,
    completionRate,
    queueClearedDays,
    studyReviewed,
    privacyBlocked,
    ocrFailed,
    deltas: {
      totalSaved: totalSaved - previousTotalSaved,
      completionRate: roundToOne(completionRate - previousCompletionRate),
    },
  };
}

export async function computeCategoryBreakdown(items = []) {
  const safeItems = Array.isArray(items) ? items : [];
  const byCategory = {};

  safeItems.forEach((item) => {
    const category = item?.category || 'Idea';
    if (!byCategory[category]) {
      byCategory[category] = {
        category,
        savedCount: 0,
        actedOnCount: 0,
        completionRate: 0,
      };
    }

    byCategory[category].savedCount += 1;
    if (item?.status === 'completed') {
      byCategory[category].actedOnCount += 1;
    }
  });

  const result = Object.values(byCategory)
    .map((entry) => ({
      ...entry,
      completionRate:
        entry.savedCount > 0 ? roundToOne((entry.actedOnCount / entry.savedCount) * 100) : 0,
    }))
    .sort((a, b) => b.savedCount - a.savedCount);

  return result;
}

export async function computeTopInterests(items = []) {
  const safeItems = Array.isArray(items) ? items : [];

  const formatOxfordList = (values) => {
    if (!Array.isArray(values) || values.length === 0) return '';
    if (values.length === 1) return values[0];
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
  };

  if (safeItems.length < 5) {
    return 'Save more screenshots to see your interest patterns.';
  }

  const tagCounts = {};
  const categoryCounts = {};

  safeItems.forEach((item) => {
    const category = item?.category || 'Idea';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    const tags = Array.isArray(item?.tags) ? item.tags : [];
    tags.forEach((tag) => {
      const cleanTag = String(tag || '').trim();
      if (!cleanTag) return;
      const key = cleanTag.toLowerCase();

      if (!tagCounts[key]) {
        tagCounts[key] = {
          label: cleanTag,
          count: 0,
          categories: {},
        };
      }

      tagCounts[key].count += 1;
      tagCounts[key].categories[category] = (tagCounts[key].categories[category] || 0) + 1;
    });
  });

  const topTags = Object.values(tagCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((entry) => {
      const topCategory = Object.entries(entry.categories).sort((a, b) => b[1] - a[1])[0]?.[0];
      return topCategory ? `${entry.label} (${topCategory})` : entry.label;
    });

  if (topTags.length > 0) {
    return `Your top interests lately: ${formatOxfordList(topTags)}.`;
  }

  if (Object.keys(tagCounts).length === 0 && Object.keys(categoryCounts).length <= 1) {
    return 'Save more screenshots to see your interest patterns.';
  }

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category);

  return `Your top interests lately: ${formatOxfordList(topCategories)}.`;
}

export async function updateStreakData(streakData = null) {
  const defaults = {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: '',
    graceDaysUsed: 0,
    lastGraceDayUsed: '',
  };

  const current = {
    ...defaults,
    ...(streakData || {}),
  };

  if (!streakData) {
    await AsyncStorage.setItem(STREAK_DATA_KEY, JSON.stringify(current));
  }

  const allItems = await getAllItems();
  const today = new Date();
  const todayKey = toLocalDayKey(today);

  const hasCompletedQueueToday = allItems.some(
    (item) => item?.status === 'completed' && toLocalDayKey(item?.processedAt) === todayKey
  );
  const hasStudyReviewToday = allItems.some(
    (item) => item?.srEnabled === true && toLocalDayKey(item?.srLastReviewDate) === todayKey
  );
  const hasCompletedToday = hasCompletedQueueToday || hasStudyReviewToday;

  if (current.lastActiveDate === todayKey) {
    return current;
  }

  const lastActiveDate = current.lastActiveDate ? new Date(current.lastActiveDate) : null;
  const lastGraceDate = current.lastGraceDayUsed ? new Date(current.lastGraceDayUsed) : null;
  const daysSinceLastGrace = lastGraceDate ? getDateDiffInDays(lastGraceDate, today) : Infinity;
  let nextGraceDaysUsed = daysSinceLastGrace >= 7 ? 0 : current.graceDaysUsed;
  let nextCurrentStreak = current.currentStreak;
  let nextLastActiveDate = current.lastActiveDate;
  let nextLastGraceDayUsed = current.lastGraceDayUsed || '';

  if (hasCompletedToday) {
    if (lastActiveDate) {
      const daysDiff = getDateDiffInDays(lastActiveDate, today);

      if (daysDiff === 0) {
        nextCurrentStreak = current.currentStreak;
      } else if (daysDiff === 1) {
        nextCurrentStreak = current.currentStreak + 1;
      } else if (daysDiff === 2) {
        if (nextGraceDaysUsed < 1) {
          nextGraceDaysUsed += 1;
          nextCurrentStreak = current.currentStreak + 1;
          nextLastGraceDayUsed = todayKey;
        } else {
          nextCurrentStreak = 1;
          nextGraceDaysUsed = 0;
          nextLastGraceDayUsed = '';
        }
      } else {
        nextCurrentStreak = 1;
        nextGraceDaysUsed = 0;
        nextLastGraceDayUsed = '';
      }
    } else {
      nextCurrentStreak = 1;
      nextGraceDaysUsed = 0;
      nextLastGraceDayUsed = '';
    }

    nextLastActiveDate = todayKey;
  }

  const updated = {
    currentStreak: nextCurrentStreak,
    longestStreak: Math.max(current.longestStreak, nextCurrentStreak),
    lastActiveDate: nextLastActiveDate,
    graceDaysUsed: nextGraceDaysUsed,
    lastGraceDayUsed: nextLastGraceDayUsed,
  };

  await AsyncStorage.setItem(STREAK_DATA_KEY, JSON.stringify(updated));
  return updated;
}

export async function computeBacklogSize(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const sevenDaysAgo = Date.now() - 7 * MS_IN_DAY;

  const backlogCount = safeItems.filter((item) => {
    const isPending = item?.status === 'pending' || item?.status === 'queued';
    if (!isPending || !isValidDateString(item?.processedAt)) {
      return false;
    }

    return new Date(item.processedAt).getTime() < sevenDaysAgo;
  }).length;

  let severity = 'ok';
  if (backlogCount >= 30) {
    severity = 'critical';
  } else if (backlogCount >= 10) {
    severity = 'warning';
  }

  return {
    backlogCount,
    severity,
  };
}

export async function generateWeeklySummary(currentPeriodStats = {}, previousPeriodStats = {}) {
  const current = currentPeriodStats || {};
  const previous = previousPeriodStats || {};

  const currentSaved = Math.round(current.totalSaved || 0);
  const currentActed = Math.round(current.totalActedOn || 0);
  const currentDays = Math.round(current.queueClearedDays || 0);
  const previousSaved = Math.round(previous.totalSaved || 0);
  const previousActed = Math.round(previous.totalActedOn || 0);
  const previousDays = Math.round(previous.queueClearedDays || 0);

  if (currentDays >= 5 && currentDays > previousDays) {
    return `You cleared your queue ${currentDays} days last week - a new record.`;
  }

  if (currentSaved >= previousSaved && currentActed >= previousActed && currentSaved >= 10) {
    return `Last week you saved ${currentSaved} things and acted on ${currentActed} - your best week yet.`;
  }

  return `Quieter week - ${currentSaved} screenshots saved, ${currentActed} acted on.`;
}

export async function getLastBulkImportSummary() {
  const raw = await getItemWithLegacyMigration(
    BULK_IMPORT_SUMMARY_KEY,
    LEGACY_STORAGE_KEYS.BULK_IMPORT_SUMMARY || []
  );
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

export async function getStreakData() {
  const raw = await getItemWithLegacyMigration(
    STREAK_DATA_KEY,
    LEGACY_STORAGE_KEYS.STREAK_DATA || []
  );
  if (!raw) {
    const defaults = {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: '',
      graceDaysUsed: 0,
      lastGraceDayUsed: '',
    };
    await AsyncStorage.setItem(STREAK_DATA_KEY, JSON.stringify(defaults));
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      currentStreak: Math.max(0, Number(parsed.currentStreak) || 0),
      longestStreak: Math.max(0, Number(parsed.longestStreak) || 0),
      lastActiveDate: parsed.lastActiveDate || '',
      graceDaysUsed: Math.max(0, Number(parsed.graceDaysUsed) || 0),
      lastGraceDayUsed: parsed.lastGraceDayUsed || '',
    };
  } catch (_error) {
    const defaults = {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: '',
      graceDaysUsed: 0,
      lastGraceDayUsed: '',
    };
    await AsyncStorage.setItem(STREAK_DATA_KEY, JSON.stringify(defaults));
    return defaults;
  }
}

export async function getAllInsightsItems() {
  return getAllItems();
}
