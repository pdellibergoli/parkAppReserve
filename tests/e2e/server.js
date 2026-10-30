// Serve la build di produzione con le API reali, come Vercel: file statici da dist/ e /api/rpc.
// Per primo: l'orologio simulato deve esistere prima del codice del server
import { setFakeNow } from './fake-clock.js';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import cronHandler from '../../api/cron/assign.js';
import handler from '../../api/rpc.js';

const DIST = path.resolve('dist');
const CONTENT_TYPES = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/rpc') return handler(req, res);
  if (pathname === '/api/cron/assign') return cronHandler(req, res);

  // Solo in questo server di test: porta il server a un'ora precisa, o a quella iniziale senza parametro
  if (pathname === '/__test/clock') {
    setFakeNow(new URL(req.url, 'http://localhost').searchParams.get('now') ?? process.env.E2E_NOW);
    return res.end();
  }

  // Come il rewrite di vercel.json: i percorsi senza estensione sono route dell'app
  const file = path.extname(pathname) ? path.join(DIST, path.normalize(pathname)) : path.join(DIST, 'index.html');
  try {
    const content = await readFile(file);
    res.setHeader('Content-Type', CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream');
    res.end(content);
  } catch {
    res.statusCode = 404;
    res.end();
  }
}).listen(Number(process.env.PORT));
