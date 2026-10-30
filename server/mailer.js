import nodemailer from 'nodemailer';
import { AppError } from './errors.js';

let transport = null;

export function setMailTransport(customTransport) {
  transport = customTransport;
}

function getTransport() {
  if (!transport) {
    if (!process.env.SMTP_HOST) throw new Error('SMTP_HOST non impostata.');
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

export async function deliver({ to, subject, text }) {
  return getTransport().sendMail({
    from: process.env.MAIL_FROM || 'Park app <noreply@park-app.com>',
    replyTo: process.env.MAIL_REPLY_TO || undefined,
    to,
    subject,
    text,
  });
}

/**
 * Invia le email accumulate durante un'azione, dopo il commit: se la transazione fallisce
 * nessuno riceve notifiche di operazioni mai avvenute. Un invio fallito non annulla
 * l'operazione, salvo le email `critical` senza le quali l'utente non può proseguire.
 */
export async function flushOutbox(outbox) {
  const results = await Promise.allSettled(outbox.map(deliver));
  let criticalFailure = false;
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Invio email a ${outbox[i].to} fallito:`, result.reason?.message);
      if (outbox[i].critical) criticalFailure = true;
    }
  });
  if (criticalFailure) {
    throw new AppError("Operazione salvata, ma non è stato possibile inviare l'email. Riprova più tardi.");
  }
}
