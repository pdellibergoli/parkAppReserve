// =================================================================
// CONFIGURAZIONE GLOBALE
// =================================================================
const CONFIG = {
  SHEETS: {
    USERS: "Users",
    BOOKINGS: "Bookings",
    PARKING_SPACES: "ParkingSpaces",
    REQUESTS: "ParkingRequests",
    ASSIGNMENT_HISTORY: "AssignmentHistory",
    TEMPORARY_AVAILABILITY: "TemporaryAvailability",
    COMMUNICATIONS: "Communications"
  },
  BASE_URL: "https://park-app-reserve.vercel.app/",
  EMAIL: {
    FROM_NAME: "Park app",
    REPLY_TO: "noreply@park-app.com"
  },
  TOKEN_EXPIRY: 3600000,
  ASSIGNMENT_HOUR: 19,
  LOOK_BACK_DAYS: 30,
  LOG_LEVEL: "DEBUG"
};

// =================================================================
// GESTIONE LOGGING
// =================================================================
let clientLogs = [];

function logToClient(message, level = "DEBUG") {
  if (level === "DEBUG" && CONFIG.LOG_LEVEL !== "DEBUG") return;
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm:ss.SSS");
  clientLogs.push(`[GAS ${timestamp}] ${message}`);
  Logger.log(message);
}

// =================================================================
// GESTIONE HTTP
// =================================================================

function doGet(e) {
  return ContentService.createTextOutput("Google Apps Script API for Parking App is running.");
}

function doOptions(e) {
  return ContentService.createTextOutput()
    .addHeader('Access-Control-Allow-Origin', '*')
    .addHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function doPost(e) {
  clientLogs = [];
  try {
    const data = parseRequestData(e);
    logToClient(`Azione ricevuta: ${data.action}`);
    const result = routeAction(data.action, data.payload);
    logToClient(`Azione completata con successo.`);
    return createJsonResponse({ status: 'success', data: result });
  } catch (error) {
    logToClient(`ERRORE: ${error.message}`);
    Logger.log(`ERRORE: ${error.message} \n Stack: ${error.stack}`);
    return createJsonResponse({ status: 'error', message: error.message });
  }
}

// =================================================================
// ROUTING E UTILITIES HTTP
// =================================================================

function parseRequestData(e) {
  if (!e?.postData?.contents) throw new Error("Richiesta non valida o dati mancanti.");
  const data = JSON.parse(e.postData.contents);
  if (!data.action) throw new Error("Azione non specificata.");
  return data;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify({ ...data, logs: clientLogs }))
    .setMimeType(ContentService.MimeType.JSON);
}

function routeAction(action, payload) {
  const routes = {
    // Autenticazione
    'login': () => loginUser(payload),
    'signup': () => signupUser(payload),
    'resendVerificationEmail': () => resendVerificationEmail(payload),
    'verifyEmailToken': () => verifyEmailToken(payload),
    'requestPasswordReset': () => requestPasswordReset(payload),
    'resetPassword': () => resetPassword(payload),

    // Dati di base
    'getUsers': () => getSheetAsJSON(CONFIG.SHEETS.USERS),
    'getParkingSpaces': () => getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES),
    'getAssignmentHistory': () => getSheetAsJSON(CONFIG.SHEETS.ASSIGNMENT_HISTORY),
    'getUsersWithPriority': () => getUsersWithPriority(),

    // Gestione utenti
    'updateUserProfile': () => updateUserProfile(payload),

    // Gestione parcheggi
    'addParkingSpace': () => addParkingSpace(payload),
    'deleteParkingSpace': () => deleteParkingSpace(payload),
    'updateParkingSpaceFixedStatus': () => updateParkingSpaceFixedStatus(payload),

    // Gestione richieste
    'getRequests': () => getRequestsForUser(payload),
    'createBatchRequests': () => createBatchRequests(payload),
    'cancelMultipleRequests': () => cancelMultipleRequests(payload),
    'updateRequestDate': () => updateRequestDate(payload),
    'cancelAssignmentAndReassign': () => cancelAssignmentAndReassign(payload),
    'fulfillParkingRequest': () => fulfillParkingRequest(payload),
    'adminUpdateRequestStatus': () => adminUpdateRequestStatus(payload),
    'adminUpdateUserRequestStatus': () => adminUpdateUserRequestStatus(payload),

    // Disponibilità temporanee
    'addTemporaryAvailability': () => addTemporaryAvailability(payload),
    'getTemporaryAvailabilities': () => getTemporaryAvailabilities(payload),
    'removeTemporaryAvailability': () => removeTemporaryAvailability(payload),
    'getParkingStatusForDate': () => getParkingStatusForDate(payload),

    // Azioni Admin
    'adminCancelAllRequestsForDate': () => adminCancelAllRequestsForDate(payload),
    'adminResetAssignmentsForDate': () => adminResetAssignmentsForDate(payload),
    'adminManuallyAssignForDate': () => adminManuallyAssignForDate(payload),
    'adminAssignParckingForDate': () => adminAssignParckingForDate(payload),
    'sendAdminCommunication': () => sendAdminCommunication(payload),
    'getActiveCommunication': () => getActiveCommunication(),
    'deleteCommunication': () => deleteCommunication(payload)
  };

  const handler = routes[action];
  if (!handler) throw new Error("Azione non valida: " + action);
  return handler();
}

// =================================================================
// UTILITY FUNCTIONS
// =================================================================

function hashPassword(password, salt) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

function getSheetAsJSON(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 1) return [];
  const headers = data.shift().map(h => h.toString().trim());
  return data.map(row => {
    const obj = {};
    headers.forEach((header, index) => { if (header) obj[header] = row[index]; });
    return obj;
  });
}

function findRowByColumn(sheetName, columnName, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIndex = headers.indexOf(columnName);
  if (colIndex === -1) {
    logToClient(`ERRORE CRITICO: Colonna '${columnName}' non trovata nello sheet '${sheetName}'`, "ERROR");
    throw new Error(`Colonna '${columnName}' non trovata`);
  }
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex] == value) return { row: i + 1, data: data[i], headers };
  }
  return null;
}

function updateCell(sheet, rowIndex, columnName, value, headers) {
  const colIndex = headers.indexOf(columnName);
  if (colIndex === -1) {
    logToClient(`ERRORE CRITICO: Colonna '${columnName}' non trovata nello sheet '${sheet.getName()}'`, "ERROR");
    throw new Error(`Colonna '${columnName}' non trovata`);
  }
  sheet.getRange(rowIndex, colIndex + 1).setValue(value);
}

function sendEmail(mail, subject, body) {
  MailApp.sendEmail({
    to: mail,
    subject: subject,
    body: body,
    name: CONFIG.EMAIL.FROM_NAME,
    replyTo: CONFIG.EMAIL.REPLY_TO
  });
}

function formatDate(date) {
  return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), "dd/MM/yyyy");
}

function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isWeekday(date) {
  const day = new Date(date).getDay();
  return day !== 0 && day !== 6;
}

/**
 * Calcola la data di inizio tornando indietro di N giorni lavorativi.
 * Salta Sabato (6) e Domenica (0).
 */
function getWindowStartDate() {
  const today = normalizeDate(new Date());
  let date = new Date(today);
  let businessDaysCount = 0;
  
  while (businessDaysCount < CONFIG.LOOK_BACK_DAYS) {
    date.setDate(date.getDate() - 1);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDaysCount++;
    }
  }
  return date;
}

