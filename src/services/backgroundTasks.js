import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as MediaLibrary from 'expo-media-library';
import * as Network from 'expo-network';
import { Platform } from 'react-native';
import { getActionQueue, saveActionItem } from './actionQueueStorage';
import { processScreenshot } from './aiProcessingEngine';
import { findScreenshotAlbum } from './mediaDiscovery';
import {
  getInitialScanStatus,
  setInitialScanStatus,
  getLastScannedTimestamp,
  setLastScannedTimestamp,
  getSetting,
  SETTINGS_KEYS,
} from './settingsStorage';
import { requestNotificationPermissions, sendNotification } from './notificationService';

const BACKGROUND_SCREENSHOT_TASK = 'BACKGROUND_SCREENSHOT_TASK';

// Configure Notifications to show while app is foregrounded as well
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function getRecentScreenshotAssets(limit = 5) {
  try {
    // 1. Mandatory Permission Check - Fixes native crashes
    const { status } = await MediaLibrary.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('[BackgroundTask] MediaLibrary permission not granted. Skipping.');
      return [];
    }

    const screenshotAlbum = await findScreenshotAlbum();
    if (!screenshotAlbum) {
      console.log('[BackgroundTask] No screenshot album found.');
      return [];
    }

    const isInitialScanDone = await getInitialScanStatus();
    const lastTimestamp = await getLastScannedTimestamp();

    // Calculate start of today (00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = today.getTime();

    let createdAfter = lastTimestamp;
    if (!isInitialScanDone) {
      createdAfter = startOfToday;
    }

    let assetsPage;
    try {
      assetsPage = await MediaLibrary.getAssetsAsync({
        first: limit + 10,
        album: screenshotAlbum,
        mediaType: [MediaLibrary.MediaType.photo],
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        createdAfter: createdAfter,
      });
    } catch (e) {
      console.log('[BackgroundTask] Error in getAssetsAsync:', e);
      return [];
    }

    if (!assetsPage || !assetsPage.assets.length) return [];

    const assets = assetsPage.assets.slice(0, limit);
    const resolved = [];

    for (const asset of assets) {
      try {
        const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
        resolved.push({
          id: asset.id,
          uri: assetInfo.localUri || assetInfo.uri || asset.uri,
          creationTime: asset.creationTime,
        });
      } catch (e) {
        resolved.push({
          id: asset.id,
          uri: asset.uri,
          creationTime: asset.creationTime,
        });
      }
    }

    return resolved;
  } catch (error) {
    console.log('[BackgroundTask] Error in getRecentScreenshotAssets:', error);
    return [];
  }
}


TaskManager.defineTask(BACKGROUND_SCREENSHOT_TASK, async () => {
  console.log('[BackgroundTask] Firing silent screenshot scan...');
  try {
    // 1. Check Global Processing Flags
    const autoProcessing = await getSetting(SETTINGS_KEYS.AUTO_PROCESSING_ENABLED, true);
    if (!autoProcessing) {
      console.log('[BackgroundTask] Auto-processing is disabled. Skipping.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const wifiOnly = await getSetting(SETTINGS_KEYS.WIFI_ONLY, false);
    if (wifiOnly) {
      const net = await Network.getNetworkStateAsync();
      if (net.type !== Network.NetworkStateType.WIFI) {
        console.log('[BackgroundTask] Process on Wi-Fi only is enabled. Skipping.');
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }
    }

    const assets = await getRecentScreenshotAssets(3);
    if (!assets || assets.length === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const queue = await getActionQueue();
    const newAssets = assets.filter(asset => 
      !queue.some(item => item.assetId === asset.id || item.imageUri === asset.uri)
    );

    if (newAssets.length === 0) return BackgroundFetch.BackgroundFetchResult.NoData;

    console.log(`[BackgroundTask] Found ${newAssets.length} new screenshots...`);

    let newestTimestamp = 0;
    
    // Fetch privacy settings for the gate
    const privacyRules = await getSetting(SETTINGS_KEYS.PRIVACY_RULES, {
      blockFinancial: true,
      blockAuth: true,
      blockPersonalId: true,
      blockContacts: true,
      blockMedical: true,
      blockChats: true,
    });

    for (const asset of newAssets) {
      const uri = asset.uri;
      const assetId = asset.id;
      const timestamp = asset.creationTime || Date.now();
      
      if (timestamp > newestTimestamp) newestTimestamp = timestamp;

      // Single Pipeline Call: OCR -> Privacy -> Groq
      const result = await processScreenshot(uri, { privacyRules });

      if (result.status === 'success') {
        const queueItem = {
          id: `${Date.now()}-${assetId}`,
          assetId,
          imageUri: uri,
          timestamp: asset.creationTime || Date.now(),
          ...result,
          status: 'queued',
        };

        await saveActionItem(queueItem);

        await sendNotification(
          'LaterLens: Action Saved',
          `Analyzed a ${result.contentType} screenshot: ${result.suggestedAction}`
        );
      } else if (result.status === 'privacy_blocked') {
        // Item already saved locally by processScreenshot.
        // IMPORTANT: Do NOT reveal what was detected in the notification.
        // Lock screen notifications are visible to anyone who picks up the phone.
        // "contains card number" is metadata leakage.
        await sendNotification(
          'Screenshot saved privately',
          'This item was kept on your device only.'
        );
      } else if (result.status === 'ocr_failed' || result.status === 'ocr_error') {
        // Item already saved locally by processScreenshot.
        // No notification — the user doesn't need to know about OCR failures
        // on their lock screen. They can see 'Needs review' items inside the app.
        console.log(`[BackgroundTask] ${result.status} for asset:`, assetId);
      }
    }

    // Update scan state
    if (newAssets.length > 0) {
      await setInitialScanStatus(true);
      if (newestTimestamp > 0) {
        await setLastScannedTimestamp(newestTimestamp);
      }
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.log('[BackgroundTask] Error processing screenshots:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundFetchAsync() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      finalStatus = await requestNotificationPermissions();
    }

    if (finalStatus !== 'granted') {
      console.log('[BackgroundTask] Notification permissions not granted');
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_SCREENSHOT_TASK, {
      minimumInterval: 15 * 60, // 15 minutes minimum interval
      stopOnTerminate: false,   // continue firing while app is terminated
      startOnBoot: true,        // restart after device reboot
    });
    console.log('[BackgroundFetch] Task registered successfully');
  } catch (err) {
    console.log('[BackgroundFetch] Failed to register task:', err);
  }
}
