import { format } from 'date-fns';
import { callApi } from './api';
import { cachedKeys, ensureData, peekData, updateData } from './dataStore';

// Quanto a lungo un dato è considerato fresco, prima di riaggiornarlo in background.
// Utenti, posti e comunicazioni cambiano di rado; richieste e priorità ogni giorno.
const REFERENCE_TTL = 5 * 60 * 1000;
const DAILY_DATA_TTL = 60 * 1000;

const query = (key, action, payload, ttl) => ({ key, fetcher: () => callApi(action, payload), ttl });

export const monthKeyOf = (value) => format(new Date(value), 'yyyy-MM');

const MONTH_PREFIX = 'month:';

export const referenceQuery = () => query('reference', 'getReferenceData', {}, REFERENCE_TTL);

export const monthQuery = (date) => query(
  `${MONTH_PREFIX}${monthKeyOf(date)}`,
  'getMonthData',
  { targetDate: format(date, 'yyyy-MM-dd') },
  DAILY_DATA_TTL
);

export const prioritiesQuery = () => query('priorities', 'getUsersWithPriority', {}, DAILY_DATA_TTL);

export const MY_REQUESTS_PAGE_SIZE = 20;

export const myRequestsQuery = (userId, page) => query(
  `requests:${userId}:${page}`,
  'getRequestsPage',
  { userId, page, pageSize: MY_REQUESTS_PAGE_SIZE },
  DAILY_DATA_TTL
);

export const userHistoryQuery = (userId, fromDate) => query(
  `history:${userId}`,
  'getRequests',
  { userId, fromDate },
  DAILY_DATA_TTL
);

export const prefetch = ({ key, fetcher, ttl }) => ensureData(key, fetcher, ttl).catch(() => {});

export const fetchQuery = ({ key, fetcher, ttl }) => ensureData(key, fetcher, ttl);

const isSameDay = (first, second) => format(new Date(first), 'yyyy-MM-dd') === format(new Date(second), 'yyyy-MM-dd');

const monthKeys = () => cachedKeys().filter((key) => key.startsWith(MONTH_PREFIX));

/** Aggiornamento ottimistico: la UI cambia subito, la conferma arriva dalla rilettura dopo la scrittura. */
export function applyRequestUpdate(updated) {
  if (!updated) return;

  const merge = (data) => {
    const index = data.requests.findIndex((r) => (
      r.requestId === updated.requestId
      || (updated.requestedDate && r.userId === updated.userId && isSameDay(r.requestedDate, updated.requestedDate))
    ));
    if (index === -1) return null;
    const requests = [...data.requests];
    requests[index] = { ...requests[index], ...updated };
    return { ...data, requests };
  };

  let found = false;
  for (const key of monthKeys()) {
    const merged = merge(peekData(key) ?? { requests: [] });
    if (merged) {
      updateData(key, () => merged);
      found = true;
    }
  }

  if (!found && updated.requestedDate) {
    updateData(`${MONTH_PREFIX}${monthKeyOf(updated.requestedDate)}`, (data) => ({
      ...data,
      requests: [...data.requests, updated],
    }));
  }
}

export function applyRequestDelete(requestId) {
  for (const key of monthKeys()) {
    updateData(key, (data) => ({ ...data, requests: data.requests.filter((r) => r.requestId !== requestId) }));
  }
}

/** Le richieste di tutti i mesi già caricati. */
export const cachedMonthRequests = () => monthKeys().flatMap((key) => peekData(key)?.requests ?? []);