/**
 * Restituisce le statistiche di priorità per una lista di utenti.
 * Logica comune usata sia da getUsersWithPriority() che da calculatePriority().
 *
 * Regole di congruenza:
 *  - Finestra: ultimi CONFIG.LOOK_BACK_DAYS giorni di calendario
 *  - Richieste conteggiate: 'assigned', 'not_assigned', 'pending'
 *    (le pending NON sono ancora risolte, quindi equivalgono a "non assegnate" ai fini della priorità)
 *  - Assegnazioni conteggiate: righe in AssignmentHistory nella stessa finestra
 *  - successRate = assegnazioni / richieste (se richieste == 0 → 0.0)
 *
 * @param {string[]} userIds - Lista di ID utenti da calcolare
 * @returns {Object} Mappa userId → { successRate, recentAssignments, recentRequests }
 */
function computePriorityStats(userIds) {
  const windowStartDate = getWindowStartDate();
  const today = normalizeDate(new Date());

  const history = getSheetAsJSON(CONFIG.SHEETS.ASSIGNMENT_HISTORY);
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);

  // Richieste rilevanti: pending, assigned, not_assigned nella finestra
  const relevantStatuses = new Set(['assigned', 'not_assigned', 'pending']);
  const recentReqs = allRequests.filter(r => {
    const d = normalizeDate(r.requestedDate);
    return d >= windowStartDate && d <= today && relevantStatuses.has(r.status);
  });

  // Assegnazioni storiche nella finestra
  const recentHistory = history.filter(h => {
    const d = normalizeDate(h.assignmentDate);
    return d >= windowStartDate && d <= today;
  });

  const stats = {};
  userIds.forEach(uid => {
    const assigns = recentHistory.filter(h => h.userId === uid).length;
    const reqs = recentReqs.filter(r => r.userId === uid).length;
    stats[uid] = {
      successRate: reqs > 0 ? assigns / reqs : 0.0,
      recentAssignments: assigns,
      recentRequests: reqs
    };
  });

  return stats;
}

// =================================================================
// AUTENTICAZIONE
// =================================================================

function loginUser(payload) {
  const { mail, password } = payload;
  if (!mail || !password) throw new Error("Email e password sono obbligatorie.");

  const users = getSheetAsJSON(CONFIG.SHEETS.USERS);
  const user = users.find(u => u.mail === mail);
  if (!user) throw new Error("Email o password non corretta.");

  if (user.isVerified !== true) {
    return {
      verificationNeeded: true,
      message: "Devi prima verificare la tua email. Controlla la tua casella di posta per il link di conferma."
    };
  }

  if (hashPassword(password, user.salt) !== user.password) throw new Error("Email o password non corretta.");

  delete user.password;
  delete user.salt;
  return user;
}

function signupUser(payload) {
  const { firstName, lastName, mail, password } = payload;
  if (!firstName || !mail || !password) throw new Error("Nome, email e password sono obbligatori.");

  const usersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.USERS);
  const users = getSheetAsJSON(CONFIG.SHEETS.USERS);

  if (users.some(u => u.mail === mail)) throw new Error("Un utente con questa email esiste già.");

  const salt = Utilities.getUuid();
  const hashedPassword = hashPassword(password, salt);
  const newId = "user_" + new Date().getTime();
  const verificationToken = Utilities.getUuid();

  usersSheet.appendRow([newId, firstName, lastName, mail, hashedPassword, salt, "", false, verificationToken, "", ""]);

  const verificationUrl = `${CONFIG.BASE_URL}verify-email?token=${verificationToken}`;
  sendEmail(mail, "Conferma la tua registrazione all'App Parcheggi",
    `Ciao ${firstName},\n\nGrazie per esserti registrato! Per favore, clicca sul link seguente per confermare il tuo indirizzo email:\n\n${verificationUrl}`
  );

  return { id: newId, firstName, lastName, mail };
}

function resendVerificationEmail(payload) {
  const { mail } = payload;
  if (!mail) throw new Error("Email non fornita.");

  const result = findRowByColumn(CONFIG.SHEETS.USERS, 'mail', mail);
  if (!result) throw new Error("Nessun utente trovato con questa email.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.USERS);
  if (result.data[result.headers.indexOf('isVerified')] === true) throw new Error("Questo account è già stato verificato.");

  const firstName = result.data[result.headers.indexOf('firstName')];
  const newToken = Utilities.getUuid();
  updateCell(sheet, result.row, 'verificationToken', newToken, result.headers);

  const verificationUrl = `${CONFIG.BASE_URL}verify-email?token=${newToken}`;
  sendEmail(mail, "Nuova richiesta di conferma email - App Parcheggi",
    `Ciao ${firstName},\n\nClicca sul nuovo link per confermare il tuo indirizzo email:\n\n${verificationUrl}`
  );

  return { message: "Una nuova email di verifica è stata inviata al tuo indirizzo." };
}

function verifyEmailToken(payload) {
  const { token } = payload;
  if (!token) throw new Error("Token mancante.");

  const result = findRowByColumn(CONFIG.SHEETS.USERS, 'verificationToken', token);
  if (!result) throw new Error("Token non valido o scaduto.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.USERS);
  updateCell(sheet, result.row, 'isVerified', true, result.headers);
  updateCell(sheet, result.row, 'verificationToken', "", result.headers);

  return { message: "Email verificata con successo!" };
}

function requestPasswordReset(payload) {
  const { mail } = payload;
  if (!mail) throw new Error("Email non fornita.");

  const result = findRowByColumn(CONFIG.SHEETS.USERS, 'mail', mail);
  if (!result) throw new Error("Nessun utente trovato con questa email.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.USERS);
  const resetToken = Utilities.getUuid();
  const expiryDate = new Date(new Date().getTime() + CONFIG.TOKEN_EXPIRY);

  updateCell(sheet, result.row, 'resetToken', resetToken, result.headers);
  updateCell(sheet, result.row, 'resetTokenExpiry', expiryDate, result.headers);

  const resetUrl = `${CONFIG.BASE_URL}reset-password?token=${resetToken}`;
  sendEmail(mail, "Recupero Password - App Parcheggi",
    `Ciao,\n\nHai richiesto di resettare la tua password. Clicca sul link seguente per procedere (il link è valido per un'ora):\n\n${resetUrl}`
  );

  return { message: "Email di recupero inviata con successo." };
}

function resetPassword(payload) {
  const { token, newPassword } = payload;
  if (!token || !newPassword) throw new Error("Token o nuova password mancanti.");

  const result = findRowByColumn(CONFIG.SHEETS.USERS, 'resetToken', token);
  if (!result) throw new Error("Token non valido o scaduto.");

  if (new Date().getTime() >= new Date(result.data[result.headers.indexOf('resetTokenExpiry')]).getTime()) {
    throw new Error("Token scaduto.");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.USERS);
  const newSalt = Utilities.getUuid();
  const hashedPassword = hashPassword(newPassword, newSalt);

  updateCell(sheet, result.row, 'password', hashedPassword, result.headers);
  updateCell(sheet, result.row, 'salt', newSalt, result.headers);
  updateCell(sheet, result.row, 'resetToken', "", result.headers);
  updateCell(sheet, result.row, 'resetTokenExpiry', "", result.headers);

  return { message: "Password aggiornata con successo." };
}

// =================================================================
// GESTIONE PROFILO UTENTE
// =================================================================

function updateUserProfile(payload) {
  const { id, firstName, lastName, mail: payloadMail, avatarColor, password, preferredTheme, primaryColor } = payload;
  if (!id) throw new Error("ID utente non fornito per l'aggiornamento.");

  const result = findRowByColumn(CONFIG.SHEETS.USERS, 'id', id);
  if (!result) throw new Error("Utente non trovato per l'aggiornamento.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.USERS);

  if (firstName !== undefined) updateCell(sheet, result.row, 'firstName', firstName, result.headers);
  if (lastName !== undefined) updateCell(sheet, result.row, 'lastName', lastName, result.headers);
  if (payloadMail !== undefined) updateCell(sheet, result.row, 'mail', payloadMail, result.headers);
  if (avatarColor !== undefined) updateCell(sheet, result.row, 'avatarColor', avatarColor, result.headers);
  if (preferredTheme !== undefined) updateCell(sheet, result.row, 'preferredTheme', preferredTheme, result.headers);
  if (primaryColor !== undefined) updateCell(sheet, result.row, 'primaryColor', primaryColor, result.headers);

  if (password) {
    const newSalt = Utilities.getUuid();
    updateCell(sheet, result.row, 'password', hashPassword(password, newSalt), result.headers);
    updateCell(sheet, result.row, 'salt', newSalt, result.headers);
  }

  const updatedUser = getSheetAsJSON(CONFIG.SHEETS.USERS).find(u => u.id === id);
  if (updatedUser) {
    delete updatedUser.password;
    delete updatedUser.salt;
  }

  return updatedUser || {};
}

/**
 * Recupera tutti gli utenti arricchiti con le statistiche di priorità.
 * Usa computePriorityStats() come unica fonte di verità per le statistiche.
 */
function getUsersWithPriority() {
  const allUsers = getSheetAsJSON(CONFIG.SHEETS.USERS);
  const userIds = allUsers.map(u => u.id);
  const stats = computePriorityStats(userIds);

  return allUsers.map(u => {
    const s = stats[u.id] || { successRate: 0.0, recentAssignments: 0, recentRequests: 0 };
    u.successRate = s.successRate;
    u.recentAssignments = s.recentAssignments;
    u.recentRequests = s.recentRequests;
    u.windowDays = CONFIG.LOOK_BACK_DAYS;

    delete u.password;
    delete u.salt;
    delete u.verificationToken;
    delete u.resetToken;
    delete u.resetTokenExpiry;
    return u;
  });
}

// =================================================================
// GESTIONE PARCHEGGI
// =================================================================

function addParkingSpace(payload) {
  const { number } = payload;
  if (!number || number.trim() === "") throw new Error("Il nome/numero del parcheggio è obbligatorio.");

  const spacesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.PARKING_SPACES);
  const newId = "space_" + new Date().getTime();
  spacesSheet.appendRow([newId, number.trim(), false]);

  return { id: newId, number: number.trim(), isFixed: false };
}

function deleteParkingSpace(payload) {
  const { spaceId } = payload;
  if (!spaceId) throw new Error("ID del parcheggio non fornito per l'eliminazione.");

  const today = normalizeDate(new Date());
  removeTemporaryAvailabilitiesForSpace(spaceId, today);
  cancelFutureAssignmentsForSpace(spaceId, today);

  const result = findRowByColumn(CONFIG.SHEETS.PARKING_SPACES, 'id', spaceId);
  if (!result) throw new Error("Parcheggio non trovato.");

  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.PARKING_SPACES).deleteRow(result.row);

  return {
    deletedSpaceId: spaceId,
    message: "Parcheggio rimosso. Le assegnazioni future sono state annullate ma lo storico è stato preservato."
  };
}

function removeTemporaryAvailabilitiesForSpace(spaceId, fromDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.TEMPORARY_AVAILABILITY);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === spaceId && normalizeDate(data[i][2]) >= fromDate) sheet.deleteRow(i + 1);
  }
}

