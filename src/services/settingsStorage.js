import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

const KEYS = {
  SCREENSHOT_ALBUM_ID: STORAGE_KEYS.SCREENSHOT_ALBUM_ID,
  SCREENSHOT_ALBUM_TITLE: STORAGE_KEYS.SCREENSHOT_ALBUM_TITLE,
  HAS_INITIAL_SCAN_COMPLETED: STORAGE_KEYS.HAS_INITIAL_SCAN_COMPLETED,
  LAST_SCANNED_TIMESTAMP: STORAGE_KEYS.LAST_SCANNED_TIMESTAMP,
  GROQ_API_KEY: STORAGE_KEYS.GROQ_API_KEY,
  
  // AI & Processing
  AI_MODE: STORAGE_KEYS.AI_MODE, // 'cloud' (default) or 'on-device'
  AUTO_PROCESSING_ENABLED: STORAGE_KEYS.AUTO_PROCESSING_ENABLED,
  WIFI_ONLY: STORAGE_KEYS.WIFI_ONLY,
  
  // Folders & Import
  WATCHED_FOLDER_IDS: STORAGE_KEYS.WATCHED_FOLDER_IDS,
  EXCLUSION_RULES: STORAGE_KEYS.EXCLUSION_RULES,
  
  // Notifications
  DAILY_DIGEST_TIME: STORAGE_KEYS.DAILY_DIGEST_TIME,
  NOTIFICATION_CONFIG: STORAGE_KEYS.NOTIFICATION_CONFIG,
  QUIET_HOURS: STORAGE_KEYS.QUIET_HOURS,
  
  // Data & Storage
  AUTO_ARCHIVE_DAYS: STORAGE_KEYS.AUTO_ARCHIVE_DAYS,
  
  // Privacy
  PRIVACY_RULES: STORAGE_KEYS.PRIVACY_RULES,
};

/**
 * Generic getter/setter helpers
 */
export async function getSetting(key, defaultValue) {
  try {
    const val = await AsyncStorage.getItem(key);
    return val !== null ? JSON.parse(val) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

export async function saveSetting(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export const SETTINGS_KEYS = KEYS;

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
