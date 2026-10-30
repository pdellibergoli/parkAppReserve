import { randomUUID } from 'node:crypto';
import { computePriorityStats } from './assignment.js';
import { hashPassword } from './auth.js';
import { CONFIG } from './config.js';
import { AppError } from './errors.js';
import { userToApi } from './mappers.js';

export async function getAllUsers(db) {
  const { rows } = await db.query('SELECT * FROM users ORDER BY id');
  return rows.map(userToApi);
}

export async function updateUserProfile(ctx, payload) {
  const { id, firstName, lastName, mail, avatarColor, password, preferredTheme, primaryColor } = payload;
  if (!id) throw new AppError("ID utente non fornito per l'aggiornamento.");

  const { rows: existing } = await ctx.db.query('SELECT id FROM users WHERE id = $1', [id]);
  if (existing.length === 0) throw new AppError("Utente non trovato per l'aggiornamento.");

  if (mail !== undefined) {
    const { rows: taken } = await ctx.db.query('SELECT id FROM users WHERE mail = $1 AND id <> $2', [mail, id]);
    if (taken.length > 0) throw new AppError('Un utente con questa email esiste già.');
  }

  const fields = {
    first_name: firstName,
    last_name: lastName,
    mail,
    avatar_color: avatarColor,
    preferred_theme: preferredTheme,
    primary_color: primaryColor,
  };
  if (password) {
    const salt = randomUUID();
    fields.password = hashPassword(password, salt);
    fields.salt = salt;
  }

  const columns = Object.keys(fields).filter((column) => fields[column] !== undefined);
  if (columns.length > 0) {
    const assignments = columns.map((column, i) => `${column} = $${i + 2}`).join(', ');
    await ctx.db.query(`UPDATE users SET ${assignments} WHERE id = $1`, [id, ...columns.map((c) => fields[c])]);
  }

  const { rows } = await ctx.db.query('SELECT * FROM users WHERE id = $1', [id]);
  return userToApi(rows[0]);
}

export async function getUsersWithPriority(ctx) {
  const users = await getAllUsers(ctx.db);
  const stats = await computePriorityStats(ctx.db);
  return users.map((user) => ({
    ...user,
    ...stats.get(user.id),
    windowDays: CONFIG.LOOK_BACK_DAYS,
  }));
}