function cancelFutureAssignmentsForSpace(spaceId, fromDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i = data.length - 1; i >= 1; i--) {
    if (
      data[i][headers.indexOf('assignedParkingSpaceId')] === spaceId &&
      data[i][headers.indexOf('status')] === 'assigned' &&
      normalizeDate(data[i][headers.indexOf('requestedDate')]) >= fromDate
    ) {
      updateCell(sheet, i + 1, 'status', 'not_assigned', headers);
      updateCell(sheet, i + 1, 'assignedParkingSpaceId', '', headers);
      updateCell(sheet, i + 1, 'assignedParkingSpaceNumber', '', headers);
    }
  }
}

function updateParkingSpaceFixedStatus(payload) {
  const { spaceId, isFixed } = payload;
  if (!spaceId) throw new Error("ID del parcheggio non fornito.");

  const result = findRowByColumn(CONFIG.SHEETS.PARKING_SPACES, 'id', spaceId);
  if (!result) throw new Error("Parcheggio non trovato.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.PARKING_SPACES);
  updateCell(sheet, result.row, 'isFixed', isFixed, result.headers);

  return { spaceId, isFixed };
}

function getParkingStatusForDate(payload) {
  const { date } = payload;
  if (!date) throw new Error("Data non fornita.");

  const targetDate = normalizeDate(date);
  const dateString = targetDate.toDateString();

  const allSpaces = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES);
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const tempAvail = getSheetAsJSON(CONFIG.SHEETS.TEMPORARY_AVAILABILITY)
    .filter(avail => normalizeDate(avail.availableDate).toDateString() === dateString);

  const fixedSpacesCount = allSpaces.filter(s => s.isFixed === true).length;
  const tempSpacesCount = new Set(tempAvail.map(a => a.parkingSpaceId)).size;
  const totalSpaces = fixedSpacesCount + tempSpacesCount;

  const assignedCount = allRequests.filter(req =>
    normalizeDate(req.requestedDate).toDateString() === dateString && req.status === 'assigned'
  ).length;

  return { total: totalSpaces, assigned: assignedCount, available: Math.max(0, totalSpaces - assignedCount) };
}

// =================================================================
// GESTIONE RICHIESTE
// =================================================================

function getRequestsForUser(payload) {
  const { userId } = payload;
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  if (!userId) return allRequests;
  return allRequests.filter(req => req.userId === userId);
}

function createBatchRequests(payload) {
  const { userId, dates, actorId } = payload;
  if (!userId || !dates || !Array.isArray(dates) || dates.length === 0) throw new Error("Dati mancanti.");

  const requestsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const userRequests = allRequests.filter(req => req.userId === userId);

  const createdRequests = [];
  const skippedDates = [];
  const today = normalizeDate(new Date());

  dates.forEach(dateStr => {
    const targetDate = normalizeDate(dateStr);

    if (!isWeekday(targetDate) || targetDate < today) {
      skippedDates.push(formatDate(targetDate));
      return;
    }

    const dateString = targetDate.toDateString();
    const hasExisting = userRequests.some(req =>
      normalizeDate(req.requestedDate).toDateString() === dateString &&
      req.status !== 'cancelled_by_user'
    );

    if (hasExisting) {
      skippedDates.push(formatDate(targetDate));
      return;
    }

    const requestId = "req_" + Utilities.getUuid();
    requestsSheet.appendRow([requestId, userId, targetDate, 'pending', '', '']);
    createdRequests.push({ requestId, date: targetDate });
  });

  if (createdRequests.length === 0 && skippedDates.length > 0) throw new Error("Nessuna richiesta creata.");

  // Notifica all'utente se è un'azione admin
  if (actorId && actorId !== userId && createdRequests.length > 0) {
    sendRequestCreatedEmail(userId, createdRequests.map(r => r.date), actorId);
  }

  // Assegnazione immediata se siamo già oltre l'orario di assegnazione e la richiesta è per oggi
  handleInstantAssignmentForToday(createdRequests, userId);

  return { message: `Create ${createdRequests.length} richieste.` };
}

