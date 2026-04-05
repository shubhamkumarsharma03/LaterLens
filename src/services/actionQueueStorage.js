import AsyncStorage from '@react-native-async-storage/async-storage';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../constants/storageKeys';

const ACTION_QUEUE_KEY = STORAGE_KEYS.ACTION_ITEMS;

async function getQueueRawWithMigration() {
  const currentRaw = await AsyncStorage.getItem(ACTION_QUEUE_KEY);
  if (currentRaw !== null) {
    return currentRaw;
  }

  for (const legacyKey of LEGACY_STORAGE_KEYS.ACTION_ITEMS || []) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (legacyRaw !== null) {
      try {
        await AsyncStorage.setItem(ACTION_QUEUE_KEY, legacyRaw);
      } catch (error) {
        console.error('[Storage] Failed to migrate action queue to primary key:', error);
      }
      return legacyRaw;
    }
  }

  return null;
}

export async function getActionQueue() {
  try {
    const rawValue = await getQueueRawWithMigration();

    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  } catch (error) {
    console.error('[Storage] Failed to read action queue:', error);
    return [];
  }
}

export async function saveActionItem(newItem) {
  try {
    const queue = await getActionQueue();
    const updatedQueue = [newItem, ...queue].sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );

    await AsyncStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(updatedQueue));

    return updatedQueue;
  } catch (error) {
    console.error('[Storage] Failed to save action item:', error);
    throw error;
  }
}

/**
 * Saves an item that was either blocked by privacy or failed OCR.
 * These items stay local and are never sent to Groq.
 */
export async function saveLocalOnlyItem(item) {
  const newItem = {
    ...item,
    id: item.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: item.timestamp || Date.now(),
    tags: item.tags || ['local-only'],
    summary: item.summary || item.sensitivitySummary || 'No analysis available.',
    status: item.status || 'privacy_blocked',
  };

  return await saveActionItem(newItem);
}

export async function replaceActionQueue(nextQueue) {
  try {
    const sortedQueue = [...nextQueue].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    await AsyncStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(sortedQueue));
    return sortedQueue;
  } catch (error) {
    console.error('[Storage] Failed to replace action queue:', error);
    throw error;
  }
}

export async function clearActionQueue() {
  try {
    await AsyncStorage.removeItem(ACTION_QUEUE_KEY);
    return true;
  } catch (error) {
    console.error('[Storage] Failed to clear action queue:', error);
    return false;
  }
}
