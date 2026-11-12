// Test sul backend reale contro Postgres, nel database TEST_DATABASE_URL (azzerato ad ogni esecuzione).
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import pg from 'pg';
import { assertLocalDatabase, runMigrations } from '../scripts/lib/migrations.js';

const TEST_URL = process.env.TEST_DATABASE_URL;
assert.ok(TEST_URL, 'TEST_DATABASE_URL non impostata');
assertLocalDatabase(TEST_URL);
process.env.DATABASE_URL = TEST_URL;
process.env.APP_BASE_URL = 'http://test.local/';

// Mercoledì, ora di Roma 11:00. Domani è giovedì, sabato è il 14.
const NOW = new Date('2026-03-11T10:00:00Z');
const TODAY = '2026-03-11';
const TOMORROW = '2026-03-12';

const { handleAction, processPendingRequests } = await import('../server/router.js');
const { closePool, getPool } = await import('../server/db.js');
const { setMailTransport } = await import('../server/mailer.js');
const { hashPassword } = await import('../server/auth.js');
const { dayToIso, toDay, windowStartDay } = await import('../server/dates.js');
const { default: cronHandler } = await import('../api/cron/assign.js');
const { default: rpcHandler } = await import('../api/rpc.js');
const {
  getEasterSunday,
  getTicinoHolidays,
  isTicinoHoliday,
  isWorkingDay,
  getQuarterBounds,
  countWorkingDays,
} = await import('../server/holidays.js');
const {
  getUserConsecutiveAssignedDays,
} = await import('../server/tokens.js');

let sent = [];
let failDelivery = false;

const db = () => getPool();
const mailsTo = (mail) => sent.filter((m) => m.to === mail);

async function statusOf(requestId) {
  const { rows } = await db().query('SELECT * FROM parking_requests WHERE request_id = $1', [requestId]);
  return rows[0];
}

async function addUser(id, { verified = true, password = 'pw', acceptedRules } = {}) {
  let rulesVersion = acceptedRules;
  if (rulesVersion === undefined) {
    const { rows } = await db().query('SELECT version FROM company_regulations WHERE is_active = true LIMIT 1');
    rulesVersion = rows[0]?.version || '1.0';
  }
  await db().query(
    `INSERT INTO users (id, first_name, last_name, mail, password, salt, is_verified, accepted_rules_version, rules_accepted_at)
     VALUES ($1, $1, 'Test', $2, $3, 'salt', $4, $5, now())`,
    [id, `${id}@test.local`, hashPassword(password, 'salt'), verified, rulesVersion]
  );
}

const addSpace = (id, isFixed = true) => db().query(
  'INSERT INTO parking_spaces (id, number, is_fixed) VALUES ($1, $2, $3)',
  [id, id.toUpperCase(), isFixed]
);

const addRequest = (id, userId, day, status = 'pending', spaceId = null) => db().query(
  `INSERT INTO parking_requests
     (request_id, user_id, requested_date, status, assigned_parking_space_id, assigned_parking_space_number)
   VALUES ($1, $2, $3, $4, $5, $6)`,
  [id, userId, day, status, spaceId, spaceId?.toUpperCase() ?? null]
);

const addHistory = (userId, day, spaceId = 'p1') => db().query(
  'INSERT INTO assignment_history (user_id, assignment_date, parking_space_id) VALUES ($1, $2, $3)',
  [userId, day, spaceId]
);

const historyCount = async (userId) => {
  const { rows } = await db().query('SELECT count(*)::int AS n FROM assignment_history WHERE user_id = $1', [userId]);
  return rows[0].n;
};

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = JSON.parse(body); },
  };
}

before(async () => {
  const url = new URL(TEST_URL);
  const dbName = url.pathname.slice(1);
  assert.match(dbName, /test/, 'Il database di test deve avere "test" nel nome');

  url.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  await db().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await runMigrations(db());

  setMailTransport({
    sendMail: async (message) => {
      if (failDelivery) throw new Error('SMTP non raggiungibile');
      sent.push(message);
    },
  });
});

after(closePool);

beforeEach(async () => {
  mock.timers.enable({ apis: ['Date'], now: NOW });
  sent = [];
  failDelivery = false;
  await db().query(`TRUNCATE users, parking_spaces, parking_requests, assignment_history,
    temporary_availability, temporary_unavailability, communications CASCADE`);
});

afterEach(() => mock.timers.reset());

describe('date', () => {
  it('serializza i giorni come mezzanotte di Roma, con ora solare e legale', () => {
    assert.equal(dayToIso('2026-03-11'), '2026-03-10T23:00:00.000Z');
    assert.equal(dayToIso('2026-07-01'), '2026-06-30T22:00:00.000Z');
    // Il giorno stesso del cambio d'ora: a mezzanotte vale ancora il fuso precedente
    assert.equal(dayToIso('2026-03-29'), '2026-03-28T23:00:00.000Z');
    assert.equal(dayToIso('2026-10-25'), '2026-10-24T22:00:00.000Z');
  });

  it('riconosce il giorno di Roma da un istante e rifiuta date inesistenti', () => {
    assert.equal(toDay('2026-03-10T23:00:00.000Z'), '2026-03-11');
    assert.throws(() => toDay('2026-02-31'), /Data non valida/);
    assert.throws(() => toDay('boh'), /Data non valida/);
  });

  it('la finestra di priorità copre 30 giorni lavorativi', () => {
    // Da mer 11/03 indietro di 30 giorni lavorativi = 6 settimane esatte
    assert.equal(windowStartDay(), '2026-01-28');
  });
});

