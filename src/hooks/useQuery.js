import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { ensureData, getEntryState, subscribeToEntry } from '../services/dataStore';

/** Legge una query da dataStore: dati in cache subito, aggiornamento in background quando servono. */
export function useQuery({ key, fetcher, ttl }) {
  const subscribe = useCallback((listener) => subscribeToEntry(key, listener), [key]);
  const state = useSyncExternalStore(subscribe, () => getEntryState(key));

  useEffect(() => {
    // L'errore è già nello stato della voce
    ensureData(key, fetcher, ttl).catch(() => {});
    // Il fetcher è ricreato ad ogni render, ma per una stessa chiave fa sempre la stessa chiamata
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    data: state.data,
    error: state.error,
    isLoading: state.data === undefined && !state.error,
  };
}
