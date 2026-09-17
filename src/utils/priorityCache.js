const CACHE_KEY = 'user_priorities_cache';
const CACHE_TTL = 10 * 60 * 1000;

/**
 * Legge i dati di priorità dalla cache localstorage se ancora validi (< 10 min)
 */
export const getCachedPriorities = () => {
  const cached = localStorage.getItem(CACHE_KEY);
  if (!cached) return null;

  try {
    const { timestamp, data } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > CACHE_TTL;

    if (isExpired) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch (e) {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
};

/**
 * Salva i dati di priorità in localstorage firmandoli con il timestamp attuale
 */
export const setCachedPriorities = (data) => {
  try {
    const cacheObject = {
      timestamp: Date.now(),
      data: data
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObject));
  } catch (e) {
    console.warn("Impossibile salvare le priorità in localStorage:", e);
  }
};

/**
 * Forzi la pulizia della cache (da chiamare ad esempio dopo un reset o assegnazione manuale admin)
 */
export const clearPrioritiesCache = () => {
  localStorage.removeItem(CACHE_KEY);
};