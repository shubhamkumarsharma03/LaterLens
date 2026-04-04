import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActionQueue, saveActionItem, clearActionQueue } from './actionQueueStorage';
import { processScreenshot } from './aiProcessingEngine';
import { getSetting, SETTINGS_KEYS } from './settingsStorage';

const ACTION_QUEUE_KEY = 'screenmind_action_queue_v1';
const LAST_BULK_IMPORT_KEY = 'laterlens_last_bulk_import_summary';

// Process max 3 screenshots simultaneously during bulk import.
// Without this, 200 dark-mode screenshots all triggering contrast-boost retries
// means 400 ImageManipulator calls back-to-back, causing ANR on mid-range devices.
const BULK_CONCURRENCY_LIMIT = 3;

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
 * Retrieves the last bulk import summary from storage.
 * @returns {Promise<object|null>} The summary or null if none exists.
 */
export async function getLastBulkImportSummary() {
  try {
    const raw = await AsyncStorage.getItem(LAST_BULK_IMPORT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Performs bulk import with batching and concurrency limits.
 * 
 * Concurrency is capped at BULK_CONCURRENCY_LIMIT to prevent OOM / ANR
 * when many screenshots trigger the contrast-boost OCR retry path.
 *
 * The summary is persisted to AsyncStorage so it survives app restarts
 * and can be displayed in the Settings screen.
 *
 * @param {number} months - How many months back to scan.
 * @param {function} onProgress - Progress callback (0..1).
 * @returns {Promise<{total: number, successful: number, ocrFailed: number, privacyBlocked: number, completedAt: string}>}
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
    
    // Summary tracking
    let successful = 0;
    let ocrFailed = 0;
    let privacyBlocked = 0;

    const emptySummary = { total: 0, successful: 0, ocrFailed: 0, privacyBlocked: 0, completedAt: new Date().toISOString() };
    if (total === 0) {
      await AsyncStorage.setItem(LAST_BULK_IMPORT_KEY, JSON.stringify(emptySummary));
      return emptySummary;
    }

    const queue = await getActionQueue();
    
    // Fetch privacy settings
    const privacyRules = await getSetting(SETTINGS_KEYS.PRIVACY_RULES, {
      blockFinancial: true,
      blockAuth: true,
      blockPersonalId: true,
      blockContacts: true,
      blockMedical: true,
      blockChats: true,
    });

    // 2. Process in batches with concurrency limit
    for (let i = 0; i < assets.length; i += BULK_CONCURRENCY_LIMIT) {
      const batch = assets.slice(i, i + BULK_CONCURRENCY_LIMIT);
      
      // Process each item in the batch concurrently (up to BULK_CONCURRENCY_LIMIT)
      const batchPromises = batch.map(async (asset) => {
        // De-duplicate check
        if (queue.some(item => item.assetId === asset.id)) {
          successful++; // Already processed
          processed++;
          if (onProgress) onProgress(processed / total);
          return;
        }

        const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
        const uri = assetInfo.localUri || asset.uri;
        
        // Use the centralized pipeline
        const result = await processScreenshot(uri, { privacyRules });
        
        if (result.status === 'success') {
          const queueItem = {
            id: `${Date.now()}-${asset.id}`,
            assetId: asset.id,
            imageUri: uri,
            timestamp: asset.creationTime,
            ...result,
            status: 'queued',
          };

          await saveActionItem(queueItem);
          successful++;
        } else if (result.status === 'privacy_blocked') {
          privacyBlocked++;
        } else if (result.status === 'ocr_failed' || result.status === 'ocr_error') {
          ocrFailed++;
        }

        processed++;
        if (onProgress) onProgress(processed / total);
      });

      // Wait for this batch to complete before starting the next one
      await Promise.all(batchPromises);

      // Delay between batches to prevent API rate limiting
      if (i + BULK_CONCURRENCY_LIMIT < assets.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const summary = {
      total,
      successful,
      ocrFailed,
      privacyBlocked,
      completedAt: new Date().toISOString(),
    };

    // Persist summary so it survives app restarts and can be shown in Settings
    await AsyncStorage.setItem(LAST_BULK_IMPORT_KEY, JSON.stringify(summary));

    return summary;
  } catch (error) {
    console.error('[DataManagement] Bulk import failed:', error);
    throw error;
  }
}
