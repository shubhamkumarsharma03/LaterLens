import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTION_QUEUE_KEY = 'screenmind_action_queue_v1';

export async function getActionQueue() {
  try {
    const rawValue = await AsyncStorage.getItem(ACTION_QUEUE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  } catch (error) {
    console.log('[Storage] Failed to read action queue:', error);
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
    console.log('[Storage] Failed to save action item:', error);
    throw error;
  }
}

export async function replaceActionQueue(nextQueue) {
  try {
    const sortedQueue = [...nextQueue].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    await AsyncStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(sortedQueue));
    return sortedQueue;
  } catch (error) {
    console.log('[Storage] Failed to replace action queue:', error);
    throw error;
  }
}

export async function clearActionQueue() {
  try {
    await AsyncStorage.removeItem(ACTION_QUEUE_KEY);
    return true;
  } catch (error) {
    console.log('[Storage] Failed to clear action queue:', error);
    return false;
  }
}
