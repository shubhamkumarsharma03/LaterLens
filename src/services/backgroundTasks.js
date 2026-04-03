import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { getActionQueue, saveActionItem } from './actionQueueStorage';
import { extractTextFromImage, analyzeScreenshotContext } from './aiProcessingEngine';
import { findScreenshotAlbum } from './mediaDiscovery';
import {
  getInitialScanStatus,
  setInitialScanStatus,
  getLastScannedTimestamp,
  setLastScannedTimestamp,
} from './settingsStorage';

const BACKGROUND_SCREENSHOT_TASK = 'BACKGROUND_SCREENSHOT_TASK';

// Configure Notifications to show while app is foregrounded as well
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function getRecentScreenshotAssets(limit = 5) {
  try {
    const screenshotAlbum = await findScreenshotAlbum();

    if (!screenshotAlbum) return [];

    const isInitialScanDone = await getInitialScanStatus();
    const lastTimestamp = await getLastScannedTimestamp();

    // Calculate start of today (00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = today.getTime();

    // If it's the first time for this folder/install, only scan from today.
    // Otherwise, scan from the last recorded timestamp to ensure no gaps.
    let createdAfter = lastTimestamp;
    if (!isInitialScanDone) {
      createdAfter = startOfToday;
      console.log('[BackgroundTask] First scan for this folder. Limiting to today.');
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
    console.log('[BackgroundTask] Error fetching assets:', error);
    return [];
  }
}


TaskManager.defineTask(BACKGROUND_SCREENSHOT_TASK, async () => {
  console.log('[BackgroundTask] Firing silent screenshot scan...');
  try {
    const assets = await getRecentScreenshotAssets(3); // Limit background processing to 3 at a time
    if (!assets || assets.length === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const queue = await getActionQueue();
    const newAssets = assets.filter(asset => 
      !queue.some(item => item.assetId === asset.id || item.imageUri === asset.uri)
    );

    if (newAssets.length === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    console.log(`[BackgroundTask] Found ${newAssets.length} new screenshots...`);

    let newestTimestamp = 0;

    for (const asset of newAssets) {
      const uri = asset.uri;
      const assetId = asset.id;
      const timestamp = asset.creationTime || Date.now();
      
      if (timestamp > newestTimestamp) newestTimestamp = timestamp;

      const extractedText = await extractTextFromImage(uri);
      const metadata = await analyzeScreenshotContext(extractedText);
      
      const queueItem = {
        id: `${Date.now()}-${assetId}`,
        assetId,
        imageUri: uri,
        timestamp: asset.creationTime || Date.now(),
        contentType: metadata.contentType,
        intent: metadata.intent,
        tags: metadata.tags,
        suggestedAction: metadata.suggestedAction,
        summary: metadata.summary,
        extractedUrl: metadata.extractedUrl || null,
        status: 'queued',
      };

      await saveActionItem(queueItem);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'LaterLens: Action Saved',
          body: `Analyzed a ${metadata.contentType} screenshot: ${metadata.suggestedAction}`,
        },
        trigger: null,
      });
    }

    // Update scan state
    if (newAssets.length > 0) {
      await setInitialScanStatus(true);
      if (newestTimestamp > 0) {
        await setLastScannedTimestamp(newestTimestamp);
      }
    } else if (newAssets.length === 0 && assets.length > 0) {
        // Even if all are filtered out, we've completed the "initial scan" check for those items
        await setInitialScanStatus(true);
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
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
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
