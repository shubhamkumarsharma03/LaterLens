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
const {
  processRating,
  getStudyStats,
  SR_DEFAULTS,
} = require('../spacedRepetitionService');
const { updateStreakData } = require('../insightsService');
const { STORAGE_KEYS } = require('../../constants/storageKeys');

const ACTION_QUEUE_KEY = STORAGE_KEYS.ACTION_ITEMS;

function seededStudyItem(overrides = {}) {
  return {
    id: overrides.id || 'study-item-1',
    category: 'Study Material',
    srEnabled: true,
    srInterval: 1,
    srEaseFactor: SR_DEFAULTS.srEaseFactor,
    srRepetitions: 0,
    srNextReviewDate: '2026-04-01',
    srLastReviewDate: null,
    srHistory: [],
    ...overrides,
  };
}

describe('SM-2 behavior', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-05T10:00:00'));
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('rate 5 from fresh item keeps interval at 1 day', async () => {
    const fresh = seededStudyItem({ srRepetitions: 0, srInterval: 1, srEaseFactor: 2.5 });
    const result = await processRating(fresh, 5);

    expect(result.srInterval).toBe(1);
    expect(result.srRepetitions).toBe(1);
    expect(result.srEaseFactor).toBeCloseTo(2.6, 5);
  });

  test('rate 5 twice sets interval to 6 days on second successful recall', async () => {
    const fresh = seededStudyItem({ srRepetitions: 0, srInterval: 1, srEaseFactor: 2.5 });
    const first = await processRating(fresh, 5);
    const second = await processRating(first, 5);

    expect(second.srInterval).toBe(6);
    expect(second.srRepetitions).toBe(2);
  });

  test('third successful rating scales interval using prior ease factor', async () => {
    const fresh = seededStudyItem({ srRepetitions: 0, srInterval: 1, srEaseFactor: 2.5 });
    const first = await processRating(fresh, 5);
    const second = await processRating(first, 5);
    const third = await processRating(second, 5);

    // previous interval is 6, previous EF is 2.7 after two 5-ratings
    expect(third.srInterval).toBe(Math.round(6 * 2.7));
    expect(third.srRepetitions).toBe(3);
  });

  test('rate 0 resets interval/repetitions and leaves ease factor unchanged', async () => {
    const learned = seededStudyItem({
      srInterval: 15,
      srEaseFactor: 2.35,
      srRepetitions: 4,
    });

    const result = await processRating(learned, 0);

    expect(result.srInterval).toBe(1);
    expect(result.srRepetitions).toBe(0);
    expect(result.srEaseFactor).toBeCloseTo(2.35, 5);
  });

  test('repeated hard recalls never reduce EF below 1.3', async () => {
    let item = seededStudyItem({ srEaseFactor: 1.31, srRepetitions: 2, srInterval: 6 });

    for (let i = 0; i < 20; i += 1) {
      item = await processRating(item, 3);
    }

    expect(item.srEaseFactor).toBeGreaterThanOrEqual(1.3);
  });

  test('study stats struggling count uses default EF when value missing', async () => {
    const items = [
      seededStudyItem({ id: 'a', srEaseFactor: undefined }),
      seededStudyItem({ id: 'b', srEaseFactor: 1.4 }),
    ];

    await AsyncStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(items));
    const stats = await getStudyStats();

    // only item b should count as struggling (<= 1.5)
    expect(stats.strugglingCount).toBe(1);
  });
});

describe('Rolling grace window streak logic', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('streak activity can be driven by study review date alone', async () => {
    jest.setSystemTime(new Date('2026-04-10T09:00:00'));
    await AsyncStorage.setItem(
      ACTION_QUEUE_KEY,
      JSON.stringify([
        {
          id: 'study-1',
          srEnabled: true,
          srLastReviewDate: '2026-04-10',
          status: 'queued',
        },
      ])
    );

    const next = await updateStreakData({
      currentStreak: 2,
      longestStreak: 4,
      lastActiveDate: '2026-04-09',
      graceDaysUsed: 0,
      lastGraceDayUsed: '',
    });

    expect(next.currentStreak).toBe(3);
  });

  test('idempotent update: same day does not increment twice', async () => {
    jest.setSystemTime(new Date('2026-04-10T09:00:00'));
    await AsyncStorage.setItem(
      ACTION_QUEUE_KEY,
      JSON.stringify([
        {
          id: 'study-1',
          srEnabled: true,
          srLastReviewDate: '2026-04-10',
          status: 'queued',
        },
      ])
    );

    const current = {
      currentStreak: 7,
      longestStreak: 10,
      lastActiveDate: '2026-04-10',
      graceDaysUsed: 0,
      lastGraceDayUsed: '',
    };

    const next = await updateStreakData(current);
    expect(next.currentStreak).toBe(7);
    expect(next.lastActiveDate).toBe('2026-04-10');
  });

  test('grace used 6 days ago does not reset yet, second miss breaks streak', async () => {
    jest.setSystemTime(new Date('2026-04-10T09:00:00'));
    await AsyncStorage.setItem(
      ACTION_QUEUE_KEY,
      JSON.stringify([
        {
          id: 'q-1',
          status: 'completed',
          processedAt: '2026-04-10T08:00:00',
        },
      ])
    );

    const next = await updateStreakData({
      currentStreak: 9,
      longestStreak: 12,
      lastActiveDate: '2026-04-08', // missed yesterday => needs grace
      graceDaysUsed: 1,
      lastGraceDayUsed: '2026-04-04', // 6 days ago
    });

    expect(next.currentStreak).toBe(1);
    expect(next.graceDaysUsed).toBe(0);
  });

  test('grace used 7 days ago resets window, next miss can consume grace', async () => {
    jest.setSystemTime(new Date('2026-04-10T09:00:00'));
    await AsyncStorage.setItem(
      ACTION_QUEUE_KEY,
      JSON.stringify([
        {
          id: 'q-1',
          status: 'completed',
          processedAt: '2026-04-10T08:00:00',
        },
      ])
    );

    const next = await updateStreakData({
      currentStreak: 9,
      longestStreak: 12,
      lastActiveDate: '2026-04-08', // missed yesterday => needs grace
      graceDaysUsed: 1,
      lastGraceDayUsed: '2026-04-03', // 7 days ago
    });

    expect(next.currentStreak).toBe(10);
    expect(next.graceDaysUsed).toBe(1);
    expect(next.lastGraceDayUsed).toBe('2026-04-10');
  });
});
