import { hashPassword } from '../../server/auth.js';
import { addDays, isWeekday, today } from '../../server/dates.js';

export const DEMO_PASSWORD = 'Password123!';
const SALT = 'dev-salt';

export const DEMO_USERS = [
  { id: 'user_admin', firstName: 'Anna', lastName: 'Admin', mail: 'admin@parkapp.local', isAdmin: true, color: '#DE1F3C' },
  { id: 'user_mario', firstName: 'Mario', lastName: 'Rossi', mail: 'mario@parkapp.local', isAdmin: false, color: '#1F6FDE' },
  { id: 'user_giulia', firstName: 'Giulia', lastName: 'Bianchi', mail: 'giulia@parkapp.local', isAdmin: false, color: '#1FA35B' },
  { id: 'user_luca', firstName: 'Luca', lastName: 'Verdi', mail: 'luca@parkapp.local', isAdmin: false, color: '#B86E00' },
  { id: 'user_sara', firstName: 'Sara', lastName: 'Neri', mail: 'sara@parkapp.local', isAdmin: false, color: '#7A3FD1' },
];

const SPACES = [
  { id: 'space_p1', number: 'P1', isFixed: true },
  { id: 'space_p2', number: 'P2', isFixed: true },
  { id: 'space_p3', number: 'P3', isFixed: false },
];

export function nextWeekday(day) {
  let next = addDays(day, 1);
  while (!isWeekday(next)) next = addDays(next, 1);
  return next;
}

function previousWeekdays(count) {
  const days = [];
  let day = today();
  while (days.length < count) {
    day = addDays(day, -1);
    if (isWeekday(day)) days.push(day);
  }
  return days;
}

/** Carica i dati di esempio. Restituisce il prossimo giorno lavorativo, quello con le richieste in attesa. */
export async function seedDemoData(db) {
  for (const user of DEMO_USERS) {
    await db.query(
      `INSERT INTO users (id, first_name, last_name, mail, password, salt, avatar_color, is_verified, is_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)`,
      [user.id, user.firstName, user.lastName, user.mail, hashPassword(DEMO_PASSWORD, SALT), SALT, user.color, user.isAdmin]
    );
  }

  for (const space of SPACES) {
    await db.query('INSERT INTO parking_spaces (id, number, is_fixed) VALUES ($1, $2, $3)', [space.id, space.number, space.isFixed]);
  }

  // Storico: ad ogni giorno i primi due in rotazione ottengono i posti fissi, con esiti disuguali
  // grazie al peso di Mario, così le percentuali di priorità risultano diverse fra gli utenti.
  const rotation = [DEMO_USERS[1], DEMO_USERS[2], DEMO_USERS[1], DEMO_USERS[3], DEMO_USERS[1], DEMO_USERS[4], DEMO_USERS[2], DEMO_USERS[0]];
  for (const [index, day] of previousWeekdays(20).entries()) {
    const first = rotation[index % rotation.length];
    const second = rotation[(index + 1) % rotation.length];
    const winners = first.id === second.id ? [first] : [first, second];

    for (const user of DEMO_USERS) {
      const winnerIndex = winners.indexOf(user);
      const assigned = winnerIndex !== -1;
      const space = assigned ? SPACES[winnerIndex] : null;
      await db.query(
        `INSERT INTO parking_requests
           (request_id, user_id, requested_date, status, assigned_parking_space_id, assigned_parking_space_number)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [`req_seed_${index}_${user.id}`, user.id, day, assigned ? 'assigned' : 'not_assigned', space?.id ?? null, space?.number ?? null]
      );
      if (assigned) {
        await db.query(
          'INSERT INTO assignment_history (user_id, assignment_date, parking_space_id) VALUES ($1, $2, $3)',
          [user.id, day, space.id]
        );
      }
    }
  }

  // Prossimo giorno lavorativo: più richieste che posti, pronto per l'assegnazione
  const nextDay = nextWeekday(today());
  for (const user of DEMO_USERS) {
    await db.query(
      `INSERT INTO parking_requests (request_id, user_id, requested_date, status) VALUES ($1, $2, $3, 'pending')`,
      [`req_seed_next_${user.id}`, user.id, nextDay]
    );
  }
  await db.query(
    'INSERT INTO temporary_availability (availability_id, parking_space_id, available_date) VALUES ($1, $2, $3)',
    ['avail_seed_next', 'space_p3', nextDay]
  );

  await db.query(
    'INSERT INTO communications (id, message, is_persistent, start_date, end_date) VALUES ($1, $2, TRUE, $3, $4)',
    ['comm_seed', 'Ambiente di sviluppo: i dati sono di esempio.', addDays(today(), -1), addDays(today(), 30)]
  );

  return nextDay;
}
