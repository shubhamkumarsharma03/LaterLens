import * as Notifications from 'expo-notifications';
import { getSetting, SETTINGS_KEYS } from './settingsStorage';

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
export async function scheduleDailyDigest() {
  try {
    // 1. Cancel previous schedules to avoid duplicates
    await Notifications.cancelAllScheduledNotificationsAsync();

    const config = await getSetting(SETTINGS_KEYS.NOTIFICATION_CONFIG, { dailyDigest: true });
    if (!config.dailyDigest) {
      console.log('[NotificationService] Daily Digest is disabled in settings.');
      return;
    }

    const digestTime = await getSetting(SETTINGS_KEYS.DAILY_DIGEST_TIME, '19:00');
    const [hours, minutes] = digestTime.split(':').map(Number);

    // 2. Schedule with High Importance and explicit Channel ID for Android
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "LaterLens: Time to Review",
        body: "Check out your latest screenshots and insights.",
        data: { type: 'daily_digest' },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        // CRITICAL: Must match the channel ID created in App.js
        channelId: 'default', 
      },
      trigger: {
        hour: hours,
        minute: minutes,
        repeats: true,
      },
    });

    console.log(`[NotificationService] Daily Digest scheduled (ID: ${id}) for ${digestTime}`);
    
    // List all to confirm
    const all = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[NotificationService] Total scheduled now: ${all.length}`);
  } catch (error) {
    console.error('[NotificationService] Failed to schedule digest:', error);
  }
}

/**
 * Unified notification helper that respects quiet hours.
 */
export async function sendNotification(title, body, data = {}) {
  try {
    // Respect quiet hours logic
    const isQuiet = await isInQuietHours();
    if (isQuiet) {
      console.log('[NotificationService] Quiet hours enabled. Silencing notification.');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        // CRITICAL: Explicitly set channelId for Android heads-up alerts
        channelId: 'default',
      },
      trigger: null, // immediate
    });
    console.log(`[NotificationService] Immediate notification sent: ${title}`);
  } catch (error) {
    console.error('[NotificationService] Error sending notification:', error);
  }
}
