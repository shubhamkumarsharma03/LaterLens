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

async function getLatestScreenshotUri() {
  let albums = [];
  try {
    albums = await MediaLibrary.getAlbumsAsync();
    if (Platform.OS === 'ios') {
      // iOS requires smart albums explicitly
      const smart = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
      albums = [...albums, ...smart];
    }
  } catch (e) {
    console.log('[BackgroundTask] Failed to load albums', e);
    return null;
  }

  const screenshotAlbum = albums.find(a => 
    (a.title || '').toLowerCase().includes('screenshot')
  );
  
  if (!screenshotAlbum) return null;

  let assetsPage;
  try {
    assetsPage = await MediaLibrary.getAssetsAsync({
      first: 10,
      album: screenshotAlbum,
      mediaType: [MediaLibrary.MediaType.photo],
    });
  } catch (e) { return null; }

  if (!assetsPage || !assetsPage.assets.length) return null;

  const latestAsset = assetsPage.assets.sort((a, b) => (b.creationTime || 0) - (a.creationTime || 0))[0];
  
  try {
    const assetInfo = await MediaLibrary.getAssetInfoAsync(latestAsset);
    return assetInfo.localUri || assetInfo.uri || latestAsset.uri;
  } catch (e) {
    return latestAsset.uri;
  }
}

TaskManager.defineTask(BACKGROUND_SCREENSHOT_TASK, async () => {
  console.log('[BackgroundTask] Firing silent screenshot scan...');
  try {
    const uri = await getLatestScreenshotUri();
    if (!uri) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const queue = await getActionQueue();
    if (queue.some(item => item.imageUri === uri)) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    console.log('[BackgroundTask] Found new screenshot, initiating AI context flow...');
    const extractedText = await extractTextFromImage(uri);
    const metadata = await analyzeScreenshotContext(extractedText);
    
    const queueItem = {
      id: `${Date.now()}`,
      imageUri: uri,
      timestamp: Date.now(),
      contentType: metadata.contentType,
      intent: metadata.intent,
      tags: metadata.tags,
      suggestedAction: metadata.suggestedAction,
      summary: metadata.summary,
      extractedUrl: metadata.extractedUrl || null,
      status: 'queued',
    };

    await saveActionItem(queueItem);
    console.log('[BackgroundTask] Action queued successfully.');

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'LaterLens: Action Saved',
        body: `Analyzed a ${metadata.contentType} screenshot: ${metadata.suggestedAction}`,
      },
      trigger: null, // deliver immediately
    });

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.log('[BackgroundTask] Error processing screenshot:', error);
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
