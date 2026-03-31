import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import {
  getActionQueue,
  replaceActionQueue,
  saveActionItem,
} from '../services/actionQueueStorage';
import { initialQueueState, QUEUE_ACTIONS, queueReducer } from './queueReducer';

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
    const queue = await getActionQueue();
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
      getItemById,
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
      getItemById,
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
