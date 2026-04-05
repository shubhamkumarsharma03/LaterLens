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

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { currentState: 'active' },
}));

jest.mock('./../settingsStorage', () => ({
  SETTINGS_KEYS: {
    NOTIFICATION_CONFIG: 'laterlens_notification_config',
    DAILY_DIGEST_TIME: 'laterlens_daily_digest_time',
    QUIET_HOURS: 'laterlens_quiet_hours',
  },
  getSetting: jest.fn(async (key, fallback) => {
    if (key === 'laterlens_notification_config') return { dailyDigest: true };
    if (key === 'laterlens_daily_digest_time') return '12:15';
    if (key === 'laterlens_quiet_hours') return { start: '23:00', end: '08:00' };
    return fallback;
  }),
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: {
    HIGH: 'HIGH',
  },
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
  },
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => 'digest-id-1'),
  presentNotificationAsync: jest.fn(async () => {}),
}));

const AsyncStorage = require('@react-native-async-storage/async-storage');
const Notifications = require('expo-notifications');
const { STORAGE_KEYS } = require('../../constants/storageKeys');
const {
  cancelDailyDigestNotification,
  DAILY_DIGEST_CHANNEL_ID,
  DAILY_DIGEST_IDENTIFIER,
  ensureNotificationChannels,
  getNextDailyDigestOccurrence,
  reRegisterDailyDigestIfMissing,
  scheduleDailyDigest,
  sendNotification,
} = require('../notificationService');

describe('notificationService daily digest scheduling', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    Notifications.scheduleNotificationAsync.mockResolvedValue('digest-id-1');
    Notifications.cancelScheduledNotificationAsync.mockClear();
    Notifications.scheduleNotificationAsync.mockClear();
    Notifications.presentNotificationAsync.mockClear();
  });

  test('schedules daily digest with calendar trigger at configured time', async () => {
    await scheduleDailyDigest();

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

    const payload = Notifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(payload.trigger).toEqual({
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 12,
      minute: 15,
    });
    expect(payload.content.body).toBe('Your daily screenshot digest is ready - tap to review.');
    expect(payload.content.channelId).toBe(DAILY_DIGEST_CHANNEL_ID);
    expect(payload.content.interruptionLevel).toBe('timeSensitive');
    expect(payload.content.data.identifier).toBe(DAILY_DIGEST_IDENTIFIER);
  });

  test('cancels existing digest notifications before scheduling new one', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.DAILY_DIGEST_NOTIFICATION_ID, 'old-id');
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'another-old-id',
        content: { data: { type: DAILY_DIGEST_IDENTIFIER } },
      },
      {
        identifier: 'other-notification',
        content: { data: { type: 'other' } },
      },
    ]);

    await scheduleDailyDigest('13:20');

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-id');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('another-old-id');

    const payload = Notifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(payload.trigger).toEqual({
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 13,
      minute: 20,
    });
  });

  test('re-registers digest on foreground when missing', async () => {
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);

    await reRegisterDailyDigestIfMissing();

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  test('creates android digest notification channel at startup', async () => {
    await ensureNotificationChannels();

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      DAILY_DIGEST_CHANNEL_ID,
      expect.objectContaining({ importance: Notifications.AndroidImportance.HIGH })
    );
  });

  test('cancel helper removes only digest notifications', async () => {
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'daily-id',
        content: { data: { identifier: DAILY_DIGEST_IDENTIFIER } },
      },
      {
        identifier: 'not-digest',
        content: { data: { identifier: 'other' } },
      },
    ]);

    await cancelDailyDigestNotification();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('daily-id');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('not-digest');
  });

  test('next digest occurrence rolls to tomorrow when time has passed today', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-05T11:10:00'));

    const next = getNextDailyDigestOccurrence('11:03');

    expect(next.getDate()).toBe(6);
    expect(next.getHours()).toBe(11);
    expect(next.getMinutes()).toBe(3);

    jest.useRealTimers();
  });

  test('sendNotification uses immediate present API in foreground', async () => {
    await sendNotification('Test Alert', 'Notification check');

    expect(Notifications.presentNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Alert',
        body: 'Notification check',
      })
    );
  });

  test('sendNotification falls back to scheduleNotificationAsync when present API is unavailable', async () => {
    Notifications.presentNotificationAsync.mockImplementationOnce(async () => {
      throw new TypeError('presentNotificationAsync is not a function');
    });

    await sendNotification('Fallback Alert', 'Fallback path');

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Fallback Alert',
          body: 'Fallback path',
        }),
        trigger: null,
      })
    );
  });
});
