import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  SCREENSHOT_ALBUM_ID: 'laterlens_screenshot_album_id',
  SCREENSHOT_ALBUM_TITLE: 'laterlens_screenshot_album_title',
  HAS_INITIAL_SCAN_COMPLETED: 'laterlens_has_initial_scan_completed',
  LAST_SCANNED_TIMESTAMP: 'laterlens_last_scanned_timestamp',
  GROQ_API_KEY: 'laterlens_groq_api_key',
};

/**
 * Saves the user's preferred screenshot album.
 */
export async function saveScreenshotAlbum(albumId, albumTitle) {
  try {
    await AsyncStorage.multiSet([
      [KEYS.SCREENSHOT_ALBUM_ID, albumId || ''],
      [KEYS.SCREENSHOT_ALBUM_TITLE, albumTitle || ''],
      [KEYS.HAS_INITIAL_SCAN_COMPLETED, 'false'], // Reset trigger for initial scan
    ]);
    console.log('[Settings] Saved album & reset initial scan flag:', albumTitle, albumId);
  } catch (error) {
    console.log('[Settings] Failed to save album:', error);
  }
}

/**
 * Retrieves the user's preferred screenshot album.
 */
export async function getScreenshotAlbum() {
  try {
    const values = await AsyncStorage.multiGet([
      KEYS.SCREENSHOT_ALBUM_ID,
      KEYS.SCREENSHOT_ALBUM_TITLE,
    ]);
    
    return {
      albumId: values[0][1],
      albumTitle: values[1][1],
    };
  } catch (error) {
    console.log('[Settings] Failed to get album:', error);
    return { albumId: null, albumTitle: null };
  }
}

/**
 * Scan state management
 */
export async function getInitialScanStatus() {
  try {
    const value = await AsyncStorage.getItem(KEYS.HAS_INITIAL_SCAN_COMPLETED);
    return value === 'true';
  } catch (error) {
    return false;
  }
}

export async function setInitialScanStatus(completed) {
  try {
    await AsyncStorage.setItem(KEYS.HAS_INITIAL_SCAN_COMPLETED, completed ? 'true' : 'false');
  } catch (error) {}
}

export async function getLastScannedTimestamp() {
  try {
    const value = await AsyncStorage.getItem(KEYS.LAST_SCANNED_TIMESTAMP);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    return 0;
  }
}

export async function setLastScannedTimestamp(timestamp) {
  try {
    await AsyncStorage.setItem(KEYS.LAST_SCANNED_TIMESTAMP, String(timestamp));
  } catch (error) {}
}

/**
 * Groq API Key management
 */
export async function getGroqApiKey() {
  try {
    return await AsyncStorage.getItem(KEYS.GROQ_API_KEY);
  } catch (error) {
    return null;
  }
}

export async function saveGroqApiKey(key) {
  try {
    if (key) {
      await AsyncStorage.setItem(KEYS.GROQ_API_KEY, key);
    } else {
      await AsyncStorage.removeItem(KEYS.GROQ_API_KEY);
    }
    return true;
  } catch (error) {
    console.log('[Settings] Failed to save Groq key:', error);
    return false;
  }
}
