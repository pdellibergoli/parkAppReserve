import { AppError } from '../server/errors.js';
import { readJsonBody, sendJson } from '../server/http.js';
import { handleAction } from '../server/router.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { status: 'error', message: 'Metodo non consentito.' });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { status: 'error', message: 'Il corpo della richiesta non è un JSON valido.' });
  }
  if (!body?.action) return sendJson(res, 400, { status: 'error', message: 'Azione non specificata.' });

  try {
    const data = await handleAction(body.action, body.payload ?? {});
    return sendJson(res, 200, { status: 'success', data });
  } catch (err) {
    if (err instanceof AppError) return sendJson(res, 400, { status: 'error', message: err.message });
    console.error(`Errore azione ${body.action}:`, err);
    return sendJson(res, 500, { status: 'error', message: 'Errore interno del server.' });
  }
}