describe('autenticazione', () => {
  it('registrazione, verifica email e login senza esporre segreti', async () => {
    const created = await handleAction('signup', { firstName: 'Ada', lastName: 'L', mail: 'ada@test.local', password: 'segreta' });

    const blocked = await handleAction('login', { mail: 'ada@test.local', password: 'segreta' });
    assert.equal(blocked.verificationNeeded, true);

    const token = mailsTo('ada@test.local')[0].text.match(/verify-email\?token=([\w-]+)/)[1];
    assert.match(mailsTo('ada@test.local')[0].text, /http:\/\/test\.local\/verify-email/);
    await handleAction('verifyEmailToken', { token });

    const user = await handleAction('login', { mail: 'ada@test.local', password: 'segreta' });
    assert.equal(user.id, created.id);
    assert.equal(user.isVerified, true);
    assert.equal(user.isAdmin, false);
    for (const secret of ['password', 'salt', 'verificationToken', 'resetToken', 'resetTokenExpiry']) {
      assert.ok(!(secret in user), `${secret} non deve uscire dal server`);
    }

    await assert.rejects(handleAction('login', { mail: 'ada@test.local', password: 'sbagliata' }), /non corretta/);
    await assert.rejects(handleAction('signup', { firstName: 'Ada', mail: 'ada@test.local', password: 'x' }), /esiste già/);
  });

  it('l\'hash resta SHA-256 esadecimale di password + salt, come per gli account esistenti', () => {
    // Vettore calcolato a parte: printf 'pwsalt' | sha256sum
    assert.equal(hashPassword('pw', 'salt'), 'fe5002e3a1ba48a982f7c31fec72065d1b451547ce2290a766ba477bfec32182');
  });

  it('reset password: il token scade dopo un\'ora', async () => {
    await addUser('u1');
    await handleAction('requestPasswordReset', { mail: 'u1@test.local' });
    const token = sent[0].text.match(/token=([\w-]+)/)[1];

    mock.timers.setTime(NOW.getTime() + 3600001);
    await assert.rejects(handleAction('resetPassword', { token, newPassword: 'nuova' }), /Token scaduto/);

    mock.timers.setTime(NOW.getTime());
    await handleAction('resetPassword', { token, newPassword: 'nuova' });
    assert.equal((await handleAction('login', { mail: 'u1@test.local', password: 'nuova' })).id, 'u1');
    await assert.rejects(handleAction('resetPassword', { token, newPassword: 'altra' }), /non valido/);
  });

  it('se l\'email di verifica non parte, l\'errore arriva all\'utente ma l\'account resta', async () => {
    failDelivery = true;
    await assert.rejects(handleAction('signup', { firstName: 'B', mail: 'b@test.local', password: 'x' }), /non è stato possibile inviare/);
    failDelivery = false;
    await handleAction('resendVerificationEmail', { mail: 'b@test.local' });
    assert.equal(sent.length, 1);
  });
});

describe('priorità e assegnazione', () => {
  it('assegna a chi ha il success rate più basso', async () => {
    await addUser('fortunato');
    await addUser('sfortunato');
    await addSpace('p1');
    for (const day of ['2026-03-02', '2026-03-03', '2026-03-04']) {
      await addRequest(`f_${day}`, 'fortunato', day, 'assigned', 'p1');
      await addHistory('fortunato', day);
      await addRequest(`s_${day}`, 'sfortunato', day, 'not_assigned');
    }
    await addRequest('f', 'fortunato', TOMORROW);
    await addRequest('s', 'sfortunato', TOMORROW);

    const result = await processPendingRequests();

    assert.deepEqual(result, { assigned: 1, failed: 1 });
    assert.equal((await statusOf('s')).status, 'assigned');
    assert.equal((await statusOf('s')).assigned_parking_space_number, 'P1');
    assert.equal((await statusOf('f')).status, 'not_assigned');
    assert.equal(await historyCount('sfortunato'), 1);
    assert.match(mailsTo('sfortunato@test.local')[0].subject, /Conferma Assegnazione/);
    assert.match(mailsTo('sfortunato@test.local')[0].text, /12\/03\/2026/);
    assert.match(mailsTo('fortunato@test.local').at(-1).subject, /Esito Richiesta/);
  });

  it('il conteggio ignora ciò che è fuori trimestre e le richieste annullate', async () => {
    await addUser('u1');
    await addRequest('dentro1', 'u1', '2026-03-02', 'assigned', 'p1');
    await addHistory('u1', '2026-03-02');
    await addRequest('dentro2', 'u1', '2026-03-03', 'not_assigned');
    await addRequest('annullata', 'u1', '2026-03-04', 'cancelled_by_user');
    await addRequest('fuori', 'u1', '2025-12-15', 'assigned', 'p1');
    await addHistory('u1', '2025-12-15');
    await addRequest('bordo_fuori', 'u1', '2025-12-16', 'not_assigned');
    await addRequest('futura', 'u1', TOMORROW);

    const [user] = await handleAction('getUsersWithPriority');

    assert.equal(user.recentAssignments, 1);
    assert.equal(user.recentRequests, 3);
    assert.equal(user.usedTokens, 1);
    assert.equal(user.totalRequests, 3);
    assert.equal(user.remainingTokens, user.totalTokens - 1);
  });

  it('a parità di priorità l\'ordine è casuale', async () => {
    await addUser('a');
    await addUser('b');
    await addSpace('p1');
    const winners = new Set();
    for (let i = 0; i < 30; i++) {
      await db().query('DELETE FROM parking_requests');
      await addRequest('ra', 'a', TOMORROW);
      await addRequest('rb', 'b', TOMORROW);
      await processPendingRequests();
      winners.add((await statusOf('ra')).status === 'assigned' ? 'a' : 'b');
    }
    assert.equal(winners.size, 2);
  });

  it('calcola i posti: fissi meno disabilitati, più temporanei, meno occupati', async () => {
    await addUser('occupante');
    await addSpace('fisso1');
    await addSpace('fisso2');
    await addSpace('fisso3');
    await addSpace('temp1', false);
    await addSpace('temp2', false);
    await handleAction('addTemporaryUnavailability', { spaceId: 'fisso2', date: TOMORROW });
    await handleAction('addTemporaryAvailability', { spaceId: 'temp1', date: TOMORROW });
    await addRequest('r', 'occupante', TOMORROW, 'assigned', 'fisso3');

    const status = await handleAction('getParkingStatusForDate', { date: TOMORROW });
    assert.deepEqual(status, { total: 3, assigned: 1, available: 2 });
  });

  it('nessun posto: tutti non assegnati e avvisati', async () => {
    await addUser('u1');
    await addRequest('r', 'u1', TOMORROW);
    assert.deepEqual(await processPendingRequests(), { assigned: 0, failed: 1 });
    assert.equal((await statusOf('r')).status, 'not_assigned');
    assert.equal(sent.length, 1);
  });

  it('rieseguire l\'assegnazione non cambia nulla', async () => {
    await addUser('u1');
    await addSpace('p1');
    await addRequest('r', 'u1', TOMORROW);
    await processPendingRequests();
    assert.deepEqual(await processPendingRequests(), { assigned: 0, failed: 0 });
    assert.equal(await historyCount('u1'), 1);
  });

  it('due assegnazioni concorrenti non occupano due volte lo stesso posto', async () => {
    await addUser('a');
    await addUser('b');
    await addSpace('p1');
    await addRequest('ra', 'a', TOMORROW);
    await addRequest('rb', 'b', TOMORROW);
    const assignOne = (requestId) => handleAction('adminUpdateUserRequestStatus', { requestId, newStatus: 'assigned' });

    const results = await Promise.allSettled([assignOne('ra'), assignOne('rb')]);

    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const { rows } = await db().query(`SELECT count(*)::int AS n FROM parking_requests WHERE status = 'assigned'`);
    assert.equal(rows[0].n, 1);
  });
});

