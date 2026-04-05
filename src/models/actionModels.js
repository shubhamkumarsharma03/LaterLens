import { STORAGE_KEYS as GLOBAL_STORAGE_KEYS } from '../constants/storageKeys';

export const CONTENT_TYPES = [
  'Product',
  'Study material',
  'Idea',
  'Code',
  'Event',
  'Receipt',
];

export const INTENTS = ['Buy', 'Read', 'Build', 'Attend', 'Pay', 'Review'];

export const ACTION_STATUSES = {
  QUEUED: 'queued',
  SNOOZED: 'snoozed',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

export const STORAGE_KEYS = {
  ACTION_QUEUE: GLOBAL_STORAGE_KEYS.ACTION_ITEMS,
};
