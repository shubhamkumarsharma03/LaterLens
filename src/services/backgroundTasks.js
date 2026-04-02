import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { getActionQueue, saveActionItem } from './actionQueueStorage';
import { extractTextFromImage, analyzeScreenshotContext } from './aiProcessingEngine';

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
  let albums = [];
  const screenshotNameCandidates = ['screenshots', 'screenshot', 'captures', 'images'];

  try {
    albums = await MediaLibrary.getAlbumsAsync();
    if (Platform.OS === 'ios') {
      const smart = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
      albums = [...albums, ...smart];
    }
  } catch (e) {
    console.log('[BackgroundTask] Failed to load albums', e);
    return [];
  }

  const screenshotAlbum = albums.find(a => {
    const title = (a.title || '').toLowerCase();
    return screenshotNameCandidates.some(c => title === c || title.includes(c));
  });

  if (!screenshotAlbum) return [];

  let assetsPage;
  try {
    assetsPage = await MediaLibrary.getAssetsAsync({
      first: limit + 5,
      album: screenshotAlbum,
      mediaType: [MediaLibrary.MediaType.photo],
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
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

    for (const asset of newAssets) {
      const uri = asset.uri;
      const assetId = asset.id;

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
