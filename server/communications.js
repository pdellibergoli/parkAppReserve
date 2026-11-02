import { dayToIso, today, toDay } from './dates.js';
import { AppError } from './errors.js';
import { deliver } from './mailer.js';

export async function sendAdminCommunication(ctx, { message, isPersistent, startDate, endDate }) {
  if (!message) throw new AppError('Il messaggio non può essere vuoto.');
  if (isPersistent && (!startDate || !endDate)) {
    throw new AppError('Data inizio e fine obbligatorie per messaggi persistenti.');
  }
  const start = isPersistent ? toDay(startDate) : null;
  const end = isPersistent ? toDay(endDate) : null;

  const { rows: users } = await ctx.db.query(
    'SELECT mail, first_name FROM users WHERE is_verified ORDER BY id'
  );

  const results = await Promise.allSettled(users.map((user) => deliver({
    to: user.mail,
    subject: 'Comunicazione di Servizio - Park App',
    text: `Ciao ${user.first_name},\n\n${message}\n\nCordiali saluti,\nL'Amministrazione`,
  })));
  results.forEach((result, i) => {
    if (result.status === 'rejected') console.error(`Invio a ${users[i].mail} fallito:`, result.reason?.message);
  });
  const emailCount = results.filter((result) => result.status === 'fulfilled').length;

  let banner = null;
  if (isPersistent) {
    const id = `comm_${Date.now()}`;
    await ctx.db.query(
      'INSERT INTO communications (id, message, is_persistent, start_date, end_date) VALUES ($1, $2, TRUE, $3, $4)',
      [id, message, start, end]
    );
    banner = { id, message, isPersistent: true, startDate: dayToIso(start), endDate: dayToIso(end) };
  }

  return { message: `Comunicazione inviata a ${emailCount} utenti.`, banner };
}

export async function getActiveCommunication(db) {
  const { rows } = await db.query(
    `SELECT id, message FROM communications
      WHERE is_persistent AND $1::date BETWEEN start_date AND end_date
      ORDER BY created_at DESC, id DESC`,
    [today()]
  );
  return rows;
}

export async function deleteCommunication(ctx, { id }) {
  if (!id) throw new AppError('ID comunicazione mancante.');
  const { rowCount } = await ctx.db.query('DELETE FROM communications WHERE id = $1', [id]);
  if (rowCount === 0) throw new AppError('Comunicazione non trovata.');
  return { message: 'Comunicazione cancellata con successo.' };
}
