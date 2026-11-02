export const CONFIG = {
  // Vercel gira in UTC: giorni e orari di business si calcolano sempre su questo fuso
  TIME_ZONE: 'Europe/Rome',
  TOKEN_EXPIRY: 3600000,
  ASSIGNMENT_HOUR: 19,
  LOOK_BACK_DAYS: 30,
};

export function baseUrl() {
  const url = process.env.APP_BASE_URL;
  if (!url) throw new Error('APP_BASE_URL non impostata.');
  return url.endsWith('/') ? url : `${url}/`;
}
