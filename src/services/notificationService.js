import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { getSetting, SETTINGS_KEYS } from './settingsStorage';
import { STORAGE_KEYS } from '../constants/storageKeys';

export const DAILY_DIGEST_IDENTIFIER = 'daily_digest';
export const DAILY_DIGEST_CHANNEL_ID = 'daily_digest';

const DEFAULT_DIGEST_TIME = '19:00';

function parseDigestTime(value = DEFAULT_DIGEST_TIME) {
  const [hourRaw, minuteRaw] = String(value || DEFAULT_DIGEST_TIME).split(':');
  const parsedHour = Number(hourRaw);
  const parsedMinute = Number(minuteRaw);
  const hour = Number.isNaN(parsedHour) ? 19 : Math.max(0, Math.min(23, parsedHour));
  const minute = Number.isNaN(parsedMinute) ? 0 : Math.max(0, Math.min(59, parsedMinute));
  return { hour, minute };
}

export function getNextDailyDigestOccurrence(timeValue = DEFAULT_DIGEST_TIME) {
  const { hour, minute } = parseDigestTime(timeValue);
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function isDailyDigestScheduledNotification(notification) {
  const data = notification?.content?.data || {};
  return data?.identifier === DAILY_DIGEST_IDENTIFIER || data?.type === DAILY_DIGEST_IDENTIFIER;
}

export async function requestNotificationPermissions() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') {
    return existing.status;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: true,
      allowCriticalAlerts: false,
      provideAppNotificationSettings: true,
      allowProvisional: false,
    },
  });

  return requested.status;
}

export async function ensureNotificationChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(DAILY_DIGEST_CHANNEL_ID, {
    name: 'Daily Digest',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#534AB7',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('default', {
    name: 'LaterLens Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6366F1',
    sound: 'default',
  });
}

export async function cancelDailyDigestNotification() {
  const savedId = await AsyncStorage.getItem(STORAGE_KEYS.DAILY_DIGEST_NOTIFICATION_ID);
  if (savedId) {
    await Notifications.cancelScheduledNotificationAsync(savedId);
  }

  const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
  const digestNotifications = allScheduled.filter(isDailyDigestScheduledNotification);

  await Promise.all(
    digestNotifications.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
  );

  await AsyncStorage.removeItem(STORAGE_KEYS.DAILY_DIGEST_NOTIFICATION_ID);
}

export async function reRegisterDailyDigestIfMissing() {
  const config = await getSetting(SETTINGS_KEYS.NOTIFICATION_CONFIG, { dailyDigest: true });
  if (!config?.dailyDigest) {
    await cancelDailyDigestNotification();
    return null;
  }

  const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
  const digestExists = allScheduled.some(isDailyDigestScheduledNotification);

  if (digestExists) {
    return null;
  }

  return scheduleDailyDigest();
}

/**
 * Checks if the current time is within user-defined quiet hours.
 */
export async function isInQuietHours() {
  try {
    const quietHours = await getSetting(SETTINGS_KEYS.QUIET_HOURS, { start: '23:00', end: '08:00' });
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const [startH, startM] = quietHours.start.split(':').map(Number);
    const [endH, endM] = quietHours.end.split(':').map(Number);
    const [currH, currM] = currentTime.split(':').map(Number);

    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;
    const currTotal = currH * 60 + currM;

    if (startTotal < endTotal) {
      return currTotal >= startTotal && currTotal < endTotal;
    } else {
      // Overnight (e.g. 23:00 to 08:00)
      return currTotal >= startTotal || currTotal < endTotal;
    }
  } catch (e) {
    return false;
  }
}

/**
 * Schedules the Daily Digest notification at the preferred time.
 */
export async function scheduleDailyDigest(timeOverride) {
  try {
    await ensureNotificationChannels();

    const permission = await requestNotificationPermissions();
    if (permission !== 'granted') {
      console.log('[NotificationService] Notification permission not granted.');
      return null;
    }

    // Cancel only digest notifications, do not affect unrelated schedules.
    await cancelDailyDigestNotification();

    const config = await getSetting(SETTINGS_KEYS.NOTIFICATION_CONFIG, { dailyDigest: true });
    if (!config?.dailyDigest) {
      console.log('[NotificationService] Daily Digest is disabled in settings.');
      return null;
    }

    const digestTime = timeOverride || (await getSetting(SETTINGS_KEYS.DAILY_DIGEST_TIME, DEFAULT_DIGEST_TIME));
    const { hour, minute } = parseDigestTime(digestTime);

    // Calendar trigger ensures true wall-clock daily delivery.
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your LaterLens digest',
        body: 'Your daily screenshot digest is ready - tap to review.',
        data: { type: DAILY_DIGEST_IDENTIFIER, identifier: DAILY_DIGEST_IDENTIFIER },
        sound: true,
        interruptionLevel: 'timeSensitive',
        channelId: DAILY_DIGEST_CHANNEL_ID,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });

    await AsyncStorage.setItem(STORAGE_KEYS.DAILY_DIGEST_NOTIFICATION_ID, id);

    console.log(`[NotificationService] Daily Digest scheduled (ID: ${id}) for ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);

    const all = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[NotificationService] Total scheduled now: ${all.length}`);
    return id;
  } catch (error) {
    console.error('[NotificationService] Failed to schedule digest:', error);
    return null;
  }
}

/**
 * Unified notification helper that respects quiet hours.
 */
export async function sendNotification(title, body, data = {}) {
  try {
    if (AppState.currentState !== 'active') {
      console.log('[NotificationService] Skipping schedule outside foreground context.');
      return;
    }

    // Respect quiet hours logic
    const isQuiet = await isInQuietHours();
    if (isQuiet) {
      console.log('[NotificationService] Quiet hours enabled. Silencing notification.');
      return;
    }

    const immediatePayload = {
      title,
      body,
      data,
      sound: true,
      interruptionLevel: 'timeSensitive',
      channelId: 'default',
    };

    if (typeof Notifications.presentNotificationAsync === 'function') {
      try {
        await Notifications.presentNotificationAsync(immediatePayload);
      } catch (presentError) {
        const isMissingPresentApi =
          presentError instanceof TypeError ||
          /presentNotificationAsync\s+is\s+not\s+a\s+function/i.test(String(presentError?.message || ''));

        if (!isMissingPresentApi) {
          throw presentError;
        }

        await Notifications.scheduleNotificationAsync({
          content: immediatePayload,
          trigger: null,
        });
      }
    } else {
      await Notifications.scheduleNotificationAsync({
        content: immediatePayload,
        trigger: null,
      });
    }
    console.log(`[NotificationService] Immediate notification sent: ${title}`);
  } catch (error) {
    console.error('[NotificationService] Error sending notification:', error);
  }
}
