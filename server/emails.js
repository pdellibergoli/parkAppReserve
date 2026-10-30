import { formatDay } from './dates.js';

async function findUser(ctx, userId) {
  const { rows } = await ctx.db.query('SELECT mail, first_name, last_name FROM users WHERE id = $1', [userId]);
  return rows[0];
}

export async function sendSuccessEmail(ctx, userId, day, spaceNumber) {
  const user = await findUser(ctx, userId);
  if (!user) return;
  ctx.outbox.push({
    to: user.mail,
    subject: 'Conferma Assegnazione Parcheggio',
    text: `Ciao ${user.first_name},\n\nLa tua richiesta di parcheggio per il giorno ${formatDay(day)} è stata approvata!\n\nTi è stato assegnato il posto: ${spaceNumber}\n\nBuona giornata!`,
  });
}

export async function sendFailureEmail(ctx, userId, day) {
  const user = await findUser(ctx, userId);
  if (!user) return;
  ctx.outbox.push({
    to: user.mail,
    subject: 'Esito Richiesta Parcheggio',
    text: `Ciao ${user.first_name},\n\nSiamo spiacenti, ma a causa dell'elevato numero di richieste, non è stato possibile assegnarti un parcheggio per il giorno ${formatDay(day)}.\n\nCi scusiamo per il disagio.`,
  });
}

export async function sendRequestCreatedEmail(ctx, userId, days, actorId) {
  const user = await findUser(ctx, userId);
  const actor = await findUser(ctx, actorId);
  if (!user || !actor) return;
  ctx.outbox.push({
    to: user.mail,
    subject: 'Nuova Richiesta Parcheggio Inserita',
    text: `Ciao ${user.first_name},\n\nL'amministratore ${actor.first_name} ${actor.last_name} ha inserito delle richieste di parcheggio a tuo nome per le seguenti date:\n\n${days.map(formatDay).join(', ')}\n\nRiceverai una conferma quando il posto verrà assegnato.\n\nBuona giornata!`,
  });
}

export async function sendAdminCancellationEmail(ctx, userId, day) {
  const user = await findUser(ctx, userId);
  if (!user) return;
  ctx.outbox.push({
    to: user.mail,
    subject: `Notifica: Richiesta Parcheggio Cancellata - ${formatDay(day)}`,
    text: `Ciao ${user.first_name},\n\nTi informiamo che la tua richiesta di parcheggio per il giorno ${formatDay(day)} è stata cancellata da un amministratore.\n\nBuona giornata!`,
  });
}

export async function sendAdminModificationEmail(ctx, userId, oldDay, newDay) {
  const user = await findUser(ctx, userId);
  if (!user) return;
  ctx.outbox.push({
    to: user.mail,
    subject: 'Notifica: Richiesta Parcheggio Modificata',
    text: `Ciao ${user.first_name},\n\nTi informiamo che un amministratore ha modificato una tua richiesta di parcheggio:\n\nData Originale: ${formatDay(oldDay)}\nNuova Data: ${formatDay(newDay)}\n\nBuona giornata!`,
  });
}

export async function sendDonationConfirmedEmail(ctx, donorId, recipientId, day, spaceNumber) {
  const donor = await findUser(ctx, donorId);
  const recipient = await findUser(ctx, recipientId);
  if (!donor) return;
  ctx.outbox.push({
    to: donor.mail,
    subject: 'Conferma Cessione Parcheggio',
    text: `Ciao ${donor.first_name},\n\nGrazie! Il tuo parcheggio (${spaceNumber}) per oggi (${formatDay(day)}) è stato ceduto con successo a ${recipient.first_name} ${recipient.last_name}.\n\nBuona giornata!`,
  });
}
