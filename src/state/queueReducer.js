export const initialQueueState = {
  items: [],
  hydrated: false,
};

export const QUEUE_ACTIONS = {
  HYDRATE: 'HYDRATE',
  SET_ITEMS: 'SET_ITEMS',
  REMOVE_ITEM: 'REMOVE_ITEM',
  UPDATE_ITEM: 'UPDATE_ITEM',
};

export function queueReducer(state, action) {
  switch (action.type) {
    case QUEUE_ACTIONS.HYDRATE:
    case QUEUE_ACTIONS.SET_ITEMS:
      return {
        ...state,
        items: Array.isArray(action.payload) ? action.payload : [],
        hydrated: true,
      };
    case QUEUE_ACTIONS.REMOVE_ITEM:
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.payload),
      };
    case QUEUE_ACTIONS.UPDATE_ITEM:
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id ? { ...item, ...action.payload.updates } : item
        ),
      };
    default:
      return state;
  }
}
