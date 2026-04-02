import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import {
  getActionQueue,
  replaceActionQueue,
  saveActionItem,
} from '../services/actionQueueStorage';
import { initialQueueState, QUEUE_ACTIONS, queueReducer } from './queueReducer';
import { generateMockCollections } from '../services/mockData';

const QueueContext = createContext(null);

const STATUS = {
  QUEUED: 'queued',
  SNOOZED: 'snoozed',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

function normalizeItem(item) {
  return {
    ...item,
    status: item?.status || STATUS.QUEUED,
    snoozeUntil: item?.snoozeUntil || null,
    intent: item?.intent || 'I think you want to look at this later.',
    notes: item?.notes || '',
    source: item?.source || 'Screenshot',
    tags: item?.tags || [],
    viewed: item?.viewed || false,
  };
}

function sortNewest(items) {
  return [...items].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export function QueueProvider({ children }) {
  const [state, dispatch] = useReducer(queueReducer, initialQueueState);

  const persistQueue = useCallback(async (nextItems) => {
    const normalized = sortNewest(nextItems.map(normalizeItem));
    await replaceActionQueue(normalized);
    dispatch({ type: QUEUE_ACTIONS.SET_ITEMS, payload: normalized });
    return normalized;
  }, []);

  const hydrateQueue = useCallback(async () => {
    let queue = await getActionQueue();
    const normalized = sortNewest(queue.map(normalizeItem));
    dispatch({ type: QUEUE_ACTIONS.HYDRATE, payload: normalized });
    return normalized;
  }, []);

  const addQueueItem = useCallback(async (item) => {
    const updatedQueue = await saveActionItem(
      normalizeItem({
        ...item,
        status: STATUS.QUEUED,
        snoozeUntil: null,
      })
    );
    dispatch({ type: QUEUE_ACTIONS.HYDRATE, payload: updatedQueue.map(normalizeItem) });
    return updatedQueue;
  }, []);

  const completeQueueItem = useCallback(
    async (itemId) => {
      const nextQueue = state.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status: STATUS.COMPLETED,
              snoozeUntil: null,
            }
          : item
      );
      return persistQueue(nextQueue);
    },
    [state.items, persistQueue]
  );

  const archiveQueueItem = useCallback(
    async (itemId) => {
      const nextQueue = state.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status: STATUS.ARCHIVED,
              snoozeUntil: null,
            }
          : item
      );
      return persistQueue(nextQueue);
    },
    [state.items, persistQueue]
  );

  const snoozeQueueItem = useCallback(
    async (itemId, minutes = 60) => {
      const snoozeUntil = Date.now() + minutes * 60 * 1000;
      const nextQueue = state.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status: STATUS.SNOOZED,
              snoozeUntil,
            }
          : item
      );
      return persistQueue(nextQueue);
    },
    [state.items, persistQueue]
  );

  const reviveDueSnoozed = useCallback(async () => {
    const now = Date.now();
    let hasChanges = false;
    const nextQueue = state.items.map((item) => {
      if (item.status === STATUS.SNOOZED && item.snoozeUntil && item.snoozeUntil <= now) {
        hasChanges = true;
        return {
          ...item,
          status: STATUS.QUEUED,
          snoozeUntil: null,
        };
      }

      return item;
    });

    if (!hasChanges) {
      return state.items;
    }

    return persistQueue(nextQueue);
  }, [state.items, persistQueue]);

  const updateQueueItem = useCallback(
    async (itemId, updates) => {
      const nextQueue = state.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      );
      dispatch({ type: QUEUE_ACTIONS.UPDATE_ITEM, payload: { id: itemId, updates } });
      // Persist to storage
      await replaceActionQueue(nextQueue);
      return nextQueue;
    },
    [state.items]
  );

  const markAsViewed = useCallback(
    async (itemId) => {
      const item = state.items.find((i) => i.id === itemId);
      if (item && !item.viewed) {
        return updateQueueItem(itemId, { viewed: true });
      }
    },
    [state.items, updateQueueItem]
  );

  const removeQueueItem = useCallback(
    async (itemId) => {
      const nextQueue = state.items.filter((item) => item.id !== itemId);
      return persistQueue(nextQueue);
    },
    [state.items, persistQueue]
  );

  const getItemById = useCallback(
    (itemId) => state.items.find((item) => item.id === itemId),
    [state.items]
  );

  const queueItems = useMemo(
    () => sortNewest(state.items.filter((item) => item.status === STATUS.QUEUED)),
    [state.items]
  );

  const collectionItems = useMemo(
    () => sortNewest(state.items.filter((item) => item.status !== STATUS.ARCHIVED)),
    [state.items]
  );

  const bulkDelete = useCallback(
    async (itemIds) => {
      const nextQueue = state.items.filter((item) => !itemIds.includes(item.id));
      return persistQueue(nextQueue);
    },
    [state.items, persistQueue]
  );

  const bulkUpdateStatus = useCallback(
    async (itemIds, status) => {
      const nextQueue = state.items.map((item) =>
        itemIds.includes(item.id) ? { ...item, status, snoozeUntil: null } : item
      );
      return persistQueue(nextQueue);
    },
    [state.items, persistQueue]
  );

  const bulkUpdateCategory = useCallback(
    async (itemIds, contentType) => {
      const nextQueue = state.items.map((item) =>
        itemIds.includes(item.id) ? { ...item, contentType } : item
      );
      return persistQueue(nextQueue);
    },
    [state.items, persistQueue]
  );

  const value = useMemo(
    () => ({
      allItems: state.items,
      queueItems,
      collectionItems,
      queueHydrated: state.hydrated,
      hydrateQueue,
      addQueueItem,
      completeQueueItem,
      archiveQueueItem,
      snoozeQueueItem,
      reviveDueSnoozed,
      removeQueueItem,
      updateQueueItem,
      markAsViewed,
      getItemById,
      bulkDelete,
      bulkUpdateStatus,
      bulkUpdateCategory,
    }),
    [
      state.items,
      state.hydrated,
      queueItems,
      collectionItems,
      hydrateQueue,
      addQueueItem,
      completeQueueItem,
      archiveQueueItem,
      snoozeQueueItem,
      reviveDueSnoozed,
      removeQueueItem,
      updateQueueItem,
      markAsViewed,
      getItemById,
      bulkDelete,
      bulkUpdateStatus,
      bulkUpdateCategory,
    ]
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue() {
  const context = useContext(QueueContext);

  if (!context) {
    throw new Error('useQueue must be used within QueueProvider.');
  }

  return context;
}