describe('richieste', () => {
  it('salta weekend, date passate e duplicati, e restituisce date in formato ISO', async () => {
    await addUser('u1');
    const result = await handleAction('createBatchRequests', {
      userId: 'u1',
      dates: [TOMORROW, TOMORROW, '2026-03-14', '2026-03-10'],
    });
    assert.equal(result.requests.length, 1);
    assert.equal(result.requests[0].requestedDate, '2026-03-11T23:00:00.000Z');
    assert.equal(result.requests[0].status, 'pending');
    assert.equal(result.requests[0].assignedParkingSpaceId, '');

    await assert.rejects(handleAction('createBatchRequests', { userId: 'u1', dates: [TOMORROW] }), /Nessuna richiesta creata/);
  });

  it('per il giorno stesso, anche dopo le 19, la richiesta resta in coda', async () => {
    mock.timers.setTime(new Date('2026-03-11T19:30:00Z').getTime());
    await addUser('u1');
    await addSpace('p1');
    const { requests } = await handleAction('createBatchRequests', { userId: 'u1', dates: [TODAY] });
    assert.equal((await statusOf(requests[0].requestId)).status, 'pending');
  });

  it('notifica l\'utente quando è un admin ad agire', async () => {
    await addUser('admin');
    await addUser('u1');
    const { requests } = await handleAction('createBatchRequests', { userId: 'u1', dates: [TOMORROW], actorId: 'admin' });
    assert.match(mailsTo('u1@test.local')[0].subject, /Nuova Richiesta/);

    await handleAction('updateRequestDate', { requestId: requests[0].requestId, newDate: '2026-03-13', actorId: 'admin' });
    assert.match(mailsTo('u1@test.local')[1].text, /12\/03\/2026[\s\S]*13\/03\/2026/);

    await handleAction('cancelMultipleRequests', { requestIds: [requests[0].requestId], actorId: 'admin' });
    assert.match(mailsTo('u1@test.local')[2].subject, /Cancellata/);
  });

  it('solo le richieste in attesa si spostano, e non su date già occupate', async () => {
    await addUser('u1');
    await addRequest('a', 'u1', TOMORROW);
    await addRequest('b', 'u1', '2026-03-13', 'assigned', 'p1');
    await assert.rejects(handleAction('updateRequestDate', { requestId: 'b', newDate: '2026-03-16' }), /in attesa/);
    await assert.rejects(handleAction('updateRequestDate', { requestId: 'a', newDate: '2026-03-13' }), /già un'altra richiesta/);
    await assert.rejects(handleAction('updateRequestDate', { requestId: 'a', newDate: '2026-03-10' }), /data passata/);
  });

  it('annullando: pending eliminata, not_assigned segnata, assigned riassegnata', async () => {
    await addUser('u1');
    await addUser('u2');
    await addSpace('p1');
    await addRequest('pend', 'u1', '2026-03-13');
    await addRequest('nonass', 'u1', '2026-03-16', 'not_assigned');
    await addRequest('ass', 'u1', TOMORROW, 'assigned', 'p1');
    await addHistory('u1', TOMORROW);
    await addRequest('attesa', 'u2', TOMORROW, 'not_assigned');

    await handleAction('cancelMultipleRequests', { requestIds: ['pend', 'nonass', 'ass'] });

    assert.equal(await statusOf('pend'), undefined);
    assert.equal((await statusOf('nonass')).status, 'cancelled_by_user');
    assert.equal((await statusOf('ass')).status, 'cancelled_by_user');
    assert.equal((await statusOf('ass')).assigned_parking_space_id, null);
    assert.equal((await statusOf('attesa')).status, 'assigned');
    assert.equal(await historyCount('u1'), 0);
    assert.equal(await historyCount('u2'), 1);
  });

  it('non riassegna un posto disabilitato e non ridà il posto a chi lo ha annullato', async () => {
    await addUser('u1');
    await addUser('u2');
    await addSpace('p1');
    await addRequest('ass', 'u1', TOMORROW, 'assigned', 'p1');
    await addRequest('attesa', 'u2', TOMORROW);
    await db().query(`INSERT INTO temporary_unavailability VALUES ('x', 'p1', $1)`, [TOMORROW]);

    await handleAction('cancelAssignmentAndReassign', { requestId: 'ass' });
    assert.equal((await statusOf('attesa')).status, 'pending');
  });

  it('la cessione vale solo oggi e passa il posto al ricevente', async () => {
    await addUser('donatore');
    await addUser('ricevente');
    await addUser('terzo');
    await addSpace('p1');
    await addRequest('don', 'donatore', TODAY, 'assigned', 'p1');
    await addHistory('donatore', TODAY);
    await addRequest('ric', 'ricevente', TODAY, 'not_assigned');
    await addRequest('ter', 'terzo', TODAY, 'not_assigned');
    await addRequest('dom', 'ricevente', TOMORROW, 'not_assigned');

    await assert.rejects(handleAction('fulfillParkingRequest', { requestId: 'dom', donorUserId: 'donatore' }), /giorno stesso/);

    const { message } = await handleAction('fulfillParkingRequest', { requestId: 'ric', donorUserId: 'donatore' });

    assert.match(message, /ceduto con successo a ricevente Test/);
    assert.equal((await statusOf('don')).status, 'cancelled_by_user');
    assert.equal((await statusOf('ric')).assigned_parking_space_id, 'p1');
    assert.equal(await historyCount('donatore'), 0);
    // Tre richieste meno il donatore = 2, ma un solo posto: resta overbooking, lo storico vale
    assert.equal(await historyCount('ricevente'), 1);
    assert.match(mailsTo('donatore@test.local')[0].subject, /Conferma Cessione/);
  });
});

describe('disponibilità temporanee', () => {
  it('disponibilità per oggi: assegnazione immediata', async () => {
    await addUser('u1');
    await addSpace('t1', false);
    await addRequest('r', 'u1', TODAY, 'not_assigned');
    await handleAction('addTemporaryAvailability', { spaceId: 't1', date: TODAY });
    assert.equal((await statusOf('r')).assigned_parking_space_id, 't1');
  });

  it('disponibilità per domani: immediata solo dopo le 19', async () => {
    await addUser('u1');
    await addSpace('t1', false);
    await addSpace('t2', false);
    await addRequest('r', 'u1', TOMORROW, 'not_assigned');

    mock.timers.setTime(new Date('2026-03-11T17:59:00Z').getTime()); // 18:59 a Roma
    await handleAction('addTemporaryAvailability', { spaceId: 't1', date: TOMORROW });
    assert.equal((await statusOf('r')).status, 'not_assigned');

    mock.timers.setTime(new Date('2026-03-11T18:00:00Z').getTime()); // 19:00 a Roma
    await handleAction('addTemporaryAvailability', { spaceId: 't2', date: TOMORROW });
    assert.equal((await statusOf('r')).assigned_parking_space_id, 't2');
  });

  it('rimuovere una disponibilità annulla l\'assegnazione collegata', async () => {
    await addUser('u1');
    await addUser('u2');
    await addSpace('t1', false);
    const { availability } = await handleAction('addTemporaryAvailability', { spaceId: 't1', date: TOMORROW });
    await addRequest('r', 'u1', TOMORROW, 'assigned', 't1');
    await addHistory('u1', TOMORROW, 't1');

    const { message } = await handleAction('removeTemporaryAvailability', { availabilityId: availability.availabilityId });
    assert.match(message, /collegata è stata annullata/);
    assert.equal((await statusOf('r')).status, 'not_assigned');
    assert.equal(await historyCount('u1'), 0);
  });

  it('disabilitare un posto fisso sposta l\'utente, o annulla se non c\'è alternativa', async () => {
    await addUser('u1');
    await addUser('u2');
    await addSpace('p1');
    await addSpace('p2');
    await addRequest('r1', 'u1', TOMORROW, 'assigned', 'p1');
    await addHistory('u1', TOMORROW, 'p1');
    await addRequest('r2', 'u2', TOMORROW, 'assigned', 'p2');
    await addHistory('u2', TOMORROW, 'p2');

    // p2 è occupato da u2 e p1 viene disabilitato: nessuna alternativa per u1
    const first = await handleAction('addTemporaryUnavailability', { spaceId: 'p1', date: TOMORROW });
    assert.match(first.message, /è stata annullata/);
    assert.equal((await statusOf('r1')).status, 'not_assigned');

    await addSpace('p3');
    const second = await handleAction('addTemporaryUnavailability', { spaceId: 'p2', date: TOMORROW });
    assert.match(second.message, /trasferita al posto P3/);
    assert.equal((await statusOf('r2')).assigned_parking_space_id, 'p3');
  });

  it('le letture restituiscono solo le date da oggi in poi, ordinate', async () => {
    await addSpace('t1', false);
    await db().query(`INSERT INTO temporary_availability VALUES ('b', 't1', '2026-03-20'), ('a', 't1', $1), ('z', 't1', '2026-03-01')`, [TOMORROW]);
    const rows = await handleAction('getTemporaryAvailabilities', { spaceId: 't1' });
    assert.deepEqual(rows.map((r) => r.availabilityId), ['a', 'b']);
    assert.equal(rows[0].availableDate, '2026-03-11T23:00:00.000Z');
  });
});

describe('parcheggi', () => {
  it('eliminare un posto annulla il futuro e conserva lo storico', async () => {
    await addUser('u1');
    await addSpace('p1');
    await addRequest('passata', 'u1', '2026-03-02', 'assigned', 'p1');
    await addHistory('u1', '2026-03-02');
    await addRequest('futura', 'u1', TOMORROW, 'assigned', 'p1');

    await handleAction('deleteParkingSpace', { spaceId: 'p1' });

    assert.equal((await statusOf('passata')).status, 'assigned');
    assert.equal((await statusOf('futura')).status, 'not_assigned');
    assert.equal(await historyCount('u1'), 1);
    assert.deepEqual(await handleAction('getParkingSpaces'), []);
  });

  it('un errore annulla l\'intera operazione e non parte nessuna email', async () => {
    await addUser('u1');
    await addRequest('r', 'u1', TOMORROW);
    await assert.rejects(
      handleAction('adminUpdateUserRequestStatus', { requestId: 'r', newStatus: 'assigned' }),
      /Nessun posto disponibile/
    );
    assert.equal((await statusOf('r')).status, 'pending');
    assert.equal(sent.length, 0);
  });

  it('cambiare tipo rimuove disponibilità o disabilitazioni future', async () => {
    await addSpace('p1', false);
    await handleAction('addTemporaryAvailability', { spaceId: 'p1', date: TOMORROW });
    await handleAction('updateParkingSpaceFixedStatus', { spaceId: 'p1', isFixed: true });
    assert.deepEqual(await handleAction('getTemporaryAvailabilities', { spaceId: 'p1' }), []);
  });
});

describe('azioni admin', () => {
  it('forzatura: assegnata senza posto, conta nello storico', async () => {
    await addUser('u1');
    await addRequest('r', 'u1', TOMORROW);
    await handleAction('adminUpdateUserRequestStatus', { requestId: 'r', newStatus: 'assigned', preventAutoLogic: true });
    const request = await statusOf('r');
    assert.equal(request.assigned_parking_space_id, 'forced');
    assert.equal(request.assigned_parking_space_number, 'Forzato');
    assert.equal(await historyCount('u1'), 1);
    assert.match(sent[0].text, /Forzato \(Extra\)/);
  });

  it('togliere un posto lo riassegna, salvo logica prevenuta', async () => {
    await addUser('u1');
    await addUser('u2');
    await addSpace('p1');
    await addRequest('a', 'u1', TOMORROW, 'assigned', 'p1');
    await addHistory('u1', TOMORROW);
    await addRequest('b', 'u2', TOMORROW, 'not_assigned');

    await handleAction('adminUpdateUserRequestStatus', { requestId: 'a', newStatus: 'not_assigned', preventAutoLogic: true });
    assert.equal((await statusOf('b')).status, 'not_assigned');

    await handleAction('adminUpdateUserRequestStatus', { requestId: 'a', newStatus: 'assigned' });
    await handleAction('adminUpdateUserRequestStatus', { requestId: 'a', newStatus: 'not_assigned' });
    assert.equal((await statusOf('b')).status, 'assigned');
  });

  it('reset: tutto in attesa, storico svuotato, avvisati solo gli assegnati', async () => {
    await addUser('u1');
    await addUser('u2');
    await addRequest('a', 'u1', TOMORROW, 'assigned', 'p1');
    await addHistory('u1', TOMORROW);
    await addRequest('b', 'u2', TOMORROW, 'not_assigned');

    const { message } = await handleAction('adminResetAssignmentsForDate', { date: TOMORROW });

    assert.match(message, /2 richieste resettate/);
    assert.equal((await statusOf('a')).status, 'pending');
    assert.equal((await statusOf('a')).assigned_parking_space_id, null);
    assert.equal((await statusOf('b')).status, 'pending');
    assert.equal(await historyCount('u1'), 0);
    assert.deepEqual(sent.map((m) => m.to), ['u1@test.local']);
  });

  it('cancella tutte le richieste del giorno e avvisa ogni utente una volta', async () => {
    await addUser('u1');
    await addRequest('a', 'u1', TOMORROW, 'assigned', 'p1');
    await addHistory('u1', TOMORROW);
    await addRequest('altra', 'u1', '2026-03-13');
    const { message } = await handleAction('adminCancelAllRequestsForDate', { date: TOMORROW });
    assert.match(message, /Eliminate 1 richieste per il 12\/03\/2026/);
    assert.equal(await statusOf('a'), undefined);
    assert.ok(await statusOf('altra'));
    assert.equal(sent.length, 1);
  });

  it('assegnazione manuale: riusa la richiesta esistente o ne crea una', async () => {
    await addUser('u1');
    await addSpace('p1');
    await addRequest('annullata', 'u1', TOMORROW, 'cancelled_by_user');
    await addRequest('attiva', 'u1', TOMORROW);

    const reused = await handleAction('adminAssignParckingForDate', { date: TOMORROW, userId: 'u1', spaceId: 'p1' });
    assert.equal(reused.request.requestId, 'attiva');
    assert.equal(reused.request.assignedParkingSpaceNumber, 'P1');

    const created = await handleAction('adminAssignParckingForDate', { date: '2026-03-13', userId: 'u1', spaceId: 'p1' });
    assert.match(created.request.requestId, /^req_/);
    assert.equal(await historyCount('u1'), 2);
  });
});

describe('comunicazioni', () => {
  it('invia ai soli verificati, salva il banner e lo mostra nel periodo', async () => {
    await addUser('verificato');
    await addUser('nuovo', { verified: false });

    const { message, banner } = await handleAction('sendAdminCommunication', {
      message: 'Lavori', isPersistent: true, startDate: TODAY, endDate: TOMORROW,
    });

    assert.match(message, /inviata a 1 utenti/);
    assert.deepEqual(sent.map((m) => m.to), ['verificato@test.local']);
    assert.deepEqual(await handleAction('getActiveCommunication'), [{ id: banner.id, message: 'Lavori' }]);

    mock.timers.setTime(new Date('2026-03-13T10:00:00Z').getTime());
    assert.deepEqual(await handleAction('getActiveCommunication'), []);

    await handleAction('deleteCommunication', { id: banner.id });
    await assert.rejects(handleAction('deleteCommunication', { id: banner.id }), /non trovata/);
  });

  it('senza persistenza invia soltanto', async () => {
    await addUser('u1');
    const { banner } = await handleAction('sendAdminCommunication', { message: 'Ciao' });
    assert.equal(banner, null);
    assert.equal(sent.length, 1);
  });
});

describe('dati iniziali e API HTTP', () => {
  it('getMonthData filtra sul mese richiesto e omette le richieste annullate', async () => {
    await addUser('u1');
    await addSpace('t1', false);
    await addRequest('marzo', 'u1', '2026-03-31');
    await addRequest('annullata', 'u1', '2026-03-30', 'cancelled_by_user');
    await addRequest('aprile', 'u1', '2026-04-01');
    await handleAction('addTemporaryAvailability', { spaceId: 't1', date: '2026-03-20' });
    await handleAction('addTemporaryAvailability', { spaceId: 't1', date: '2026-04-20' });

    const data = await handleAction('getMonthData', { targetDate: '2026-03-15' });

    assert.deepEqual(data.requests.map((r) => r.requestId), ['marzo']);
    assert.equal(data.temporaryAvailabilities.length, 1);
    assert.deepEqual(data.temporaryUnavailabilities, []);
    assert.ok(!('users' in data));
  });

  it('getReferenceData restituisce utenti, posti e comunicazioni senza segreti', async () => {
    await addUser('u1');
    await addSpace('p1');

    const data = await handleAction('getReferenceData');

    assert.equal(data.parkingSpaces[0].isFixed, true);
    assert.ok(!('password' in data.users[0]));
    assert.ok(!('salt' in data.users[0]));
    assert.deepEqual(data.banners, []);
  });

  it('getRequests filtra per utente e, se richiesto, dalla data indicata', async () => {
    await addUser('u1');
    await addUser('u2');
    await addRequest('vecchia', 'u1', '2026-01-05', 'not_assigned');
    await addRequest('recente', 'u1', '2026-03-02', 'not_assigned');
    await addRequest('altro', 'u2', '2026-03-02', 'not_assigned');

    const ids = async (payload) => (await handleAction('getRequests', payload)).map((r) => r.requestId);

    assert.deepEqual(await ids({ userId: 'u1' }), ['vecchia', 'recente']);
    assert.deepEqual(await ids({ userId: 'u1', fromDate: '2026-02-01' }), ['recente']);
    assert.equal((await ids({})).length, 3);
  });

  it('getRequestsPage pagina dalla più recente, con i totali e limiti sui parametri', async () => {
    await addUser('u1');
    await addUser('u2');
    for (let day = 2; day <= 6; day++) await addRequest(`r${day}`, 'u1', `2026-03-0${day}`, 'not_assigned');
    await addRequest('annullata', 'u1', '2026-03-09', 'cancelled_by_user');
    await addRequest('altro', 'u2', '2026-03-09', 'not_assigned');

    const first = await handleAction('getRequestsPage', { userId: 'u1', page: 1, pageSize: 4 });
    assert.deepEqual(first.requests.map((r) => r.requestId), ['annullata', 'r6', 'r5', 'r4']);
    assert.equal(first.total, 6);

    const second = await handleAction('getRequestsPage', { userId: 'u1', page: 2, pageSize: 4 });
    assert.deepEqual(second.requests.map((r) => r.requestId), ['r3', 'r2']);

    const beyond = await handleAction('getRequestsPage', { userId: 'u1', page: 9, pageSize: 4 });
    assert.deepEqual(beyond.requests, []);
    assert.equal(beyond.total, 6);

    const odd = await handleAction('getRequestsPage', { userId: 'u1', page: -3, pageSize: 100000 });
    assert.equal(odd.page, 1);
    assert.equal(odd.pageSize, 100);

    await assert.rejects(handleAction('getRequestsPage', {}), /ID utente/);
  });

  it('rpc: envelope success, errori di dominio leggibili, errori interni nascosti', async () => {
    const call = async (body, method = 'POST') => {
      const res = mockRes();
      await rpcHandler({ method, body }, res);
      return res;
    };

    const ok = await call({ action: 'getParkingSpaces' });
    assert.equal(ok.statusCode, 200);
    assert.deepEqual(ok.body, { status: 'success', data: [] });

    const domain = await call({ action: 'addParkingSpace', payload: { number: ' ' } });
    assert.equal(domain.statusCode, 400);
    assert.match(domain.body.message, /obbligatorio/);

    assert.match((await call({ action: 'constructor' })).body.message, /Azione non valida/);
    assert.match((await call({ action: 'inesistente' })).body.message, /Azione non valida/);
    assert.equal((await call({}, 'GET')).statusCode, 405);

    const console_error = mock.method(console, 'error', () => {});
    const internal = await call({ action: 'createBatchRequests', payload: { userId: 'nessuno', dates: [TOMORROW] } });
    console_error.mock.restore();
    assert.equal(internal.statusCode, 500);
    assert.equal(internal.body.message, 'Errore interno del server.');
  });

  it('cron: richiede il secret e gira solo alle 19 di Roma', async () => {
    process.env.CRON_SECRET = 'segreto';
    await addUser('u1');
    await addSpace('p1');
    await addRequest('r', 'u1', TOMORROW);

    const call = async (authorization) => {
      const res = mockRes();
      await cronHandler({ headers: { authorization } }, res);
      return res;
    };

    assert.equal((await call('Bearer sbagliato')).statusCode, 401);

    mock.timers.setTime(new Date('2026-03-11T17:00:00Z').getTime()); // 18:00 a Roma (ora solare)
    assert.equal((await call('Bearer segreto')).body.status, 'skipped');
    assert.equal((await statusOf('r')).status, 'pending');

    mock.timers.setTime(new Date('2026-03-11T18:00:00Z').getTime()); // 19:00 a Roma
    const run = await call('Bearer segreto');
    assert.deepEqual(run.body.data, { assigned: 1, failed: 0 });
    assert.equal((await statusOf('r')).status, 'assigned');

    // Con l'ora legale le 19 di Roma sono le 17 UTC
    mock.timers.setTime(new Date('2026-07-01T17:00:00Z').getTime());
    assert.equal((await call('Bearer segreto')).body.status, 'success');
    mock.timers.setTime(new Date('2026-07-01T18:00:00Z').getTime());
    assert.equal((await call('Bearer segreto')).body.status, 'skipped');

    delete process.env.CRON_SECRET;
    assert.equal((await call('Bearer segreto')).statusCode, 401);
  });
});

describe('regolamento aziendale', () => {
  it('recupera il regolamento attivo iniziale v1.0', async () => {
    const reg = await handleAction('getActiveRegulation');
    assert.equal(reg.version, '1.0');
    assert.equal(reg.isActive, true);
    assert.match(reg.title, /Sede di Chiasso/);
  });

  it('un utente può accettare il regolamento', async () => {
    await addUser('u_accept');
    const result = await handleAction('acceptRules', { userId: 'u_accept', version: '1.0' });
    assert.equal(result.acceptedVersion, '1.0');
    assert.equal(result.user.acceptedRulesVersion, '1.0');
    assert.ok(result.user.rulesAcceptedAt);
  });

  it('rifiuta la creazione di richieste se il regolamento non è stato accettato', async () => {
    await addUser('u_no_rules', { acceptedRules: null });
    await assert.rejects(
      handleAction('createBatchRequests', { userId: 'u_no_rules', dates: [TOMORROW] }),
      /regolamento aziendale/
    );
  });

  it('solo gli amministratori possono modificare il regolamento', async () => {
    await addUser('u_normal');
    await assert.rejects(
      handleAction('updateRegulation', {
        actorId: 'u_normal',
        version: '2.0',
        title: 'Nuovo titolo',
        content: 'Nuovo testo',
      }),
      /Solo gli amministratori/
    );

    await db().query(`UPDATE users SET is_admin = TRUE WHERE id = 'u_normal'`);
    const updated = await handleAction('updateRegulation', {
      actorId: 'u_normal',
      version: '2.0',
      title: 'Nuovo titolo',
      content: 'Nuovo testo',
      isActive: true,
    });
    assert.equal(updated.version, '2.0');
    assert.equal(updated.title, 'Nuovo titolo');
    assert.equal(updated.isActive, true);

    const active = await handleAction('getActiveRegulation');
    assert.equal(active.version, '2.0');
  });

  it('un utente che non ha accettato il regolamento non riceve assegnazione automatica', async () => {
    const active = await handleAction('getActiveRegulation');
    // u_regola ha accettato il regolamento attivo
    await addUser('u_regola', { acceptedRules: active.version });
    // u_senza_regola non ha accettato
    await addUser('u_senza_regola', { acceptedRules: null });
    await addSpace('p1');

    // Entrambi hanno una richiesta pending per domani
    await addRequest('req_accettato', 'u_regola', TOMORROW);
    await addRequest('req_non_accettato', 'u_senza_regola', TOMORROW);

    // Eseguiamo il motore di assegnazione
    const result = await processPendingRequests(TOMORROW);
    assert.equal(result.assigned, 1);
    assert.equal(result.failed, 0);

    // Solo chi ha accettato ha ottenuto il posto
    assert.equal((await statusOf('req_accettato')).status, 'assigned');
    assert.equal((await statusOf('req_non_accettato')).status, 'rules_not_accepted');

    // Verifica che rules_not_accepted non entri nelle statistiche di priorità (non deve aumentare richieste)
    const usersWithPriority = await handleAction('getUsersWithPriority');
    const uSenzaRegola = usersWithPriority.find((u) => u.id === 'u_senza_regola');
    assert.equal(uSenzaRegola.recentRequests, 0);
    assert.equal(uSenzaRegola.successRate, 0);
    assert.match(mailsTo('u_senza_regola@test.local').at(-1).subject, /Regolamento Non Accettato/);
  });

  it('l\'admin non può assegnare manualmente un posto a chi non ha accettato il regolamento', async () => {
    await addUser('u_no_reg', { acceptedRules: null });
    await addSpace('p1');

    await assert.rejects(
      handleAction('adminAssignParckingForDate', { date: TOMORROW, userId: 'u_no_reg', spaceId: 'p1' }),
      /non ha ancora accettato il regolamento aziendale/
    );
  });

  it('non è possibile cedere un parcheggio a chi non ha accettato il regolamento', async () => {
    await addUser('donor', { acceptedRules: '1.0' });
    await addUser('recipient_no_rules', { acceptedRules: null });
    await addSpace('p1');

    await addRequest('req_donor', 'donor', TODAY, 'assigned', 'p1');
    await addRequest('req_recipient', 'recipient_no_rules', TODAY, 'pending');

    await assert.rejects(
      handleAction('fulfillParkingRequest', { requestId: 'req_recipient', donorUserId: 'donor' }),
      /non ha ancora accettato il regolamento aziendale/
    );
  });
});

describe('sistema a gettoni e festività ticinesi', () => {
  it('calcola correttamente la Pasqua e le 15 festività ticinesi', () => {
    // Nel 2026: Pasqua è il 5 aprile
    assert.equal(getEasterSunday(2026), '2026-04-05');
    const holidays2026 = getTicinoHolidays(2026);
    // 15 festività
    assert.equal(Object.keys(holidays2026).length, 15);
    // Festività fisse
    assert.equal(holidays2026['2026-01-01'], 'Capodanno');
    assert.equal(holidays2026['2026-01-06'], 'Epifania');
    assert.equal(holidays2026['2026-03-19'], 'San Giuseppe');
    assert.equal(holidays2026['2026-05-01'], 'Festa del Lavoro');
    assert.equal(holidays2026['2026-06-29'], 'Santi Pietro e Paolo');
    assert.equal(holidays2026['2026-08-01'], 'Festa Nazionale Svizzera');
    assert.equal(holidays2026['2026-08-15'], 'Assunzione');
    assert.equal(holidays2026['2026-11-01'], 'Ognissanti');
    assert.equal(holidays2026['2026-12-08'], 'Immacolata Concezione');
    assert.equal(holidays2026['2026-12-25'], 'Natale');
    assert.equal(holidays2026['2026-12-26'], 'Santo Stefano');
    // Festività mobili 2026
    assert.equal(holidays2026['2026-04-06'], 'Lunedì di Pasqua');
    assert.equal(holidays2026['2026-05-14'], 'Ascensione');
    assert.equal(holidays2026['2026-05-25'], 'Lunedì di Pentecoste');
    assert.equal(holidays2026['2026-06-04'], 'Corpus Domini');
  });

  it('riconosce i giorni lavorativi e non lavorativi (weekend e festività)', () => {
    // Sabato e domenica non lavorativi
    assert.equal(isWorkingDay('2026-03-14'), false);
    assert.equal(isWorkingDay('2026-03-15'), false);
    // San Giuseppe (giovedì 19 marzo 2026) -> festivo in Ticino
    assert.equal(isTicinoHoliday('2026-03-19'), true);
    assert.equal(isWorkingDay('2026-03-19'), false);
    // Giorno feriale normale (venerdì 20 marzo 2026)
    assert.equal(isWorkingDay('2026-03-20'), true);
  });

  it('calcola i limiti del trimestre e i giorni lavorativi', () => {
    const q1 = getQuarterBounds('2026-02-15');
    assert.equal(q1.quarter, 1);
    assert.equal(q1.startDay, '2026-01-01');
    assert.equal(q1.endDay, '2026-03-31');

    const q2 = getQuarterBounds('2026-05-10');
    assert.equal(q2.quarter, 2);
    assert.equal(q2.startDay, '2026-04-01');
    assert.equal(q2.endDay, '2026-06-30');

    // Gennaio 2026: 31 giorni, 9 di weekend (4 sab, 5 dom), 2 festivi infrasettimanali (1 e 6 gen) = 20 giorni
    const daysInJan = countWorkingDays('2026-01-01', '2026-01-31');
    assert.equal(daysInJan, 20);
  });

  it('gestisce la configurazione della data di partenza gettoni e i relativi permessi admin', async () => {
    await addUser('admin_tok', { password: 'pw' });
    await db().query("UPDATE users SET is_admin = true WHERE id = 'admin_tok'");
    await addUser('user_tok', { password: 'pw' });

    // Legge configurazione
    const config = await handleAction('getTokenConfig');
    assert.ok(config.startDate);

    // Utente non admin non può cambiare la data di partenza
    await assert.rejects(
      handleAction('setTokenStartDate', { startDate: '2026-02-01', actorId: 'user_tok' }),
      /Azione riservata agli amministratori/
    );

    // Admin può impostare una nuova data valida
    await handleAction('setTokenStartDate', { startDate: '2026-02-01', actorId: 'admin_tok' });
    const updated = await handleAction('getTokenConfig');
    assert.equal(updated.startDate, '2026-02-01');

    // Data invalida viene respinta
    await assert.rejects(
      handleAction('setTokenStartDate', { startDate: 'non-a-date', actorId: 'admin_tok' }),
      /Data non valida/
    );

    // Ripristina la data iniziale
    await handleAction('setTokenStartDate', { startDate: '2026-01-01', actorId: 'admin_tok' });
  });

  it('assegna la priorità a chi ha più gettoni rimanenti', async () => {
    await addUser('tok_ricco');
    await addUser('tok_povero');
    await addSpace('p_tok');

    // tok_povero ha già consumato 2 gettoni
    await addHistory('tok_povero', '2026-03-02', 'p_tok');
    await addRequest('tp_1', 'tok_povero', '2026-03-02', 'assigned', 'p_tok');
    await addHistory('tok_povero', '2026-03-03', 'p_tok');
    await addRequest('tp_2', 'tok_povero', '2026-03-03', 'assigned', 'p_tok');

    // Entrambi richiedono per TOMORROW
    await addRequest('req_ricco', 'tok_ricco', TOMORROW, 'pending');
    await addRequest('req_povero', 'tok_povero', TOMORROW, 'pending');

    await processPendingRequests();

    assert.equal((await statusOf('req_ricco')).status, 'assigned');
    assert.equal((await statusOf('req_povero')).status, 'not_assigned');
  });

  it('regola dei 3 parcheggi consecutivi: penalizza se posti < richieste, assegna se posti >= richieste', async () => {
    await addUser('u_streak');
    await addUser('u_fresh');
    await addSpace('space_1');

    // 3 giorni lavorativi consecutivi precedenti a TOMORROW (2026-03-12, giovedì): 09/03, 10/03, 11/03
    for (const d of ['2026-03-09', '2026-03-10', '2026-03-11']) {
      await addHistory('u_streak', d, 'space_1');
      await addRequest(`req_streak_${d}`, 'u_streak', d, 'assigned', 'space_1');
    }

    const consecutive = await getUserConsecutiveAssignedDays(db(), 'u_streak', TOMORROW);
    assert.equal(consecutive, 3);

    // Caso A: 1 posto disponibile, 2 richieste (posti < richieste) -> vince u_fresh
    await addRequest('r_streak', 'u_streak', TOMORROW, 'pending');
    await addRequest('r_fresh', 'u_fresh', TOMORROW, 'pending');

    await processPendingRequests();

    assert.equal((await statusOf('r_fresh')).status, 'assigned');
    assert.equal((await statusOf('r_streak')).status, 'not_assigned');

    // Caso B: 2 posti disponibili, 2 richieste (posti >= richieste) -> streak non blocca l'assegnazione
    await addSpace('space_2');
    await db().query(
      "UPDATE parking_requests SET status = 'pending', assigned_parking_space_id = NULL, assigned_parking_space_number = NULL WHERE request_id IN ('r_streak', 'r_fresh')"
    );

    await processPendingRequests();

    assert.equal((await statusOf('r_streak')).status, 'assigned');
    assert.equal((await statusOf('r_fresh')).status, 'assigned');
  });
});


