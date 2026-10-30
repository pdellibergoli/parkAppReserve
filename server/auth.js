import { createHash, randomUUID } from 'node:crypto';
import { CONFIG, baseUrl } from './config.js';
import { AppError } from './errors.js';
import { userToApi } from './mappers.js';

// SHA-256(password + salt): stesso schema degli account esistenti, così restano validi.
export function hashPassword(password, salt) {
  return createHash('sha256').update(password + salt).digest('hex');
}

async function findUserBy(db, column, value) {
  const { rows } = await db.query(`SELECT * FROM users WHERE ${column} = $1`, [value]);
  return rows[0];
}

export async function loginUser(ctx, { mail, password }) {
  if (!mail || !password) throw new AppError('Email e password sono obbligatorie.');

  const user = await findUserBy(ctx.db, 'mail', mail);
  if (!user) throw new AppError('Email o password non corretta.');

  if (!user.is_verified) {
    return {
      verificationNeeded: true,
      message: 'Devi prima verificare la tua email. Controlla la tua casella di posta per il link di conferma.',
    };
  }

  if (hashPassword(password, user.salt) !== user.password) throw new AppError('Email o password non corretta.');
  return userToApi(user);
}

export async function signupUser(ctx, { firstName, lastName, mail, password }) {
  if (!firstName || !mail || !password) throw new AppError('Nome, email e password sono obbligatori.');
  if (await findUserBy(ctx.db, 'mail', mail)) throw new AppError('Un utente con questa email esiste già.');

  const salt = randomUUID();
  const id = `user_${Date.now()}`;
  const verificationToken = randomUUID();

  await ctx.db.query(
    `INSERT INTO users (id, first_name, last_name, mail, password, salt, verification_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, firstName, lastName, mail, hashPassword(password, salt), salt, verificationToken]
  );

  ctx.outbox.push({
    to: mail,
    critical: true,
    subject: "Conferma la tua registrazione all'App Parcheggi",
    text: `Ciao ${firstName},\n\nGrazie per esserti registrato! Per favore, clicca sul link seguente per confermare il tuo indirizzo email:\n\n${baseUrl()}verify-email?token=${verificationToken}`,
  });

  return { id, firstName, lastName, mail };
}

export async function resendVerificationEmail(ctx, { mail }) {
  if (!mail) throw new AppError('Email non fornita.');

  const user = await findUserBy(ctx.db, 'mail', mail);
  if (!user) throw new AppError('Nessun utente trovato con questa email.');
  if (user.is_verified) throw new AppError('Questo account è già stato verificato.');

  const token = randomUUID();
  await ctx.db.query('UPDATE users SET verification_token = $2 WHERE id = $1', [user.id, token]);

  ctx.outbox.push({
    to: mail,
    critical: true,
    subject: 'Nuova richiesta di conferma email - App Parcheggi',
    text: `Ciao ${user.first_name},\n\nClicca sul nuovo link per confermare il tuo indirizzo email:\n\n${baseUrl()}verify-email?token=${token}`,
  });

  return { message: 'Una nuova email di verifica è stata inviata al tuo indirizzo.' };
}

export async function verifyEmailToken(ctx, { token }) {
  if (!token) throw new AppError('Token mancante.');

  const { rowCount } = await ctx.db.query(
    'UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE verification_token = $1',
    [token]
  );
  if (rowCount === 0) throw new AppError('Token non valido o scaduto.');

  return { message: 'Email verificata con successo!' };
}

export async function requestPasswordReset(ctx, { mail }) {
  if (!mail) throw new AppError('Email non fornita.');

  const user = await findUserBy(ctx.db, 'mail', mail);
  if (!user) throw new AppError('Nessun utente trovato con questa email.');

  const token = randomUUID();
  await ctx.db.query(
    'UPDATE users SET reset_token = $2, reset_token_expiry = $3 WHERE id = $1',
    [user.id, token, new Date(Date.now() + CONFIG.TOKEN_EXPIRY)]
  );

  ctx.outbox.push({
    to: mail,
    critical: true,
    subject: 'Recupero Password - App Parcheggi',
    text: `Ciao,\n\nHai richiesto di resettare la tua password. Clicca sul link seguente per procedere (il link è valido per un'ora):\n\n${baseUrl()}reset-password?token=${token}`,
  });

  return { message: 'Email di recupero inviata con successo.' };
}

export async function resetPassword(ctx, { token, newPassword }) {
  if (!token || !newPassword) throw new AppError('Token o nuova password mancanti.');

  const user = await findUserBy(ctx.db, 'reset_token', token);
  if (!user) throw new AppError('Token non valido o scaduto.');
  if (Date.now() >= new Date(user.reset_token_expiry).getTime()) throw new AppError('Token scaduto.');

  const salt = randomUUID();
  await ctx.db.query(
    'UPDATE users SET password = $2, salt = $3, reset_token = NULL, reset_token_expiry = NULL WHERE id = $1',
    [user.id, hashPassword(newPassword, salt), salt]
  );

  return { message: 'Password aggiornata con successo.' };
}
