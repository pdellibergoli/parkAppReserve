import * as admin from './admin.js';
import { processRequestsForDate } from './assignment.js';
import * as auth from './auth.js';
import * as availability from './availability.js';
import * as communications from './communications.js';
import { addDays, monthBounds, today, toDay } from './dates.js';
import { getPool, withWriteTransaction } from './db.js';
import { AppError } from './errors.js';
import { flushOutbox } from './mailer.js';
import { availabilityToApi, historyToApi, requestToApi, unavailabilityToApi } from './mappers.js';
import * as parking from './parking.js';
import * as requests from './requests.js';
import * as users from './users.js';

/** Dati che non dipendono dal mese: si caricano una volta e cambiano di rado. */
async function getReferenceData(ctx) {
  const [usersList, parkingSpaces, banners] = await Promise.all([
    users.getAllUsers(ctx.db),
    parking.getParkingSpaces(ctx.db),
    communications.getActiveCommunication(ctx.db),
  ]);
  return { users: usersList, parkingSpaces, banners };
}

/** Dati del calendario per un mese. Le richieste annullate non vengono mai mostrate. */
async function getMonthData(ctx, { targetDate }) {
  const { start, end } = monthBounds(targetDate ? toDay(targetDate) : today());

  const [requestRows, availRows, unavailRows] = await Promise.all([
    ctx.db.query(
      `SELECT * FROM parking_requests
        WHERE requested_date BETWEEN $1 AND $2 AND status <> 'cancelled_by_user'`,
      [start, end]
    ),
    ctx.db.query('SELECT * FROM temporary_availability WHERE available_date BETWEEN $1 AND $2', [start, end]),
    ctx.db.query('SELECT * FROM temporary_unavailability WHERE unavailable_date BETWEEN $1 AND $2', [start, end]),
  ]);

  return {
    requests: requestRows.rows.map(requestToApi),
    temporaryAvailabilities: availRows.rows.map(availabilityToApi),
    temporaryUnavailabilities: unavailRows.rows.map(unavailabilityToApi),
  };
}

async function getAssignmentHistory(ctx) {
  const { rows } = await ctx.db.query('SELECT * FROM assignment_history ORDER BY id');
  return rows.map(historyToApi);
}

// Azioni eseguite fuori dalla transazione di scrittura
const POOL_ACTIONS = {
  getReferenceData,
  getMonthData,
  login: auth.loginUser,
  getUsers: (ctx) => users.getAllUsers(ctx.db),
  getParkingSpaces: (ctx) => parking.getParkingSpaces(ctx.db),
  getAssignmentHistory,
  getUsersWithPriority: users.getUsersWithPriority,
  getRequests: requests.getRequestsForUser,
  getRequestsPage: requests.getRequestsPage,
  getTemporaryAvailabilities: availability.getTemporaryAvailabilities,
  getTemporaryUnavailabilities: availability.getTemporaryUnavailabilities,
  getParkingStatusForDate: parking.getParkingStatusForDate,
  getActiveCommunication: (ctx) => communications.getActiveCommunication(ctx.db),
  // Invia molte email e scrive una sola riga: non deve bloccare le altre scritture durante l'invio
  sendAdminCommunication: communications.sendAdminCommunication,
};

const TRANSACTION_ACTIONS = {
  signup: auth.signupUser,
  resendVerificationEmail: auth.resendVerificationEmail,
  verifyEmailToken: auth.verifyEmailToken,
  requestPasswordReset: auth.requestPasswordReset,
  resetPassword: auth.resetPassword,

  updateUserProfile: users.updateUserProfile,

  addParkingSpace: parking.addParkingSpace,
  deleteParkingSpace: parking.deleteParkingSpace,
  updateParkingSpaceFixedStatus: parking.updateParkingSpaceFixedStatus,
  updateParkingSpaceName: parking.updateParkingSpaceName,

  createBatchRequests: requests.createBatchRequests,
  cancelMultipleRequests: requests.cancelMultipleRequests,
  updateRequestDate: requests.updateRequestDate,
  cancelAssignmentAndReassign: requests.cancelAssignmentAndReassign,
  fulfillParkingRequest: requests.fulfillParkingRequest,
  adminUpdateUserRequestStatus: requests.adminUpdateUserRequestStatus,

  addTemporaryAvailability: availability.addTemporaryAvailability,
  removeTemporaryAvailability: availability.removeTemporaryAvailability,
  addTemporaryUnavailability: availability.addTemporaryUnavailability,
  removeTemporaryUnavailability: availability.removeTemporaryUnavailability,

  adminCancelAllRequestsForDate: admin.adminCancelAllRequestsForDate,
  adminResetAssignmentsForDate: admin.adminResetAssignmentsForDate,
  adminManuallyAssignForDate: admin.adminManuallyAssignForDate,
  adminAssignParckingForDate: admin.adminAssignParckingForDate,

  deleteCommunication: communications.deleteCommunication,
};

const hasAction = (actions, action) => Object.prototype.hasOwnProperty.call(actions, action);

async function runInTransaction(handler) {
  const outbox = [];
  const result = await withWriteTransaction((db) => handler({ db, outbox }));
  await flushOutbox(outbox);
  return result;
}

export async function handleAction(action, payload = {}) {
  if (hasAction(POOL_ACTIONS, action)) {
    return POOL_ACTIONS[action]({ db: getPool(), outbox: [] }, payload);
  }
  if (hasAction(TRANSACTION_ACTIONS, action)) {
    return runInTransaction((ctx) => TRANSACTION_ACTIONS[action](ctx, payload));
  }
  throw new AppError(`Azione non valida: ${action}`);
}

/** Assegnazione serale: processa le richieste di domani. */
export function processPendingRequests(day = addDays(today(), 1)) {
  return runInTransaction((ctx) => processRequestsForDate(ctx, day));
}
