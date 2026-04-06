jest.mock('@react-native-async-storage/async-storage', () => {
  const store = {};

  return {
    __store: store,
    getItem: jest.fn(async (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null)),
    setItem: jest.fn(async (key, value) => {
      store[key] = value;
    }),
    removeItem: jest.fn(async (key) => {
      delete store[key];
    }),
    clear: jest.fn(async () => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
  };
});

const AsyncStorage = require('@react-native-async-storage/async-storage');
const { STORAGE_KEYS } = require('../../constants/storageKeys');
const {
  SR_DEFAULTS,
  addDays,
  enrollItemInSR,
  getTodayString,
  getTodaysQueue,
  processRating,
} = require('../spacedRepetitionService');
const { updateStreakData } = require('../insightsService');

const ACTION_ITEMS_KEY = STORAGE_KEYS.ACTION_ITEMS;

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function makeStudyItem(overrides = {}) {
  return {
    id: overrides.id || 'study-item-1',
    category: 'Study Material',
    srEnabled: true,
    srInterval: 1,
    srEaseFactor: SR_DEFAULTS.srEaseFactor,
    srRepetitions: 0,
    srNextReviewDate: getTodayString(),
    srLastReviewDate: null,
    srHistory: [],
    ...overrides,
  };
}

describe('spacedRepetitionService SM-2 behavior', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-05T10:00:00Z'));
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('interval is 1 after first successful review', async () => {
    const item = makeStudyItem({ srRepetitions: 0, srInterval: 1, srEaseFactor: 2.5 });
    const result = await processRating(item, 5);
    expect(result.srInterval).toBe(1);
  });

  test('interval is 6 after second successful review', async () => {
    const first = await processRating(makeStudyItem({ srRepetitions: 0, srInterval: 1, srEaseFactor: 2.5 }), 5);
    const second = await processRating(first, 5);
    expect(second.srInterval).toBe(6);
  });

  test('interval is round(6 * 2.5) = 15 after third review with default EF baseline', async () => {
    const item = makeStudyItem({ srRepetitions: 2, srInterval: 6, srEaseFactor: 2.5 });
    const result = await processRating(item, 5);
    expect(result.srInterval).toBe(15);
  });

  test('rating 0 resets interval to 1', async () => {
    const result = await processRating(makeStudyItem({ srRepetitions: 4, srInterval: 18, srEaseFactor: 2.2 }), 0);
    expect(result.srInterval).toBe(1);
  });

  test('rating 0 resets repetitions to 0', async () => {
    const result = await processRating(makeStudyItem({ srRepetitions: 4, srInterval: 18, srEaseFactor: 2.2 }), 0);
    expect(result.srRepetitions).toBe(0);
  });

  test('rating 0 does not change ease factor', async () => {
    const result = await processRating(makeStudyItem({ srRepetitions: 4, srInterval: 18, srEaseFactor: 2.2 }), 0);
    expect(result.srEaseFactor).toBeCloseTo(2.2, 5);
  });

  test('rating 2 (fail) also resets interval and repetitions', async () => {
    const result = await processRating(makeStudyItem({ srRepetitions: 4, srInterval: 18, srEaseFactor: 2.2 }), 2);
    expect(result.srInterval).toBe(1);
    expect(result.srRepetitions).toBe(0);
  });

  test('ease factor never drops below 1.3', async () => {
    let item = makeStudyItem({ srRepetitions: 3, srInterval: 10, srEaseFactor: 1.31 });

    for (let i = 0; i < 30; i += 1) {
      item = await processRating(item, 3);
    }

    expect(item.srEaseFactor).toBeGreaterThanOrEqual(1.3);
  });

  test('ease factor increases correctly on rating 5', async () => {
    const result = await processRating(makeStudyItem({ srRepetitions: 1, srInterval: 1, srEaseFactor: 2.5 }), 5);
    expect(result.srEaseFactor).toBeCloseTo(2.6, 5);
  });

  test('ease factor decreases correctly on rating 3', async () => {
    const result = await processRating(makeStudyItem({ srRepetitions: 1, srInterval: 1, srEaseFactor: 2.5 }), 3);
    expect(result.srEaseFactor).toBeCloseTo(2.36, 5);
  });

  test('getTodayString returns local date not UTC date', () => {
    jest.setSystemTime(new Date(2026, 3, 5, 23, 30, 0, 0));
    expect(getTodayString()).toBe(localDateKey(new Date()));
  });

  test('addDays uses local calendar days not milliseconds', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  test('item due today appears in getTodaysQueue', async () => {
    const today = getTodayString();
    const items = [makeStudyItem({ id: 'due-today', srNextReviewDate: today })];
    await AsyncStorage.setItem(ACTION_ITEMS_KEY, JSON.stringify(items));

    const queue = await getTodaysQueue();
    expect(queue.map((i) => i.id)).toContain('due-today');
  });

  test('item due tomorrow does not appear in getTodaysQueue', async () => {
    const today = getTodayString();
    const tomorrow = addDays(today, 1);
    const items = [makeStudyItem({ id: 'due-tomorrow', srNextReviewDate: tomorrow })];
    await AsyncStorage.setItem(ACTION_ITEMS_KEY, JSON.stringify(items));

    const queue = await getTodaysQueue();
    expect(queue.map((i) => i.id)).not.toContain('due-tomorrow');
  });

  test('getTodaysQueue returns maximum 20 items even if 30 are due', async () => {
    const today = getTodayString();
    const items = Array.from({ length: 30 }, (_, index) =>
      makeStudyItem({ id: `due-${index}`, srNextReviewDate: today })
    );

    await AsyncStorage.setItem(ACTION_ITEMS_KEY, JSON.stringify(items));

    const queue = await getTodaysQueue();
    expect(queue).toHaveLength(20);
  });

  test('getTodaysQueue sorts overdue items before due-today items', async () => {
    const today = getTodayString();
    const overdue = addDays(today, -2);

    const items = [
      makeStudyItem({ id: 'today-a', srNextReviewDate: today, srEaseFactor: 1.6 }),
      makeStudyItem({ id: 'overdue-a', srNextReviewDate: overdue, srEaseFactor: 2.6 }),
      makeStudyItem({ id: 'today-b', srNextReviewDate: today, srEaseFactor: 1.4 }),
    ];

    await AsyncStorage.setItem(ACTION_ITEMS_KEY, JSON.stringify(items));

    const queue = await getTodaysQueue();
    expect(queue[0].id).toBe('overdue-a');
  });

  test('low OCR confidence item is not enrolled', async () => {
    const result = await enrollItemInSR({
      id: 'x',
      category: 'Study Material',
      ocrConfidence: 'low',
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('low_ocr_confidence');
  });

  test('non-study-material item is not enrolled', async () => {
    const result = await enrollItemInSR({
      id: 'x',
      category: 'Product',
      ocrConfidence: 'high',
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('wrong_category');
  });

  test('already enrolled item returns already_enrolled reason', async () => {
    const result = await enrollItemInSR({
      id: 'x',
      category: 'Study Material',
      srEnabled: true,
      ocrConfidence: 'high',
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('already_enrolled');
  });

  test('grace day resets after 7 days from lastGraceDayUsed', async () => {
    await AsyncStorage.setItem(
      ACTION_ITEMS_KEY,
      JSON.stringify([
        {
          id: 'done-1',
          status: 'completed',
          processedAt: '2026-04-10T07:30:00.000Z',
        },
      ])
    );
    jest.setSystemTime(new Date('2026-04-10T10:00:00Z'));

    const updated = await updateStreakData({
      currentStreak: 8,
      longestStreak: 10,
      lastActiveDate: '2026-04-08',
      graceDaysUsed: 1,
      lastGraceDayUsed: '2026-04-03',
    });

    expect(updated.graceDaysUsed).toBe(1);
    expect(updated.lastGraceDayUsed).toBe('2026-04-10');
    expect(updated.currentStreak).toBe(9);
  });

  test('second missed day within 7-day window breaks streak', async () => {
    await AsyncStorage.setItem(
      ACTION_ITEMS_KEY,
      JSON.stringify([
        {
          id: 'done-1',
          status: 'completed',
          processedAt: '2026-04-10T07:30:00.000Z',
        },
      ])
    );
    jest.setSystemTime(new Date('2026-04-10T10:00:00Z'));

    const updated = await updateStreakData({
      currentStreak: 8,
      longestStreak: 10,
      lastActiveDate: '2026-04-08',
      graceDaysUsed: 1,
      lastGraceDayUsed: '2026-04-06',
    });

    expect(updated.currentStreak).toBe(1);
    expect(updated.graceDaysUsed).toBe(0);
  });
});
