/**
 * Safe localStorage wrappers — never throw.
 * localStorage can throw SecurityError in incognito / restricted browsers,
 * QuotaExceededError when full, or be undefined in SSR contexts.
 */

export const safeGetItem = (key: string): string | null => {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const safeSetItem = (key: string, value: string): void => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    /* silently fail */
  }
};

export const safeRemoveItem = (key: string): void => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  } catch {
    /* silently fail */
  }
};

export const safeGetJSON = <T,>(key: string, fallback: T): T => {
  const raw = safeGetItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const safeSetJSON = (key: string, value: unknown): void => {
  try {
    safeSetItem(key, JSON.stringify(value));
  } catch {
    /* silently fail */
  }
};
