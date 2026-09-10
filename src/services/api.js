const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

if (!SCRIPT_URL) {
  console.error("CRITICO: La variabile d'ambiente per l'URL dello script non è impostata!");
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pendingRequests = new Map();

/**
 * Gestore Fetch robusto con gestione del Retry
 */
async function fetchWithRetry(options, retries = 3, backoff = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(SCRIPT_URL, { ...options, redirect: 'follow' });
      const text = await response.text();

      // Scarta se la risposta è la pagina di errore/login HTML di Google
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        throw new Error(`Risposta HTML non valida da Google Apps Script`);
      }

      return JSON.parse(text);
    } catch (err) {
      console.warn(`[API Retry] Tentativo ${attempt}/${retries} fallito:`, err.message);
      if (attempt === retries) throw err;
      await delay(backoff * attempt);
    }
  }
}

/**
 * Funzione principale API (Usa POST per compatibilità con doPost su Apps Script)
 */
export const callApi = async (action, payload = {}) => {
  const cacheKey = `${action}_${JSON.stringify(payload)}`;
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload, data: payload }),
  };

  const requestPromise = (async () => {
    try {
      const result = await fetchWithRetry(requestOptions);

      if (result && Array.isArray(result.logs)) {
        console.groupCollapsed(`[API Logs per ${action}]`);
        result.logs.forEach((logMsg) => console.debug(logMsg));
        console.groupEnd();
      }

      if (result && result.status === 'error') {
        throw new Error(result.message || `Errore backend per ${action}`);
      }

      return result ? (result.data !== undefined ? result.data : result) : null;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
};

export const fetchData = (action, params) => callApi(action, params);
export const postData = (action, data) => callApi(action, data);