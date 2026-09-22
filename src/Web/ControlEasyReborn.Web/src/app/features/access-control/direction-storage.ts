export type AccessDirection = 'entrance' | 'exit';

export const ACCESS_DIRECTION_STORAGE_KEY = 'ce_access_direction';

export function getSavedAccessDirection(): AccessDirection {
  try {
    const saved = localStorage.getItem(ACCESS_DIRECTION_STORAGE_KEY);
    if (saved === 'entrance' || saved === 'exit') {
      return saved;
    }
  } catch {
    /* non-blocking */
  }
  return 'entrance';
}

export function saveAccessDirection(direction: AccessDirection): void {
  try {
    localStorage.setItem(ACCESS_DIRECTION_STORAGE_KEY, direction);
  } catch {
    /* non-blocking */
  }
}