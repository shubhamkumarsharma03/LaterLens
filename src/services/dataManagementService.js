import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActionQueue, saveActionItem, clearActionQueue } from './actionQueueStorage';
import { extractTextFromImage, analyzeScreenshotContext } from './aiProcessingEngine';

const ACTION_QUEUE_KEY = 'screenmind_action_queue_v1';

/**
 * Calculates real storage usage from AsyncStorage metadata and estimated thumbnail overhead.
 */
export async function calculateStorageStats() {
  try {
    const queue = await getActionQueue();
    const rawData = await AsyncStorage.getItem(ACTION_QUEUE_KEY);
    
    // 1. Calculate metadata size (bytes from AsyncStorage string length)
    const metadataBytes = rawData ? rawData.length : 0;
    
    // 2. Estimate media impact (thumbnails + local cache)
    // We assume about 80KB per processed item for high-quality thumbnails.
    const mediaBytes = queue.length * 80 * 1024; 

    const totalBytes = metadataBytes + mediaBytes;
    const totalMB = totalBytes / (1024 * 1024);

    return {
      totalMB: totalMB < 0.1 ? 0.1 : totalMB, // Min display value
      metadata: metadataBytes / totalBytes || 0.1,
      thumbnails: mediaBytes / totalBytes || 0.9,
      count: queue.length
    };
  } catch (e) {
    console.error('[DataManagement] Storage calc failed:', e);
    return { totalMB: 0, metadata: 0, thumbnails: 0, count: 0 };
  }
}

/**
 * Exports all metadata as a JSON file.
 */
export async function exportMetadata() {
  try {
    const queue = await getActionQueue();
    const data = JSON.stringify(queue, null, 2);
    const filename = `LaterLens_Export_${new Date().toISOString().split('T')[0]}.json`;
    const filePath = `${FileSystem.documentDirectory}${filename}`;
    
    await FileSystem.writeAsStringAsync(filePath, data);
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath);
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('[DataManagement] Export failed:', error);
    throw error;
  }
}

/**
 * Deletes all app metadata and settings.
 */
export async function wipeAllAppData() {
  try {
    await clearActionQueue();
    // Additional cleaning like cache could go here
    return true;
  } catch (error) {
    console.error('[DataManagement] Wipe failed:', error);
    return false;
  }
}

/**
 * Performs bulk import with batching (10 items / 2s delay) to manage API limits.
 */
export async function bulkImportScreenshots(months = 1, onProgress) {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') throw new Error('Permission denied');

    const date = new Date();
    date.setMonth(date.getMonth() - months);
    const timestamp = date.getTime();

    // 1. Fetch assets
    const assetsPage = await MediaLibrary.getAssetsAsync({
      mediaType: [MediaLibrary.MediaType.photo],
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      createdAfter: timestamp,
    });

    const assets = assetsPage.assets;
    const total = assets.length;
    let processed = 0;

    if (total === 0) return 0;

    const queue = await getActionQueue();

    // 2. Process in batches
    for (let i = 0; i < assets.length; i += 10) {
      const batch = assets.slice(i, i + 10);
      
      for (const asset of batch) {
        // De-duplicate check
        if (queue.some(item => item.assetId === asset.id)) {
          processed++;
          continue;
        }

        const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
        const uri = assetInfo.localUri || asset.uri;
        
        const extractedText = await extractTextFromImage(uri);
        const metadata = await analyzeScreenshotContext(extractedText);
        
        const queueItem = {
          id: `${Date.now()}-${asset.id}`,
          assetId: asset.id,
          imageUri: uri,
          timestamp: asset.creationTime,
          ...metadata,
          status: 'queued',
        };

        await saveActionItem(queueItem);
        processed++;
        if (onProgress) onProgress(processed / total);
      }

      // Delay between batches to prevent API rate limiting
      if (i + 10 < assets.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return processed;
  } catch (error) {
    console.error('[DataManagement] Bulk import failed:', error);
    throw error;
  }
}