function handleInstantAssignmentForToday(createdRequests, userId) {
  if (new Date().getHours() < CONFIG.ASSIGNMENT_HOUR) return;

  const today = normalizeDate(new Date());
  const requestsForToday = createdRequests.filter(req => normalizeDate(req.date).getTime() === today.getTime());
  if (requestsForToday.length === 0) return;

  const freeSpaces = getAvailableSpacesForDate(today);
  if (freeSpaces.length > 0) {
    assignParking({ requestId: requestsForToday[0].requestId, userId, requestedDate: requestsForToday[0].date }, freeSpaces[0]);
  }
}

function updateRequestDate(payload) {
  const { requestId, newDate, actorId } = payload;
  if (!requestId || !newDate) throw new Error("Dati insufficienti per aggiornare la richiesta.");

  const result = findRowByColumn(CONFIG.SHEETS.REQUESTS, 'requestId', requestId);
  if (!result) throw new Error("Richiesta da aggiornare non trovata.");

  const status = result.data[result.headers.indexOf('status')];
  const oldRequestDate = normalizeDate(result.data[result.headers.indexOf('requestedDate')]);
  const userId = result.data[result.headers.indexOf('userId')];
  const today = normalizeDate(new Date());

  if (status !== 'pending') throw new Error("Puoi modificare solo le richieste in attesa.");
  if (oldRequestDate < today && formatDate(oldRequestDate) !== formatDate(today)) throw new Error("Non puoi modificare una richiesta passata.");

  const targetDate = normalizeDate(newDate);
  if (targetDate < today) throw new Error("Non puoi spostare una richiesta a una data passata.");

  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const hasExistingRequest = allRequests.some(req =>
    req.userId === userId &&
    req.requestId !== requestId &&
    normalizeDate(req.requestedDate).getTime() === targetDate.getTime() &&
    req.status !== 'cancelled_by_user'
  );
  if (hasExistingRequest) throw new Error("L'utente ha già un'altra richiesta attiva per la nuova data selezionata.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  updateCell(sheet, result.row, 'requestedDate', targetDate, result.headers);
  logToClient(`Richiesta ${requestId} spostata al ${formatDate(targetDate)}.`);

  if (actorId && actorId !== userId) sendAdminModificationEmail(userId, oldRequestDate, targetDate);

  return { message: "Richiesta aggiornata con successo." };
}

function cancelMultipleRequests(payload) {
  const { requestIds, actorId } = payload;
  if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) throw new Error("Nessun ID di richiesta fornito.");

  const uniqueRequestIds = [...new Set(requestIds)];
  let processedCount = 0;
  const errors = [];
  const requestsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  const today = normalizeDate(new Date());

  uniqueRequestIds.forEach(reqId => {
    try {
      const result = findRowByColumn(CONFIG.SHEETS.REQUESTS, 'requestId', reqId);
      if (!result) { logToClient(`Richiesta ${reqId} non trovata, saltata.`); return; }

      const status = result.data[result.headers.indexOf('status')];
      const requestDate = normalizeDate(result.data[result.headers.indexOf('requestedDate')]);
      const userId = result.data[result.headers.indexOf('userId')];

      if (requestDate < today) { logToClient(`Richiesta ${reqId} passata, saltata.`); return; }
      if (status === 'cancelled_by_user') { logToClient(`Richiesta ${reqId} già cancellata, saltata.`); return; }

      const notifyUser = actorId && actorId !== userId;

      if (status === 'pending') {
        if (notifyUser) sendAdminCancellationEmail(userId, requestDate);
        requestsSheet.deleteRow(result.row);
        processedCount++;
      } else if (status === 'not_assigned') {
        if (notifyUser) sendAdminCancellationEmail(userId, requestDate);
        updateCell(requestsSheet, result.row, 'status', 'cancelled_by_user', result.headers);
        processedCount++;
      } else if (status === 'assigned') {
        if (notifyUser) sendAdminCancellationEmail(userId, requestDate);
        cancelAssignmentAndReassign({ requestId: reqId, actorId });
        processedCount++;
      }
    } catch (e) {
      const errorMsg = `Errore processando ${reqId}: ${e.message}`;
      logToClient(errorMsg);
      errors.push(errorMsg);
    }
  });

  SpreadsheetApp.flush();

  if (processedCount === 0 && errors.length === 0) {
    throw new Error("Nessuna delle richieste selezionate poteva essere processata.");
  }

  let message = `${processedCount} richieste/assegnazioni processate con successo.`;
  if (errors.length > 0) message += ` Errori: ${errors.join('; ')}`;
  return { message };
}

function fulfillParkingRequest(payload) {
  const { requestId, donorUserId } = payload;
  if (!requestId || !donorUserId) throw new Error("Dati insufficienti per cedere il parcheggio.");

  logToClient(`Tentativo di cessione da ${donorUserId} per la richiesta ${requestId}`);

  const result = findRowByColumn(CONFIG.SHEETS.REQUESTS, 'requestId', requestId);
  if (!result) throw new Error("Richiesta non trovata.");

  const request = {};
  result.headers.forEach((header, index) => request[header] = result.data[index]);

  const requestDate = normalizeDate(request.requestedDate);
  const today = normalizeDate(new Date());

  if (requestDate.getTime() !== today.getTime()) throw new Error("Questo link di cessione è valido solo per il giorno stesso.");
  if (request.status === 'assigned') throw new Error("Questa richiesta ha già un parcheggio assegnato.");
  if (request.status === 'cancelled_by_user') throw new Error("Questa richiesta è stata annullata dall'utente.");

  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const dateString = requestDate.toDateString();

  const donorRequest = allRequests.find(r =>
    r.userId === donorUserId &&
    normalizeDate(r.requestedDate).toDateString() === dateString &&
    r.status === 'assigned'
  );
  if (!donorRequest) throw new Error("Non è stato trovato un parcheggio assegnato al donatore per oggi.");

  const allSpaces = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES);
  const spaceId = donorRequest.assignedParkingSpaceId;
  const spaceObj = allSpaces.find(s => s.id === spaceId);
  const hasTempAvail = getSheetAsJSON(CONFIG.SHEETS.TEMPORARY_AVAILABILITY)
    .some(avail => avail.parkingSpaceId === spaceId && normalizeDate(avail.availableDate).toDateString() === dateString);

  if (!spaceObj || (spaceObj.isFixed !== true && !hasTempAvail)) {
    throw new Error("Il parcheggio che si sta tentando di cedere non è più disponibile.");
  }

  // Annulla l'assegnazione del donatore
  logToClient(`Annullamento assegnazione donatore (ID: ${donorRequest.requestId}).`);
  const donorResult = findRowByColumn(CONFIG.SHEETS.REQUESTS, 'requestId', donorRequest.requestId);
  const requestsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  updateCell(requestsSheet, donorResult.row, 'status', 'cancelled_by_user', donorResult.headers);
  updateCell(requestsSheet, donorResult.row, 'assignedParkingSpaceId', '', donorResult.headers);
  updateCell(requestsSheet, donorResult.row, 'assignedParkingSpaceNumber', '', donorResult.headers);
  removeFromHistory(donorUserId, requestDate);
  SpreadsheetApp.flush();

  // Assegna il posto liberato al ricevente
  const freedSpace = { id: spaceId, number: donorRequest.assignedParkingSpaceNumber };
  logToClient(`Assegnazione del posto ${freedSpace.number} alla richiesta ${requestId}.`);
  assignParking(request, freedSpace);

  // Pulizia storico se overbooking risolto
  if (!checkOverbookingForDate(requestDate)) clearHistoryForDate(requestDate);

  const users = getSheetAsJSON(CONFIG.SHEETS.USERS);
  const donorUser = users.find(u => u.id === donorUserId);
  const recipientUser = users.find(u => u.id === request.userId);

  if (donorUser) {
    sendEmail(
      donorUser.mail,
      "Conferma Cessione Parcheggio",
      `Ciao ${donorUser.firstName},\n\nGrazie! Il tuo parcheggio (${freedSpace.number}) per oggi (${formatDate(requestDate)}) è stato ceduto con successo a ${recipientUser.firstName} ${recipientUser.lastName}.\n\nBuona giornata!`
    );
  }

  return { message: `Grazie! Il parcheggio è stato ceduto con successo a ${recipientUser.firstName} ${recipientUser.lastName}.` };
}

