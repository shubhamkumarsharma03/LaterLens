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
const { STORAGE_KEYS, LEGACY_STORAGE_KEYS } = require('../../constants/storageKeys');
const {
  computeTopStats,
  getItemsForPeriod,
  getPreviousItemsForPeriod,
} = require('../insightsService');

describe('insightsService storage and period filters', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-05T10:00:00Z'));
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('reads action items from legacy key and migrates to primary key', async () => {
    const legacyKey = LEGACY_STORAGE_KEYS.ACTION_ITEMS[0];
    const seed = [
      {
        id: 'a1',
        status: 'queued',
        processedAt: '2026-04-05T08:00:00.000Z',
      },
    ];

    await AsyncStorage.setItem(legacyKey, JSON.stringify(seed));

    const weekItems = await getItemsForPeriod('week');

    expect(weekItems).toHaveLength(1);
    expect(weekItems[0].id).toBe('a1');

    const migrated = await AsyncStorage.getItem(STORAGE_KEYS.ACTION_ITEMS);
    expect(migrated).not.toBeNull();
  });

  test('week filter uses local calendar days and keeps items without processedAt', async () => {
    const now = new Date('2026-04-05T09:30:00').toISOString();
    const old = new Date('2026-02-01T09:30:00').toISOString();

    const items = [
      { id: 'today', status: 'queued', processedAt: now },
      { id: 'missingDate', status: 'queued' },
      { id: 'old', status: 'queued', processedAt: old },
    ];

    await AsyncStorage.setItem(STORAGE_KEYS.ACTION_ITEMS, JSON.stringify(items));

    const weekItems = await getItemsForPeriod('week');
    const previousWeek = await getPreviousItemsForPeriod('week');

    expect(weekItems.map((item) => item.id)).toContain('today');
    expect(weekItems.map((item) => item.id)).toContain('missingDate');
    expect(weekItems.map((item) => item.id)).not.toContain('old');
    expect(previousWeek.map((item) => item.id)).not.toContain('today');
  });

  test('computeTopStats is safe with missing previous period input', async () => {
    const items = [{ id: 'x', status: 'completed' }];
    const stats = await computeTopStats(items);

    expect(stats.totalSaved).toBe(1);
    expect(stats.totalActedOn).toBe(1);
    expect(stats.completionRate).toBe(100);
    expect(stats.deltas.totalSaved).toBe(1);
  });
});
