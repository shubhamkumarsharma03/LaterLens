import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { getScreenshotAlbum } from './settingsStorage';

const SCREENSHOT_NAME_CANDIDATES = ['screenshots', 'screenshot', 'captures', 'images'];

/**
 * findScreenshotAlbum - Finds the user's screenshot album.
 * Checks for a saved preference first, then defaults to common names.
 */
export async function findScreenshotAlbum() {
  const { albumId, albumTitle } = await getScreenshotAlbum();
  
  try {
    let albums = await MediaLibrary.getAlbumsAsync();
    if (Platform.OS === 'ios') {
      const smart = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
      albums = [...albums, ...smart];
    }

    // 1. Check for saved album by ID
    if (albumId) {
      const saved = albums.find(a => a.id === albumId);
      if (saved) {
        console.log('[MediaDiscovery] Found saved album by ID:', saved.title);
        return saved;
      }
    }

    // 2. Check for saved album by Title (fallback if ID changed)
    if (albumTitle) {
      const saved = albums.find(a => a.title === albumTitle);
      if (saved) {
        console.log('[MediaDiscovery] Found saved album by Title:', saved.title);
        return saved;
      }
    }

    // 3. Auto-discovery via common names
    const found = albums.find((album) => {
      const title = (album.title || '').toLowerCase();
      return SCREENSHOT_NAME_CANDIDATES.some((candidate) => title === candidate || title.includes(candidate));
    });

    if (found) {
      console.log('[MediaDiscovery] Auto-discovered screenshot album:', found.title);
      return found;
    }

    return null;
  } catch (error) {
    console.log('[MediaDiscovery] Failed to find album:', error);
    return null;
  }
}

/**
 * getAllUserAlbums - Returns a list of all user-facing photo albums.
 * Useful for the album picker UI.
 */
export async function getAllUserAlbums() {
  try {
    let albums = await MediaLibrary.getAlbumsAsync();
    if (Platform.OS === 'ios') {
      const smart = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
      // Filter out system albums we don't want (optional)
      albums = [...albums, ...smart];
    }
    
    // Sort albums alphabetically
    return albums.sort((a, b) => a.title.localeCompare(b.title));
  } catch (error) {
    console.log('[MediaDiscovery] Failed to fetch albums:', error);
    return [];
  }
}