function adminUpdateUserRequestStatus(payload) {
  const { requestId, newStatus, actorId } = payload;
  if (!requestId || !newStatus) throw new Error("Dati insufficienti per l'aggiornamento.");

  const result = findRowByColumn(CONFIG.SHEETS.REQUESTS, 'requestId', requestId);
  if (!result) throw new Error("Richiesta non trovata.");

  const headers = result.headers;
  const oldStatus = result.data[headers.indexOf('status')];
  const userId = result.data[headers.indexOf('userId')];
  const requestDate = normalizeDate(result.data[headers.indexOf('requestedDate')]);
  const currentSpaceId = result.data[headers.indexOf('assignedParkingSpaceId')];
  const currentSpaceNum = result.data[headers.indexOf('assignedParkingSpaceNumber')];

  if (oldStatus === newStatus) return { message: "Stato invariato." };

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);

  if (oldStatus === 'assigned' && newStatus !== 'assigned') {
    updateCell(sheet, result.row, 'status', newStatus, headers);
    updateCell(sheet, result.row, 'assignedParkingSpaceId', '', headers);
    updateCell(sheet, result.row, 'assignedParkingSpaceNumber', '', headers);
    removeFromHistory(userId, requestDate);
    SpreadsheetApp.flush();

    sendAdminCancellationEmail(userId, requestDate);

    // Riassegna escludendo l'utente appena revocato
    const bestCandidate = findBestCandidate(requestDate, userId);
    if (bestCandidate) {
      const spaceObj = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES).find(s => s.id === currentSpaceId);
      if (spaceObj) assignParking(bestCandidate, { id: currentSpaceId, number: currentSpaceNum });
    }
  } else if (newStatus === 'assigned' && oldStatus !== 'assigned') {
    const freeSpaces = getAvailableSpacesForDate(requestDate);
    if (freeSpaces.length === 0) throw new Error("Nessun posto disponibile.");
    assignParking({ requestId, userId, requestedDate: requestDate }, freeSpaces[0]);
  } else {
    updateCell(sheet, result.row, 'status', newStatus, headers);
  }

  SpreadsheetApp.flush();
  return { message: "Operazione completata con successo." };
}

function adminUpdateRequestStatus(payload) {
  const { requestId, newStatus } = payload;
  if (!requestId || !newStatus) throw new Error("Dati insufficienti.");

  const result = findRowByColumn(CONFIG.SHEETS.REQUESTS, 'requestId', requestId);
  if (!result) throw new Error("Richiesta non trovata.");

  const headers = result.headers;
  const oldStatus = result.data[headers.indexOf('status')];
  const userId = result.data[headers.indexOf('userId')];
  const requestDate = normalizeDate(result.data[headers.indexOf('requestedDate')]);
  const currentSpaceId = result.data[headers.indexOf('assignedParkingSpaceId')];
  const currentSpaceNum = result.data[headers.indexOf('assignedParkingSpaceNumber')];

  if (oldStatus === newStatus) return { message: "Stato invariato." };

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);

  if (oldStatus === 'assigned' && newStatus !== 'assigned') {
    updateCell(sheet, result.row, 'status', newStatus, headers);
    updateCell(sheet, result.row, 'assignedParkingSpaceId', '', headers);
    updateCell(sheet, result.row, 'assignedParkingSpaceNumber', '', headers);
    removeFromHistory(userId, requestDate);
    SpreadsheetApp.flush();

    sendAdminCancellationEmail(userId, requestDate);

    const spaceObj = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES).find(s => s.id === currentSpaceId);
    if (spaceObj) {
      const bestCandidate = findBestCandidate(requestDate);
      if (bestCandidate) {
        logToClient(`Riassegnazione al miglior candidato: ${bestCandidate.userId}`);
        assignParking(bestCandidate, { id: currentSpaceId, number: currentSpaceNum });
      }
    }
  } else if (newStatus === 'assigned' && oldStatus !== 'assigned') {
    const freeSpaces = getAvailableSpacesForDate(requestDate);
    if (freeSpaces.length === 0) throw new Error("Nessun posto libero.");
    assignParking({ requestId, userId, requestedDate: requestDate }, freeSpaces[0]);
  } else {
    updateCell(sheet, result.row, 'status', newStatus, headers);
  }

  SpreadsheetApp.flush();
  return { message: "Operazione completata con successo." };
}

// =================================================================
// PROCESSO DI ASSEGNAZIONE
// =================================================================

/**
 * Trigger automatico (es. alle 19:00): assegna i posti per domani.
 */
function processPendingRequests() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowNorm = normalizeDate(tomorrow);
  logToClient(`AVVIO ASSEGNAZIONE AUTOMATICA per ${formatDate(tomorrowNorm)}`, "INFO");
  processRequestsForDate(tomorrowNorm);
}

/**
 * Motore di assegnazione per una data specifica.
 * Ordina le richieste pending per priorità (successRate crescente = priorità alta).
 */
function processRequestsForDate(targetDate) {
  const targetDateNorm = normalizeDate(targetDate);
  logToClient(`ProcessRequestsForDate: Inizio per ${formatDate(targetDateNorm)}`);

  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const pendingRequests = allRequests.filter(req =>
    req.status === 'pending' &&
    normalizeDate(req.requestedDate).getTime() === targetDateNorm.getTime()
  );

  if (pendingRequests.length === 0) {
    logToClient(`Nessuna richiesta 'pending' per ${formatDate(targetDateNorm)}.`);
    return { assigned: 0, failed: 0 };
  }

  const availableSpaces = getAvailableSpacesForDate(targetDateNorm);
  logToClient(`${pendingRequests.length} richieste pending, ${availableSpaces.length} posti disponibili.`);

  let assignedCount = 0;
  let failedCount = 0;

  if (availableSpaces.length === 0) {
    pendingRequests.forEach(request => {
      updateRequestStatus(request.requestId, 'not_assigned');
      sendFailureEmail(request.userId, request.requestedDate);
      failedCount++;
    });
    return { assigned: assignedCount, failed: failedCount };
  }

  const isOverbooking = pendingRequests.length > availableSpaces.length;
  const requestsToProcess = calculatePriority(pendingRequests);

  requestsToProcess.forEach((request, i) => {
    if (i < availableSpaces.length) {
      assignParking(request, availableSpaces[i]);
      assignedCount++;
    } else {
      updateRequestStatus(request.requestId, 'not_assigned');
      sendFailureEmail(request.userId, request.requestedDate);
      failedCount++;
    }
  });

  logToClient(`Completato: ${assignedCount} assegnati, ${failedCount} non assegnati.`);
  return { assigned: assignedCount, failed: failedCount };
}

