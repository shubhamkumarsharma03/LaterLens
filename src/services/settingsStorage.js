import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  SCREENSHOT_ALBUM_ID: 'laterlens_screenshot_album_id',
  SCREENSHOT_ALBUM_TITLE: 'laterlens_screenshot_album_title',
};

/**
 * Saves the user's preferred screenshot album.
 */
export async function saveScreenshotAlbum(albumId, albumTitle) {
  try {
    await AsyncStorage.multiSet([
      [KEYS.SCREENSHOT_ALBUM_ID, albumId || ''],
      [KEYS.SCREENSHOT_ALBUM_TITLE, albumTitle || ''],
    ]);
    console.log('[Settings] Saved album:', albumTitle, albumId);
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