function getAvailableSpacesForDate(date) {
  const allSpaces = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES);
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const dateString = normalizeDate(date).toDateString();

  const tempAvail = getSheetAsJSON(CONFIG.SHEETS.TEMPORARY_AVAILABILITY)
    .filter(avail => normalizeDate(avail.availableDate).toDateString() === dateString);

  const fixedSpaces = allSpaces.filter(s => s.isFixed === true);
  const tempSpaces = tempAvail
    .map(avail => allSpaces.find(space => space.id === avail.parkingSpaceId))
    .filter(Boolean);

  const assignedSpaceIds = new Set(
    allRequests
      .filter(req => req.status === 'assigned' && normalizeDate(req.requestedDate).toDateString() === dateString)
      .map(req => req.assignedParkingSpaceId)
  );

  return [...fixedSpaces, ...tempSpaces].filter(space => !assignedSpaceIds.has(space.id));
}

/**
 * Ordina le richieste per priorità usando computePriorityStats().
 * Chi ha successRate più basso → priorità più alta.
 * A parità di successRate, ordine casuale.
 */
function calculatePriority(requests) {
  const userIds = requests.map(r => r.userId);
  const stats = computePriorityStats(userIds);

  return requests
    .map(req => ({ ...req, priority: (stats[req.userId] || { successRate: 0.0 }).successRate }))
    .sort((a, b) => a.priority - b.priority || Math.random() - 0.5);
}

/**
 * Assegna un parcheggio: aggiorna la richiesta, registra nello storico, invia email.
 */
function assignParking(request, space) {
  updateRequestStatus(request.requestId, 'assigned', space.id, space.number);

  const historySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.ASSIGNMENT_HISTORY);
  historySheet.appendRow([request.userId, request.requestedDate, space.id]);

  sendSuccessEmail(request.userId, request.requestedDate, space.number);
}

function updateRequestStatus(requestId, status, spaceId = '', spaceNumber = '') {
  const result = findRowByColumn(CONFIG.SHEETS.REQUESTS, 'requestId', requestId);
  if (!result) return;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  updateCell(sheet, result.row, 'status', status, result.headers);
  updateCell(sheet, result.row, 'assignedParkingSpaceId', spaceId, result.headers);
  updateCell(sheet, result.row, 'assignedParkingSpaceNumber', spaceNumber, result.headers);
}

function sendSuccessEmail(userId, date, spaceNumber) {
  const user = getSheetAsJSON(CONFIG.SHEETS.USERS).find(u => u.id === userId);
  if (user) {
    sendEmail(user.mail, "Conferma Assegnazione Parcheggio",
      `Ciao ${user.firstName},\n\nLa tua richiesta di parcheggio per il giorno ${formatDate(date)} è stata approvata!\n\nTi è stato assegnato il posto: ${spaceNumber}\n\nBuona giornata!`
    );
  }
}

function sendFailureEmail(userId, date) {
  const user = getSheetAsJSON(CONFIG.SHEETS.USERS).find(u => u.id === userId);
  if (user) {
    sendEmail(user.mail, "Esito Richiesta Parcheggio",
      `Ciao ${user.firstName},\n\nSiamo spiacenti, ma a causa dell'elevato numero di richieste, non è stato possibile assegnarti un parcheggio per il giorno ${formatDate(date)}.\n\nCi scusiamo per il disagio.`
    );
  }
}

// =================================================================
// GESTIONE ASSEGNAZIONI E CANCELLAZIONI
// =================================================================

function cancelAssignmentAndReassign(payload) {
  const { requestId, actorId } = payload;
  if (!requestId) throw new Error("ID della richiesta non fornito.");

  const result = findRowByColumn(CONFIG.SHEETS.REQUESTS, 'requestId', requestId);
  if (!result) throw new Error("Richiesta non trovata.");

  const requestToCancel = {};
  result.headers.forEach((header, index) => requestToCancel[header] = result.data[index]);

  if (requestToCancel.status !== 'assigned') throw new Error("Puoi annullare solo un parcheggio assegnato.");

  const requestDate = normalizeDate(requestToCancel.requestedDate);
  const today = normalizeDate(new Date());
  if (requestDate < today) throw new Error("Non puoi annullare un'assegnazione passata.");

  const cancelledSpaceId = requestToCancel.assignedParkingSpaceId;
  const cancelledSpaceNumber = requestToCancel.assignedParkingSpaceNumber;
  const cancellingUserId = requestToCancel.userId;

  logToClient(`Annullamento assegnazione per ${cancellingUserId} (Req: ${requestId}) del ${formatDate(requestDate)}`);

  removeFromHistory(cancellingUserId, requestDate);

  const requestsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  updateCell(requestsSheet, result.row, 'status', 'cancelled_by_user', result.headers);
  updateCell(requestsSheet, result.row, 'assignedParkingSpaceId', '', result.headers);
  updateCell(requestsSheet, result.row, 'assignedParkingSpaceNumber', '', result.headers);
  SpreadsheetApp.flush();

  const allSpaces = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES);
  const spaceObj = allSpaces.find(s => s.id === cancelledSpaceId);
  const dateString = requestDate.toDateString();
  const hasTempAvail = getSheetAsJSON(CONFIG.SHEETS.TEMPORARY_AVAILABILITY)
    .some(avail => avail.parkingSpaceId === cancelledSpaceId && normalizeDate(avail.availableDate).toDateString() === dateString);

  const isReassignable = spaceObj && (spaceObj.isFixed === true || hasTempAvail);
  let reassigned = false;

  if (isReassignable) {
    const newRecipient = findBestCandidate(requestDate, cancellingUserId);
    if (newRecipient) {
      logToClient(`Riassegnazione posto ${cancelledSpaceNumber} a ${newRecipient.userId}.`);
      assignParking(newRecipient, { id: cancelledSpaceId, number: cancelledSpaceNumber });
      reassigned = true;
    } else {
      logToClient(`Posto ${cancelledSpaceNumber} liberato, ma nessun candidato in attesa.`);
    }
  } else {
    logToClient(`Il posto ${cancelledSpaceNumber} non è riassegnabile automaticamente.`);
  }

  let message = "La tua assegnazione è stata annullata";
  if (reassigned) message += " e il posto è stato riassegnato.";
  else if (!spaceObj) message += ". Il posto è stato rimosso dal sistema.";
  else message += ".";

  return { message };
}

function removeFromHistory(userId, date) {
  const historySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.ASSIGNMENT_HISTORY);
  const data = historySheet.getDataRange().getValues();
  const dateNorm = normalizeDate(date);
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === userId && normalizeDate(data[i][1]).getTime() === dateNorm.getTime()) {
      historySheet.deleteRow(i + 1);
      break;
    }
  }
}

function checkOverbookingForDate(date) {
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const allSpaces = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES);
  const dateString = normalizeDate(date).toDateString();

  const relevantRequestsCount = allRequests.filter(r =>
    normalizeDate(r.requestedDate).toDateString() === dateString &&
    r.status !== 'cancelled_by_user'
  ).length;

  const fixedSpaces = allSpaces.filter(s => s.isFixed === true).length;
  const tempSpaceIds = new Set(
    getSheetAsJSON(CONFIG.SHEETS.TEMPORARY_AVAILABILITY)
      .filter(avail => normalizeDate(avail.availableDate).toDateString() === dateString)
      .map(avail => avail.parkingSpaceId)
  );
  const totalPotentialSpaces = fixedSpaces + tempSpaceIds.size;

  logToClient(`checkOverbooking ${dateString}: Richieste=${relevantRequestsCount}, Posti=${totalPotentialSpaces}`);
  return relevantRequestsCount > totalPotentialSpaces;
}

function findBestCandidate(date, excludeUserId = null) {
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const dateString = normalizeDate(date).toDateString();

  const candidates = allRequests.filter(r =>
    normalizeDate(r.requestedDate).toDateString() === dateString &&
    (r.status === 'not_assigned' || r.status === 'pending') &&
    r.userId !== excludeUserId
  );

  if (candidates.length === 0) return null;
  return calculatePriority(candidates)[0];
}

// =================================================================
// GESTIONE DISPONIBILITÀ TEMPORANEE
// =================================================================

function addTemporaryAvailability(payload) {
  const { spaceId, date } = payload;
  if (!spaceId || !date) throw new Error("ID del parcheggio e data sono obbligatori.");

  const targetDate = normalizeDate(date);
  const availSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.TEMPORARY_AVAILABILITY);
  const newId = "avail_" + Utilities.getUuid();
  availSheet.appendRow([newId, spaceId, targetDate]);
  SpreadsheetApp.flush();

  const today = normalizeDate(new Date());

  // Assegnazione immediata se il posto è aggiunto per oggi
  if (targetDate.getTime() === today.getTime()) {
    logToClient("Disponibilità aggiunta per oggi. Tentativo di assegnazione immediata.");
    const candidate = findBestCandidate(targetDate);
    if (candidate) {
      const spaceDetails = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES).find(s => s.id === spaceId);
      if (spaceDetails) assignParking(candidate, spaceDetails);
    }
  }

  // Riassegnazione immediata se dopo le 19:00 e per domani
  handleInstantReassignment(spaceId, targetDate);

  return { availabilityId: newId, parkingSpaceId: spaceId, availableDate: targetDate };
}

function handleInstantReassignment(spaceId, targetDate) {
  const now = new Date();
  const tomorrow = normalizeDate(new Date());
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (now.getHours() < CONFIG.ASSIGNMENT_HOUR) return;
  if (normalizeDate(targetDate).getTime() !== tomorrow.getTime()) return;

  logToClient("Tentativo riassegnazione immediata post-orario per domani.");
  const candidate = findBestCandidate(targetDate);
  if (!candidate) return;

  const spaceDetails = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES).find(s => s.id === spaceId);
  if (spaceDetails) assignParking(candidate, spaceDetails);
}

function getTemporaryAvailabilities(payload) {
  const { spaceId } = payload;
  if (!spaceId) throw new Error("ID del parcheggio non fornito.");

  const today = normalizeDate(new Date());
  return getSheetAsJSON(CONFIG.SHEETS.TEMPORARY_AVAILABILITY)
    .filter(avail => avail.parkingSpaceId === spaceId && normalizeDate(avail.availableDate) >= today)
    .sort((a, b) => normalizeDate(a.availableDate) - normalizeDate(b.availableDate));
}

function removeTemporaryAvailability(payload) {
  const { availabilityId } = payload;
  if (!availabilityId) throw new Error("ID della disponibilità non fornito.");

  const result = findRowByColumn(CONFIG.SHEETS.TEMPORARY_AVAILABILITY, 'availabilityId', availabilityId);
  if (!result) throw new Error("Disponibilità non trovata.");

  const spaceIdToRemove = result.data[result.headers.indexOf('parkingSpaceId')];
  const targetDate = normalizeDate(result.data[result.headers.indexOf('availableDate')]);
  const dateString = targetDate.toDateString();

  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.TEMPORARY_AVAILABILITY).deleteRow(result.row);
  logToClient(`Disponibilità ${availabilityId} rimossa.`);

  // Annulla l'assegnazione collegata a questo posto temporaneo, se presente
  const requestsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  const requestsData = requestsSheet.getDataRange().getValues();
  const requestsHeaders = requestsData[0];
  let cancelledAssignment = false;

  for (let i = requestsData.length - 1; i >= 1; i--) {
    const req = {};
    requestsHeaders.forEach((header, index) => req[header] = requestsData[i][index]);

    if (
      req.status === 'assigned' &&
      req.assignedParkingSpaceId === spaceIdToRemove &&
      normalizeDate(req.requestedDate).toDateString() === dateString
    ) {
      logToClient(`Annullamento assegnazione ${req.requestId} per rimozione disponibilità temporanea.`);
      updateCell(requestsSheet, i + 1, 'status', 'not_assigned', requestsHeaders);
      updateCell(requestsSheet, i + 1, 'assignedParkingSpaceId', '', requestsHeaders);
      updateCell(requestsSheet, i + 1, 'assignedParkingSpaceNumber', '', requestsHeaders);
      removeFromHistory(req.userId, targetDate);
      cancelledAssignment = true;
      break;
    }
  }

  if (cancelledAssignment && !checkOverbookingForDate(targetDate)) {
    logToClient(`Nessun overbooking dopo la rimozione. Pulizia storico.`);
    clearHistoryForDate(targetDate);
  }

  return {
    message: "Disponibilità rimossa con successo." +
      (cancelledAssignment ? " L'assegnazione collegata è stata annullata." : "")
  };
}

// =================================================================
// FUNZIONI ADMIN CALENDARIO
// =================================================================

function adminCancelAllRequestsForDate(payload) {
  const { date } = payload;
  if (!date) throw new Error("Data non fornita.");

  const targetDateStr = formatDate(date);
  const targetDateObj = normalizeDate(date);
  logToClient(`ADMIN: Cancellazione totale richieste per ${targetDateStr}`, "INFO");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const dateColIdx = headers.indexOf('requestedDate');
  const userColIdx = headers.indexOf('userId');

  let deletedCount = 0;
  const usersToNotify = {};

  for (let i = data.length - 1; i >= 1; i--) {
    const rowDateRaw = data[i][dateColIdx];
    if (!rowDateRaw) continue;

    if (formatDate(rowDateRaw) === targetDateStr) {
      usersToNotify[data[i][userColIdx]] = true;
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }

  if (deletedCount > 0) clearHistoryForDate(targetDateObj);
  SpreadsheetApp.flush();

  Object.keys(usersToNotify).forEach(userId => sendAdminCancellationEmail(userId, targetDateObj));

  logToClient(`ADMIN: Eliminate ${deletedCount} richieste per ${targetDateStr}.`);
  return { message: `Eliminate ${deletedCount} richieste per il ${targetDateStr} e storico aggiornato.` };
}

/**
 * Resetta tutte le richieste 'assigned' e 'not_assigned' a 'pending' per una data,
 * cancella lo storico e notifica gli utenti revocati.
 */
function adminResetAssignmentsForDate(payload) {
  const { date } = payload;
  if (!date) throw new Error("Data non fornita.");

  const targetDate = normalizeDate(date);
  const targetDateStr = formatDate(date);
  logToClient(`ADMIN: Reset assegnazioni per ${targetDateStr}`, "INFO");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());

  const dateColIdx = headers.indexOf('requestedDate');
  const statusColIdx = headers.indexOf('status');
  const userColIdx = headers.indexOf('userId');
  const assignedIdColIdx = headers.indexOf('assignedParkingSpaceId');
  const assignedNumColIdx = headers.indexOf('assignedParkingSpaceNumber');

  if (dateColIdx === -1 || statusColIdx === -1) throw new Error("Colonne necessarie non trovate nel foglio Requests.");

  let resetCount = 0;
  const usersToNotify = {};

  for (let i = 1; i < data.length; i++) {
    const rowDateRaw = data[i][dateColIdx];
    const statusRaw = String(data[i][statusColIdx] || '').trim();
    if (!rowDateRaw || formatDate(rowDateRaw) !== targetDateStr) continue;

    if (statusRaw === 'assigned' || statusRaw === 'not_assigned') {
      // Notifica solo chi perdeva il posto
      if (statusRaw === 'assigned') usersToNotify[data[i][userColIdx]] = true;

      sheet.getRange(i + 1, statusColIdx + 1).setValue('pending');
      sheet.getRange(i + 1, assignedIdColIdx + 1).setValue('');
      sheet.getRange(i + 1, assignedNumColIdx + 1).setValue('');
      resetCount++;
    }
  }

  if (resetCount > 0) {
    clearHistoryForDate(targetDate);
    Object.keys(usersToNotify).forEach(userId => sendAdminCancellationEmail(userId, date));
  } else {
    logToClient(`ADMIN: Nessuna richiesta da resettare per ${targetDateStr}.`);
  }

  SpreadsheetApp.flush();
  return { message: `${resetCount} richieste resettate a 'In attesa' per il ${targetDateStr}.` };
}

function adminManuallyAssignForDate(payload) {
  const { date } = payload;
  if (!date) throw new Error("Data non fornita.");

  const targetDate = normalizeDate(date);
  logToClient(`ADMIN: Assegnazione manuale per ${formatDate(targetDate)}`, "INFO");

  const result = processRequestsForDate(targetDate);
  return {
    message: `Assegnazione manuale completata per il ${formatDate(targetDate)}. ${result.assigned} assegnati, ${result.failed} non assegnati.`
  };
}

function adminAssignParckingForDate(payload) {
  const { date, userId, spaceId } = payload;
  if (!date || !userId || !spaceId) throw new Error("Dati insufficienti (data, utente o posto mancanti).");

  const targetDate = normalizeDate(date);
  logToClient(`ADMIN: Assegnazione manuale per ${formatDate(targetDate)}, utente: ${userId}, posto: ${spaceId}`, "INFO");

  const spaceDetails = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES).find(s => s.id === spaceId);
  if (!spaceDetails) throw new Error("Parcheggio non trovato.");

  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const existingRequest = allRequests.find(r =>
    r.userId === userId && normalizeDate(r.requestedDate).getTime() === targetDate.getTime()
  );

  if (existingRequest) {
    updateRequestStatus(existingRequest.requestId, 'assigned', spaceId, spaceDetails.number);
  } else {
    const requestId = "req_" + Utilities.getUuid();
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS)
      .appendRow([requestId, userId, targetDate, 'assigned', spaceId, spaceDetails.number]);
  }

  removeFromHistory(userId, targetDate);
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.ASSIGNMENT_HISTORY)
    .appendRow([userId, targetDate, spaceId]);

  sendSuccessEmail(userId, targetDate, spaceDetails.number);

  return { message: `Posto ${spaceDetails.number} assegnato a ${userId} per il ${formatDate(targetDate)}.` };
}

// =================================================================
// COMUNICAZIONI
// =================================================================

function sendAdminCommunication(payload) {
  const { message, isPersistent, startDate, endDate } = payload;
  if (!message) throw new Error("Il messaggio non può essere vuoto.");
  if (isPersistent && (!startDate || !endDate)) throw new Error("Data inizio e fine obbligatorie per messaggi persistenti.");

  const allUsers = getSheetAsJSON(CONFIG.SHEETS.USERS);
  let emailCount = 0;

  allUsers.forEach(user => {
    if (user.mail && user.isVerified) {
      try {
        MailApp.sendEmail({
          to: user.mail,
          subject: "Comunicazione di Servizio - Park App",
          body: `Ciao ${user.firstName},\n\n${message}\n\nCordiali saluti,\nL'Amministrazione`,
          name: CONFIG.EMAIL.FROM_NAME,
          replyTo: CONFIG.EMAIL.REPLY_TO
        });
        emailCount++;
      } catch (e) {
        logToClient(`Errore invio a ${user.mail}: ${e.message}`, "ERROR");
      }
    }
  });

  if (isPersistent) {
    const commSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.COMMUNICATIONS);
    commSheet.appendRow(["comm_" + new Date().getTime(), message, true, normalizeDate(startDate), normalizeDate(endDate), new Date()]);
    logToClient(`Comunicazione persistente salvata.`);
  }

  return { message: `Comunicazione inviata a ${emailCount} utenti.` };
}

function getActiveCommunication() {
  const commSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.COMMUNICATIONS);
  if (!commSheet) return [];

  const data = commSheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data.shift();
  const today = normalizeDate(new Date()).getTime();
  const activeMessages = [];

  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    if (row[headers.indexOf('isPersistent')] === true) {
      const startDate = normalizeDate(row[headers.indexOf('startDate')]).getTime();
      const endDate = normalizeDate(row[headers.indexOf('endDate')]).getTime();
      if (today >= startDate && today <= endDate) {
        activeMessages.push({ message: row[headers.indexOf('message')], id: row[headers.indexOf('id')] });
      }
    }
  }

  return activeMessages;
}

function deleteCommunication(payload) {
  const { id } = payload;
  if (!id) throw new Error("ID comunicazione mancante.");

  const result = findRowByColumn(CONFIG.SHEETS.COMMUNICATIONS, 'id', id);
  if (!result) throw new Error("Comunicazione non trovata.");

  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.COMMUNICATIONS).deleteRow(result.row);
  logToClient(`Comunicazione ${id} eliminata.`);

  return { message: "Comunicazione cancellata con successo." };
}

// =================================================================
// EMAIL HELPERS
// =================================================================

function sendRequestCreatedEmail(userId, dates, actorId) {
  try {
    const users = getSheetAsJSON(CONFIG.SHEETS.USERS);
    const user = users.find(u => u.id === userId);
    const actor = users.find(u => u.id === actorId);
    if (user && actor) {
      const formattedDates = dates.map(d => formatDate(d)).join(', ');
      sendEmail(user.mail, "Nuova Richiesta Parcheggio Inserita",
        `Ciao ${user.firstName},\n\nL'amministratore ${actor.firstName} ${actor.lastName} ha inserito delle richieste di parcheggio a tuo nome per le seguenti date:\n\n${formattedDates}\n\nRiceverai una conferma quando il posto verrà assegnato.\n\nBuona giornata!`
      );
    }
  } catch (e) {
    logToClient(`Errore invio email creazione richiesta: ${e.message}`, "ERROR");
  }
}

function sendAdminCancellationEmail(userId, date) {
  try {
    const user = getSheetAsJSON(CONFIG.SHEETS.USERS).find(u => u.id === userId);
    if (user) {
      const formattedDate = formatDate(date);
      sendEmail(user.mail,
        `Notifica: Richiesta Parcheggio Cancellata - ${formattedDate}`,
        `Ciao ${user.firstName},\n\nTi informiamo che la tua richiesta di parcheggio per il giorno ${formattedDate} è stata cancellata da un amministratore.\n\nBuona giornata!`
      );
    }
  } catch (e) {
    logToClient(`Errore invio email cancellazione admin: ${e.message}`, "ERROR");
  }
}

function sendAdminModificationEmail(userId, oldDate, newDate) {
  try {
    const user = getSheetAsJSON(CONFIG.SHEETS.USERS).find(u => u.id === userId);
    if (user) {
      sendEmail(user.mail, `Notifica: Richiesta Parcheggio Modificata`,
        `Ciao ${user.firstName},\n\nTi informiamo che un amministratore ha modificato una tua richiesta di parcheggio:\n\nData Originale: ${formatDate(oldDate)}\nNuova Data: ${formatDate(newDate)}\n\nBuona giornata!`
      );
    }
  } catch (e) {
    logToClient(`Errore invio email modifica admin: ${e.message}`, "ERROR");
  }
}

function clearHistoryForDate(date) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.ASSIGNMENT_HISTORY);
  const data = sheet.getDataRange().getValues();
  const targetDateStr = formatDate(date);
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][1] && formatDate(data[i][1]) === targetDateStr) sheet.deleteRow(i + 1);
  }
}