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
  ASSIGNMENT_HOUR: 19, // Ora di assegnazione automatica
  LOG_LEVEL: "DEBUG"
};

// =================================================================
// GESTIONE LOGGING
// =================================================================
let clientLogs = [];

function logToClient(message, level = "DEBUG") {
  if (level === "DEBUG" && CONFIG.LOG_LEVEL !== "DEBUG") {
    return;
  }
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
  if (!e?.postData?.contents) {
    throw new Error("Richiesta non valida o dati mancanti.");
  }
  const data = JSON.parse(e.postData.contents);
  if (!data.action) throw new Error("Azione non specificata.");
  return data;
}

function createJsonResponse(data) {
  const responseData = { ...data, logs: clientLogs };
  return ContentService.createTextOutput(JSON.stringify(responseData))
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
    
    // Disponibilità temporanee
    'addTemporaryAvailability': () => addTemporaryAvailability(payload),
    'getTemporaryAvailabilities': () => getTemporaryAvailabilities(payload),
    'removeTemporaryAvailability': () => removeTemporaryAvailability(payload),
    'getParkingStatusForDate': () => getParkingStatusForDate(payload),

    // Azioni Admin
    'adminCancelAllRequestsForDate': () => adminCancelAllRequestsForDate(payload),
    'adminResetAssignmentsForDate': () => adminResetAssignmentsForDate(payload),
    'adminManuallyAssignForDate': () => adminManuallyAssignForDate(payload),
    'sendAdminCommunication': () => sendAdminCommunication(payload),
    'getActiveCommunication': () => getActiveCommunication(),
    'deleteCommunication': () => deleteCommunication(payload)
  };

  const handler = routes[action];
  if (!handler) throw new Error("Azione non valida: " + action);
  return handler();
}


// =================================================================
// UTILITY FUNCTIONS (Invariate)
// =================================================================
function hashPassword(password, salt) {
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, 
    password + salt
  );
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
    headers.forEach((header, index) => {
      if (header) obj[header] = row[index];
    });
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
    if (data[i][colIndex] == value) {
      return { row: i + 1, data: data[i], headers };
    }
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

function getDynamicWindowSize() {
  /*const allSpaces = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES);
  const tempAvail = getSheetAsJSON(CONFIG.SHEETS.TEMPORARY_AVAILABILITY);
  
  const today = normalizeDate(new Date());

  const spacesWithFutureAvailability = new Set(
    tempAvail
      .filter(avail => normalizeDate(avail.availableDate).getTime() >= today.getTime())
      .map(avail => avail.parkingSpaceId)
  );

  const activeSpaces = allSpaces.filter(space => 
    space.isFixed === true || spacesWithFutureAvailability.has(space.id)
  );

  const totalCapacity = activeSpaces.length;
  if (totalCapacity === 0) return 30;*/

  let days = 30;
  // < 2 posti: Finestra BREVE (7 gg) -> Alta rotazione
  // 2 - 3 posti: Finestra MEDIA (15 gg)
  // > 3 posti: Finestra LUNGA (30 gg) -> Bassa rotazione
  
  /*if (totalCapacity < 2) {
    days = 30;
  } else if (totalCapacity <= 3) {
    days = 15;
  } else {
    days = 30;
  }*/
  
  //logToClient(`Finestra dinamica: ${totalCapacity} posti -> ${days} giorni (ATTIVI).`);
  return days;
}

function getStartDateFromActiveDays(history, daysCount) {
  const uniqueDatesSet = new Set();
  history.forEach(h => {
    uniqueDatesSet.add(normalizeDate(h.assignmentDate).getTime());
  });
  
  const sortedUniqueDates = Array.from(uniqueDatesSet).sort((a, b) => b - a);
  
  logToClient(`Trovati ${sortedUniqueDates.length} giorni attivi nello storico.`);
  
  // L'indice target è daysCount - 1.
  // Esempio: Vogliamo 14 giorni. Indice 13.
  const targetIndex = Math.max(0, daysCount - 1);

  if (sortedUniqueDates.length === 0) {
    return new Date(new Date().getTime() - (targetIndex * 86400000));
  }

  const actualIndex = Math.min(targetIndex, sortedUniqueDates.length - 1);
  const startDateTimestamp = sortedUniqueDates[actualIndex];
  
  return new Date(startDateTimestamp);
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

  const inputHash = hashPassword(password, user.salt);
  if (inputHash !== user.password) throw new Error("Email o password non corretta.");
  
  delete user.password;
  delete user.salt;
  return user;
}

function signupUser(payload) {
  const { firstName, lastName, mail, password } = payload;
  if (!firstName || !mail || !password) {
    throw new Error("Nome, email e password sono obbligatori.");
  }
  
  const usersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.USERS);
  const users = getSheetAsJSON(CONFIG.SHEETS.USERS);
  
  if (users.some(u => u.mail === mail)) {
    throw new Error("Un utente con questa email esiste già.");
  }

  const salt = Utilities.getUuid();
  const hashedPassword = hashPassword(password, salt);
  const newId = "user_" + new Date().getTime();
  const verificationToken = Utilities.getUuid();

  usersSheet.appendRow([
    newId, firstName, lastName, mail, hashedPassword, salt, "", 
    false, verificationToken, "", ""
  ]);

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
  const verifiedCol = result.headers.indexOf('isVerified');
  
  if (result.data[verifiedCol] === true) {
    throw new Error("Questo account è già stato verificato.");
  }

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
  
  const expiryCol = result.headers.indexOf('resetTokenExpiry');
  const tokenExpiry = new Date(result.data[expiryCol]).getTime();
  
  if (new Date().getTime() >= tokenExpiry) {
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

/**
 * Aggiorna il profilo utente
 */
function updateUserProfile(payload) {
  // Aggiungi primaryColor ai dati estratti
  const { id, firstName, lastName, mail: payloadMail, avatarColor, password, preferredTheme, primaryColor } = payload; 
  if (!id) throw new Error("ID utente non fornito per l'aggiornamento.");

  const result = findRowByColumn(CONFIG.SHEETS.USERS, 'id', id);
  if (!result) throw new Error("Utente non trovato per l'aggiornamento.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.USERS);

  // Applica gli aggiornamenti
  if (firstName !== undefined) updateCell(sheet, result.row, 'firstName', firstName, result.headers);
  if (lastName !== undefined) updateCell(sheet, result.row, 'lastName', lastName, result.headers);
  if (payloadMail !== undefined) updateCell(sheet, result.row, 'mail', payloadMail, result.headers); 
  if (avatarColor !== undefined) updateCell(sheet, result.row, 'avatarColor', avatarColor, result.headers);
  if (preferredTheme !== undefined) updateCell(sheet, result.row, 'preferredTheme', preferredTheme, result.headers);
  if (primaryColor !== undefined) updateCell(sheet, result.row, 'primaryColor', primaryColor, result.headers); // AGGIUNGI QUESTO

  if (password) {
    const newSalt = Utilities.getUuid();
    const hashedPassword = hashPassword(password, newSalt);
    updateCell(sheet, result.row, 'password', hashedPassword, result.headers);
    updateCell(sheet, result.row, 'salt', newSalt, result.headers);
  }

  const updatedRowData = sheet.getRange(result.row, 1, 1, result.headers.length).getValues()[0];
  const userEmail = updatedRowData[result.headers.indexOf('mail')]; 
  const userFirstName = updatedRowData[result.headers.indexOf('firstName')]; 

  const updatedUser = getSheetAsJSON(CONFIG.SHEETS.USERS).find(u => u.id === id);
  if (updatedUser) { 
      delete updatedUser.password;
      delete updatedUser.salt;
  }

  // Non inviamo email per cambio tema o colore primario

  return updatedUser || {}; 
}

/**
 * Recupera tutti gli utenti e calcola il loro tasso di successo (priorità)
 */
function getUsersWithPriority() {
  const allUsers = getSheetAsJSON(CONFIG.SHEETS.USERS);
  const history = getSheetAsJSON(CONFIG.SHEETS.ASSIGNMENT_HISTORY);
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  
  const today = normalizeDate(new Date());
  const tomorrow = new Date(today.getTime() + 86400000);
  
  const lookBackDays = getDynamicWindowSize(); 
  logToClient(`lookBackDays ${lookBackDays}`)
  // --- CALCOLO DATA INIZIO BASATO SU GIORNI ATTIVI ---
  // Passiamo l'intero storico per trovare i giorni effettivamente utilizzati
  const windowStartDate = getStartDateFromActiveDays(history, lookBackDays);
  // ---------------------------------------------------
  
  logToClient(`getUsersWithPriority: Finestra inizia il ${formatDate(windowStartDate)} (${lookBackDays} giorni attivi).`);
  
  const recentHistory = history.filter(h => { const d = normalizeDate(h.assignmentDate); return d >= windowStartDate && d <= tomorrow; });
  const recentReqs = allRequests.filter(r => { const d = normalizeDate(r.requestedDate); return d >= windowStartDate && d <= tomorrow && (r.status === 'assigned' || r.status === 'not_assigned'); });
  
  return allUsers.map(u => {
    const userId = u.id;
    const userAssigns = recentHistory.filter(h => h.userId === userId).length;
    const userReqs = recentReqs.filter(r => r.userId === userId).length;
    u.successRate = userReqs > 0 ? userAssigns / userReqs : 0.0;
    
    u.windowDays = lookBackDays; // Per la UI
    u.recentAssignments = userAssigns;
    u.recentRequests = userReqs;

    delete u.password; delete u.salt; delete u.verificationToken; delete u.resetToken; delete u.resetTokenExpiry;
    return u;
  });
}

// =================================================================
// GESTIONE PARCHEGGI
// =================================================================

function addParkingSpace(payload) {
  const { number } = payload;
  if (!number || number.trim() === "") {
    throw new Error("Il nome/numero del parcheggio è obbligatorio.");
  }
  
  const spacesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.PARKING_SPACES);
  const newId = "space_" + new Date().getTime();
  spacesSheet.appendRow([newId, number.trim(), false]);
  
  return { id: newId, number: number.trim(), isFixed: false };
}

function deleteParkingSpace(payload) {
  const { spaceId } = payload;
  if (!spaceId) throw new Error("ID del parcheggio non fornito per l'eliminazione.");

  const today = normalizeDate(new Date());

  // Rimuovi disponibilità temporanee future
  removeTemporaryAvailabilitiesForSpace(spaceId, today);
  
  // Annulla assegnazioni future
  cancelFutureAssignmentsForSpace(spaceId, today);
  
  // Elimina il parcheggio
  const result = findRowByColumn(CONFIG.SHEETS.PARKING_SPACES, 'id', spaceId);
  if (!result) throw new Error("Parcheggio non trovato.");
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.PARKING_SPACES);
  sheet.deleteRow(result.row);
  
  return { 
    deletedSpaceId: spaceId, 
    message: "Parcheggio rimosso. Le assegnazioni future sono state annullate ma lo storico è stato preservato." 
  };
}

function removeTemporaryAvailabilitiesForSpace(spaceId, fromDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.TEMPORARY_AVAILABILITY);
  const data = sheet.getDataRange().getValues();
  
  for (let i = data.length - 1; i >= 1; i--) {
    const currentSpaceId = data[i][1];
    const availDate = normalizeDate(data[i][2]);
    if (currentSpaceId === spaceId && availDate >= fromDate) {
      sheet.deleteRow(i + 1);
    }
  }
}

function cancelFutureAssignmentsForSpace(spaceId, fromDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = data.length - 1; i >= 1; i--) {
    const currentSpaceId = data[i][headers.indexOf('assignedParkingSpaceId')];
    const requestStatus = data[i][headers.indexOf('status')];
    const requestDate = normalizeDate(data[i][headers.indexOf('requestedDate')]);

    if (currentSpaceId === spaceId && requestStatus === 'assigned' && requestDate >= fromDate) {
      updateCell(sheet, i + 1, 'status', 'not_assigned', headers);
      updateCell(sheet, i + 1, 'assignedParkingSpaceId', '', headers);
      updateCell(sheet, i + 1, 'assignedParkingSpaceNumber', '', headers);
    }
  }
}

function sendRequestCreatedEmail(userId, dates, actorId) {
  try {
    const users = getSheetAsJSON(CONFIG.SHEETS.USERS);
    const user = users.find(u => u.id === userId);
    const actor = users.find(u => u.id === actorId); // Chi ha fatto l'azione
    
    if (user && actor) {
      const formattedDates = dates.map(d => formatDate(d)).join(', ');
      logToClient(`Invio email creazione richiesta a ${user.mail}`);
      sendEmail(
        user.mail,
        "Nuova Richiesta Parcheggio Inserita",
        `Ciao ${user.firstName},\n\nL'amministratore ${actor.firstName} ${actor.lastName} ha inserito delle richieste di parcheggio a tuo nome per le seguenti date:\n\n${formattedDates}\n\nRiceverai una conferma quando il posto verrà assegnato.\n\nBuona giornata!`
      );
    }
  } catch (e) {
    logToClient(`Errore invio email creazione richiesta: ${e.message}`, "ERROR");
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

/**
 * Restituisce lo stato dei parcheggi per una data specifica:
 * - Totale posti (Fissi + Temporanei)
 * - Posti assegnati
 * - Posti disponibili
 */
function getParkingStatusForDate(payload) {
  const { date } = payload;
  if (!date) throw new Error("Data non fornita.");

  const targetDate = normalizeDate(date);
  const dateString = targetDate.toDateString();

  const allSpaces = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES);
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);

  // 1. Conta Posti Fissi
  const fixedSpacesCount = allSpaces.filter(space => space.isFixed === true).length;

  // 2. Conta Posti Temporanei per la data
  const tempAvail = getSheetAsJSON(CONFIG.SHEETS.TEMPORARY_AVAILABILITY)
    .filter(avail => normalizeDate(avail.availableDate).toDateString() === dateString);
  // Usa Set per evitare duplicati
  const tempSpaceIds = new Set(tempAvail.map(avail => avail.parkingSpaceId));
  const tempSpacesCount = tempSpaceIds.size;

  const totalSpaces = fixedSpacesCount + tempSpacesCount;

  // 3. Conta Assegnazioni confermate per la data
  const assignedCount = allRequests.filter(req => 
    normalizeDate(req.requestedDate).toDateString() === dateString &&
    req.status === 'assigned'
  ).length;

  const availableSpaces = Math.max(0, totalSpaces - assignedCount);

  return {
    total: totalSpaces,
    assigned: assignedCount,
    available: availableSpaces
  };
}

// =================================================================
// GESTIONE RICHIESTE
// =================================================================

function createNewRequest(payload) {
  const { userId, date } = payload;
  if (!userId || !date) throw new Error("ID utente e data sono obbligatori.");

  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const targetDate = normalizeDate(date);

  const existingRequest = allRequests.some(req =>
    req.userId === userId && 
    normalizeDate(req.requestedDate).getTime() === targetDate.getTime()
  );

  if (existingRequest) {
    throw new Error("Hai già inviato una richiesta per questa data.");
  }

  const requestId = "req_" + Utilities.getUuid();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  sheet.appendRow([requestId, userId, targetDate, 'pending', '', '']);

  return { 
    message: "La tua richiesta è stata inviata con successo! Riceverai un'email con l'esito dopo le " + ASSIGNMENT_HOUR + ":00 del giorno richiesto." 
  };
}

function getRequestsForUser(payload) {
  const { userId } = payload;
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  
  if (!userId) return allRequests;
  return allRequests.filter(req => req.userId === userId);
}

/**
 * Invia un'email di notifica all'utente quando un ADMIN cancella la sua richiesta.
 */
function sendAdminCancellationEmail(userId, date) {
  try {
    const users = getSheetAsJSON(CONFIG.SHEETS.USERS);
    const user = users.find(u => u.id === userId);
    
    if (user) {
      const formattedDate = formatDate(date);
      logToClient(`Invio email di cancellazione (Admin) a ${user.mail} per il ${formattedDate}`);
      sendEmail(
        user.mail,
        `Notifica: Richiesta Parcheggio Cancellata - ${formattedDate}`,
        `Ciao ${user.firstName},\n\nTi informiamo che la tua richiesta di parcheggio per il giorno ${formattedDate} è stata cancellata da un amministratore.\n\nBuona giornata!`
      );
    }
  } catch (e) {
    logToClient(`Errore invio email (AdminCancel) a ${userId}: ${e.message}`, "ERROR");
  }
}

/**
 * Invia un'email di notifica all'utente quando un ADMIN modifica la sua richiesta.
 */
function sendAdminModificationEmail(userId, oldDate, newDate) {
  try {
    const users = getSheetAsJSON(CONFIG.SHEETS.USERS);
    const user = users.find(u => u.id === userId);
    
    if (user) {
      const formattedOldDate = formatDate(oldDate);
      const formattedNewDate = formatDate(newDate);
      logToClient(`Invio email di modifica (Admin) a ${user.mail}`);
      sendEmail(
        user.mail,
        `Notifica: Richiesta Parcheggio Modificata`,
        `Ciao ${user.firstName},\n\nTi informiamo che un amministratore ha modificato una tua richiesta di parcheggio:\n\nData Originale: ${formattedOldDate}\nNuova Data: ${formattedNewDate}\n\nBuona giornata!`
      );
    }
  } catch (e) {
    logToClient(`Errore invio email (AdminModify) a ${userId}: ${e.message}`, "ERROR");
  }
}

function cancelRequest(payload) {
  const { requestId } = payload;
  if (!requestId) throw new Error("ID della richiesta non fornito.");

  const result = findRowByColumn(CONFIG.SHEETS.REQUESTS, 'requestId', requestId);
  if (!result) throw new Error("Richiesta non trovata.");
  
  const status = result.data[result.headers.indexOf('status')];
  if (status !== 'pending') {
    throw new Error("Non è possibile cancellare una richiesta che è già stata processata.");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  sheet.deleteRow(result.row);
  
  return { message: "Richiesta cancellata con successo." };
}

/**
 * Aggiorna la data di una richiesta.
 * Accetta un 'actorId' per notificare l'utente se la modifica è fatta da un admin.
 */
function updateRequestDate(payload) {
  const { requestId, newDate, actorId } = payload; // Accetta actorId
  if (!requestId || !newDate) {
    throw new Error("Dati insufficienti per aggiornare la richiesta.");
  }

  const result = findRowByColumn(CONFIG.SHEETS.REQUESTS, 'requestId', requestId);
  if (!result) throw new Error("Richiesta da aggiornare non trovata.");
  
  const status = result.data[result.headers.indexOf('status')];
  const oldRequestDate = normalizeDate(result.data[result.headers.indexOf('requestedDate')]);
  const userId = result.data[result.headers.indexOf('userId')]; // Proprietario della richiesta
  const today = normalizeDate(new Date());

  if (status !== 'pending') {
    throw new Error("Puoi modificare solo le richieste in attesa.");
  }
  
  if (oldRequestDate < today && formatDate(oldRequestDate) !== formatDate(today)) {
    throw new Error("Non puoi modificare una richiesta passata.");
  }

  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const targetDate = normalizeDate(newDate);

  if (targetDate < today) {
    throw new Error("Non puoi spostare una richiesta a una data passata.");
  }
  
  const hasExistingRequest = allRequests.some(req =>
    req.userId === userId &&
    req.requestId !== requestId &&
    normalizeDate(req.requestedDate).getTime() === targetDate.getTime() &&
    req.status !== 'cancelled_by_user'
  );

  if (hasExistingRequest) {
    throw new Error("L'utente ha già un'altra richiesta attiva per la nuova data selezionata.");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  updateCell(sheet, result.row, 'requestedDate', targetDate, result.headers);
  
  logToClient(`Richiesta ${requestId} spostata al ${formatDate(targetDate)}.`);
  
  // Se l'azione è stata fatta da un admin
  if (actorId && actorId !== userId) {
    sendAdminModificationEmail(userId, oldRequestDate, targetDate);
  }

  return { message: "Richiesta aggiornata con successo." };
}

function createBatchRequests(payload) {
  const { userId, dates, actorId } = payload; // Aggiunto actorId
  if (!userId || !dates || !Array.isArray(dates) || dates.length === 0) {
    throw new Error("Dati mancanti.");
  }

  const requestsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const userRequests = allRequests.filter(req => req.userId === userId);

  const createdRequestIds = [];
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
    createdRequestIds.push({ requestId, date: targetDate });
  });

  if (createdRequestIds.length === 0 && skippedDates.length > 0) {
    throw new Error(`Nessuna richiesta creata.`);
  }

  if (actorId && actorId !== userId && createdRequestIds.length > 0) {
      const datesList = createdRequestIds.map(r => r.date);
      sendRequestCreatedEmail(userId, datesList, actorId);
  }

  handleInstantAssignmentForToday(createdRequestIds, userId);

  return { message: `Create ${createdRequestIds.length} richieste.` };
}

function handleInstantAssignmentForToday(createdRequests, userId) {
  const now = new Date();
  if (now.getHours() < CONFIG.ASSIGNMENT_HOUR) return;

  const today = normalizeDate(new Date());
  const requestsForToday = createdRequests.filter(req => 
    normalizeDate(req.date).getTime() === today.getTime()
  );

  if (requestsForToday.length === 0) return;

  const freeSpaces = getAvailableSpacesForDate(today);
  if (freeSpaces.length > 0) {
    const requestToAssign = requestsForToday[0];
    const spaceToAssign = freeSpaces[0];
    assignParking(
      { requestId: requestToAssign.requestId, userId: userId, requestedDate: requestToAssign.date }, 
      spaceToAssign
    );
  }
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

  if (requestDate.getTime() !== today.getTime()) {
    throw new Error("Questo link di cessione è valido solo per il giorno stesso.");
  }
  
  if (request.status === 'assigned') {
    throw new Error("Questa richiesta ha già un parcheggio assegnato.");
  }

  if (request.status === 'cancelled_by_user') {
    throw new Error("Questa richiesta è stata annullata dall'utente.");
  }

  // 1. Trova il parcheggio del donatore
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const dateString = requestDate.toDateString();
  
  const donorRequest = allRequests.find(r => 
      r.userId === donorUserId &&
      normalizeDate(r.requestedDate).toDateString() === dateString &&
      r.status === 'assigned'
  );
  
  if (!donorRequest) {
    throw new Error("Non è stato trovato un parcheggio assegnato al donatore per oggi.");
  }

  // --- MODIFICA: Controllo se il posto è ancora valido ---
  const allSpaces = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES);
  const spaceId = donorRequest.assignedParkingSpaceId;
  const spaceObj = allSpaces.find(s => s.id === spaceId);
  
  // Verifica disponibilità temporanea (nel caso fosse un posto disattivato ma reso disponibile oggi)
  const tempAvail = getSheetAsJSON(CONFIG.SHEETS.TEMPORARY_AVAILABILITY)
    .some(avail => avail.parkingSpaceId === spaceId && normalizeDate(avail.availableDate).toDateString() === dateString);

  // Il posto è valido se esiste nel DB E (è attivo/fisso OPPURE ha una disponibilità temporanea oggi)
  const isValidSpace = spaceObj && (spaceObj.isFixed === true || tempAvail === true);

  if (!isValidSpace) {
    throw new Error("Il parcheggio che si sta tentando di cedere non è più disponibile o è stato disattivato dall'amministratore.");
  }
  // --- FINE MODIFICA ---

  // 2. Annulla l'assegnazione del donatore
  logToClient(`Trovato donatore. Annullamento sua assegnazione (ID: ${donorRequest.requestId}).`);
  const donorResult = findRowByColumn(CONFIG.SHEETS.REQUESTS, 'requestId', donorRequest.requestId);
  
  const requestsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  updateCell(requestsSheet, donorResult.row, 'status', 'cancelled_by_user', donorResult.headers);
  updateCell(requestsSheet, donorResult.row, 'assignedParkingSpaceId', '', donorResult.headers);
  updateCell(requestsSheet, donorResult.row, 'assignedParkingSpaceNumber', '', donorResult.headers);
  
  // 3. Rimuovi il donatore dallo storico
  removeFromHistory(donorUserId, requestDate);

  // 4. Assegna il posto liberato al ricevente
  const freedSpace = { 
    id: donorRequest.assignedParkingSpaceId, 
    number: donorRequest.assignedParkingSpaceNumber 
  };
  
  logToClient(`Assegnazione del posto ${freedSpace.number} alla richiesta ${requestId}.`);
  
  const isOverbooking = checkOverbookingForDate(requestDate);
  assignParking(request, freedSpace, isOverbooking);

  // 5. Pulisci lo storico se necessario
  if (!checkOverbookingForDate(requestDate)) {
    logToClient("Overbooking risolto dopo la cessione. Pulizia storico.");
    clearHistoryForDate(requestDate);
  }

  // 6. Invia email
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

/**
 * Cancella o annulla un elenco di richieste.
 * Accetta un 'actorId' per notificare gli utenti se la modifica è fatta da un admin.
 */
function cancelMultipleRequests(payload) {
  const { requestIds, actorId } = payload;
  
  if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
    throw new Error("Nessun ID di richiesta fornito.");
  }

  const uniqueRequestIds = [...new Set(requestIds)];
  let processedCount = 0;
  let errors = [];
  const requestsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  
  uniqueRequestIds.forEach(reqId => {
    try {
      // Ricarichiamo la riga ogni volta per evitare errori di indice se ne cancelliamo diverse
      const result = findRowByColumn(CONFIG.SHEETS.REQUESTS, 'requestId', reqId);
      
      if (!result) {
        logToClient(`Richiesta ${reqId} non trovata, saltata.`);
        return; 
      }

      const status = result.data[result.headers.indexOf('status')];
      const requestDate = normalizeDate(result.data[result.headers.indexOf('requestedDate')]);
      const userId = result.data[result.headers.indexOf('userId')];
      const today = normalizeDate(new Date());

      if (requestDate < today) {
          logToClient(`Richiesta ${reqId} è passata (${formatDate(requestDate)}), non può essere elaborata.`);
          return;
      }
      
      if (status === 'cancelled_by_user') {
          logToClient(`Richiesta ${reqId} è già cancellata, saltata.`);
          return;
      }

      const notifyUser = actorId && actorId !== userId;

      if (status === 'pending') {
        if (notifyUser) sendAdminCancellationEmail(userId, requestDate);
        requestsSheet.deleteRow(result.row); // Cancella fisicamente la riga
        logToClient(`Richiesta ${reqId} (stato: pending) eliminata.`);
        processedCount++;
      } else if (status === 'not_assigned') {
        if (notifyUser) sendAdminCancellationEmail(userId, requestDate);
        updateCell(requestsSheet, result.row, 'status', 'cancelled_by_user', result.headers);
        logToClient(`Richiesta ${reqId} (stato: not_assigned) aggiornata a cancelled_by_user.`);
        processedCount++;
      } else if (status === 'assigned') {
        if (notifyUser) sendAdminCancellationEmail(userId, requestDate);
        
        // Per le assegnate, annulla l'assegnazione e prova a riassegnare il posto
        cancelAssignmentAndReassign({ requestId: reqId, actorId: actorId });
        logToClient(`Assegnazione per richiesta ${reqId} annullata (tramite cancelAssignmentAndReassign).`);
        processedCount++;
      } else {
        logToClient(`Richiesta ${reqId} con stato ${status} non gestita per la cancellazione multipla.`);
      }

    } catch (e) {
      const errorMsg = `Errore processando ${reqId}: ${e.message}`;
      logToClient(errorMsg); 
      errors.push(errorMsg);
    }
  });

  // --- MODIFICA FONDAMENTALE: FORZA IL SALVATAGGIO ---
  SpreadsheetApp.flush(); 
  // --------------------------------------------------

  if (processedCount === 0 && errors.length === 0 && uniqueRequestIds.length > 0) {
     throw new Error("Nessuna delle richieste selezionate poteva essere processata (potrebbero essere passate o già annullate).");
  }

  let message = `${processedCount} richieste/assegnazioni sono state processate con successo.`;
  if (errors.length > 0) {
    message += ` Errori riscontrati: ${errors.join('; ')}`;
  }

  return { message };
}

// =================================================================
// PROCESSO DI ASSEGNAZIONE
// =================================================================

/**
 * Funzione triggerata dal timer (es. alle 19:00) per assegnare i posti per DOMANI.
 */
function processPendingRequests() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowNorm = normalizeDate(tomorrow);
  
  logToClient(`AVVIO ASSEGNAZIONE AUTOMATICA (Trigger) per ${formatDate(tomorrowNorm)}`, "INFO");
  processRequestsForDate(tomorrowNorm); // Chiama la funzione riutilizzabile
}

/**
 * --- NUOVA FUNZIONE RIUTILIZZABILE ---
 * Esegue la logica di assegnazione per una data specifica.
 * Questa funzione è ora il motore principale dell'assegnazione.
 * (Presa da una conversazione precedente)
 */
function processRequestsForDate(targetDate) {
  const targetDateNorm = normalizeDate(targetDate);
  logToClient(`ProcessRequestsForDate: Inizio per ${formatDate(targetDateNorm)}`);

  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  
  // 1. Trova le richieste 'pending' per la data target
  const pendingRequests = allRequests.filter(req =>
    req.status === 'pending' && 
    normalizeDate(req.requestedDate).getTime() === targetDateNorm.getTime()
  );

  if (pendingRequests.length === 0) {
    logToClient(`ProcessRequestsForDate: Nessuna richiesta 'pending' trovata per ${formatDate(targetDateNorm)}.`);
    return { assigned: 0, failed: 0 };
  }
  logToClient(`ProcessRequestsForDate: Trovate ${pendingRequests.length} richieste 'pending'.`);

  // 2. Trova i parcheggi disponibili per quella data
  const availableSpaces = getAvailableSpacesForDate(targetDateNorm);
  logToClient(`ProcessRequestsForDate: Trovati ${availableSpaces.length} parcheggi disponibili.`);

  let assignedCount = 0;
  let failedCount = 0;

  // 3. Caso: NESSUN posto disponibile
  if (availableSpaces.length === 0) {
    logToClient(`ProcessRequestsForDate: Nessun posto disponibile. Tutte le ${pendingRequests.length} richieste impostate a 'not_assigned'.`);
    pendingRequests.forEach(request => {
      updateRequestStatus(request.requestId, 'not_assigned');
      sendFailureEmail(request.userId, request.requestedDate);
      failedCount++;
    });
    return { assigned: assignedCount, failed: failedCount };
  }

  // 4. Determina se siamo in overbooking
  const isOverbooking = pendingRequests.length > availableSpaces.length;
  logToClient(`ProcessRequestsForDate: Overbooking? ${isOverbooking} (Richieste: ${pendingRequests.length}, Posti: ${availableSpaces.length})`);

  // 5. Applica la logica di priorità
  // (Usa la funzione calculatePriority già definita - es. Tasso di Successo)
  const requestsToProcess = calculatePriority(pendingRequests); 
  
  // 6. Assegna i posti
  for (let i = 0; i < requestsToProcess.length; i++) {
    const request = requestsToProcess[i];
    
    if (i < availableSpaces.length) {
      // C'è un posto per questa richiesta
      const space = availableSpaces[i];
      assignParking(request, space, isOverbooking);
      assignedCount++;
    } else {
      // Posti esauriti, questa richiesta fallisce
      updateRequestStatus(request.requestId, 'not_assigned');
      sendFailureEmail(request.userId, request.requestedDate);
      failedCount++;
    }
  }
  
  logToClient(`ProcessRequestsForDate: Completato. Assegnati: ${assignedCount}, Non Assegnati: ${failedCount}.`);
  return { assigned: assignedCount, failed: failedCount };
}

function getAvailableSpacesForDate(date) {
  const allSpaces = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES);
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const dateNorm = normalizeDate(date);
  const dateString = dateNorm.toDateString();

  // Posti fissi
  const fixedSpaces = allSpaces.filter(space => space.isFixed === true);

  // Disponibilità temporanee per la data
  const tempAvail = getSheetAsJSON(CONFIG.SHEETS.TEMPORARY_AVAILABILITY)
    .filter(avail => normalizeDate(avail.availableDate).toDateString() === dateString);
  
  const tempSpaces = tempAvail
    .map(avail => allSpaces.find(space => space.id === avail.parkingSpaceId))
    .filter(Boolean);

  // Tutti i posti potenzialmente disponibili
  const allPotentialSpaces = [...fixedSpaces, ...tempSpaces];

  // Rimuovi quelli già assegnati
  const assignedSpaceIds = allRequests
    .filter(req => 
      req.status === 'assigned' && 
      normalizeDate(req.requestedDate).toDateString() === dateString
    )
    .map(req => req.assignedParkingSpaceId);

  return allPotentialSpaces.filter(space => !assignedSpaceIds.includes(space.id));
}

/**
 * Calcola la priorità basandosi sul TASSO DI SUCCESSO degli ultimi 30 giorni.
 * Chi ha un tasso di successo più basso (più rifiuti) ha priorità più alta.
 */
function calculatePriority(requests) {
  const history = getSheetAsJSON(CONFIG.SHEETS.ASSIGNMENT_HISTORY);
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS); 
  const today = normalizeDate(new Date());
  
  const lookBackDays = getDynamicWindowSize();

  // --- CALCOLO DATA INIZIO BASATO SU GIORNI ATTIVI ---
  const windowStartDate = getStartDateFromActiveDays(history, lookBackDays);
  // ---------------------------------------------------
  
  const recentHistory = history.filter(h => normalizeDate(h.assignmentDate) >= windowStartDate);
  const recentReqs = allRequests.filter(r => { const d = normalizeDate(r.requestedDate); return d >= windowStartDate && d <= today && (r.status === 'assigned' || r.status === 'not_assigned'); });
  
  return requests.map(request => {
    const userId = request.userId;
    const userAssigns = recentHistory.filter(h => h.userId === userId).length;
    const userReqs = recentReqs.filter(r => r.userId === userId).length;
    const successRate = userReqs > 0 ? userAssigns / userReqs : 0.0;
    return { ...request, priority: successRate };
  }).sort((a, b) => a.priority - b.priority || Math.random() - 0.5);
}

function assignParking(request, space, recordInHistory) {
  updateRequestStatus(request.requestId, 'assigned', space.id, space.number);

  //if (recordInHistory) {
    const historySheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.SHEETS.ASSIGNMENT_HISTORY);
    historySheet.appendRow([request.userId, request.requestedDate, space.id]);
  //}

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
  const users = getSheetAsJSON(CONFIG.SHEETS.USERS);
  const user = users.find(u => u.id === userId);
  
  if (user) {
    const formattedDate = formatDate(date);
    sendEmail(
      user.mail,
      "Conferma Assegnazione Parcheggio",
      `Ciao ${user.firstName},\n\nLa tua richiesta di parcheggio per il giorno ${formattedDate} è stata approvata!\n\nTi è stato assegnato il posto: ${spaceNumber}\n\nBuona giornata!`
    );
  }
}

function sendFailureEmail(userId, date) {
  const users = getSheetAsJSON(CONFIG.SHEETS.USERS);
  const user = users.find(u => u.id === userId);
  
  if (user) {
    const formattedDate = formatDate(date);
    sendEmail(
      user.mail,
      "Esito Richiesta Parcheggio",
      `Ciao ${user.firstName},\n\nSiamo spiacenti, ma a causa dell'elevato numero di richieste, non è stato possibile assegnarti un parcheggio per il giorno ${formattedDate}.\n\nCi scusiamo per il disagio.`
    );
  }
}

// =================================================================
// GESTIONE ASSEGNAZIONI E CANCELLAZIONI
// =================================================================

/**
 * Annulla un'assegnazione, riassegna E gestisce l'actorId.
 */
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

  logToClient(`Annullamento assegnazione per ${cancellingUserId} (Req: ${requestId}) in data ${formatDate(requestDate)}`);

  // 1. Rimuovi dallo storico l'utente che annulla
  removeFromHistory(cancellingUserId, requestDate);

  // 2. Aggiorna lo stato della richiesta annullata
  const requestsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  updateCell(requestsSheet, result.row, 'status', 'cancelled_by_user', result.headers);
  updateCell(requestsSheet, result.row, 'assignedParkingSpaceId', '', result.headers);
  updateCell(requestsSheet, result.row, 'assignedParkingSpaceNumber', '', result.headers);
  
  // --- MODIFICA: Controllo più robusto ---
  const allSpaces = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES);
  
  // Trova il posto specifico
  const spaceObj = allSpaces.find(s => s.id === cancelledSpaceId);
  
  // Verifica anche le disponibilità temporanee per quel giorno (se il posto fosse fisso ma condiviso)
  const dateString = requestDate.toDateString();
  const tempAvail = getSheetAsJSON(CONFIG.SHEETS.TEMPORARY_AVAILABILITY)
    .some(avail => avail.parkingSpaceId === cancelledSpaceId && normalizeDate(avail.availableDate).toDateString() === dateString);

  // Un posto è "riassegnabile" se:
  // 1. Esiste nel DB
  // 2. E (NON è fisso OPPURE è fisso ma è stato reso temporaneamente disponibile per oggi)
  const isReassignable = spaceObj && (spaceObj.isFixed === true || tempAvail === true);
  
  let reassigned = false;
  
  if (isReassignable) {
    // 3. Tenta la riassegnazione
    const newRecipient = findBestCandidate(requestDate); 
    
    if (newRecipient) {
      const isOverbookingBeforeReassign = checkOverbookingForDate(requestDate); 
      
      logToClient(`Riassegnazione posto ${cancelledSpaceNumber} a ${newRecipient.userId}. Overbooking: ${isOverbookingBeforeReassign}`);
      assignParking(
        newRecipient, 
        { id: cancelledSpaceId, number: cancelledSpaceNumber }, 
        isOverbookingBeforeReassign
      );
      reassigned = true;
    } else {
       logToClient(`Posto ${cancelledSpaceNumber} liberato, ma nessun candidato in attesa.`);
    }
  } else {
    logToClient(`Il posto ${cancelledSpaceNumber} non è riassegnabile automaticamente (È fisso o rimosso).`);
  }
  // --- FINE MODIFICA ---

  // 4. RIVALUTA LO STATO FINALE
  /*const finalIsOverbooking = checkOverbookingForDate(requestDate);
  logToClient(`Stato finale per ${formatDate(requestDate)}: Overbooking? ${finalIsOverbooking}`);

  if (!finalIsOverbooking) {
      logToClient("Overbooking risolto per la data. Pulizia dello storico...");
      clearHistoryForDate(requestDate);
  }*/

  let message = "La tua assegnazione è stata annullata";
  if (reassigned) {
    message += " e il posto è stato riassegnato.";
  } else if (!spaceObj) {
    message += ". Il posto è stato rimosso dal sistema.";
  } else if (!isReassignable) {
    message += ". Il posto è ora riservato (fisso), quindi non è stato riassegnato.";
  } else {
    message += ".";
  }

  return { message };
}

function removeFromHistory(userId, date) {
  const historySheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.SHEETS.ASSIGNMENT_HISTORY);
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
  const allSpaces = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES); // Prendiamo tutti i parcheggi
  const dateString = normalizeDate(date).toDateString();

  // Conta TUTTE le richieste per quel giorno che NON sono state cancellate dall'utente
  const relevantRequestsCount = allRequests.filter(r =>
    normalizeDate(r.requestedDate).toDateString() === dateString &&
    r.status !== 'cancelled_by_user' // Includi pending, assigned, not_assigned
  ).length;

  // Calcola il numero TOTALE di posti potenzialmente disponibili per quel giorno (non solo quelli liberi ora)
  const fixedSpaces = allSpaces.filter(space => space.isFixed === true);
  const tempAvail = getSheetAsJSON(CONFIG.SHEETS.TEMPORARY_AVAILABILITY)
    .filter(avail => normalizeDate(avail.availableDate).toDateString() === dateString);
  // Usiamo un Set per contare gli ID unici dei posti temporanei (evita doppi conteggi se aggiunto più volte per errore)
  const tempSpaceIds = new Set(tempAvail.map(avail => avail.parkingSpaceId));
  const totalPotentialSpacesCount = fixedSpaces.length + tempSpaceIds.size; // Somma fissi + temporanei unici

  logToClient(`checkOverbookingForDate (Total Logic) per ${dateString}: Richieste Rilevanti=${relevantRequestsCount}, Posti Totali Potenziali=${totalPotentialSpacesCount}`);

  // Overbooking si verifica se il numero totale di richieste valide supera il numero totale di posti disponibili
  return relevantRequestsCount > totalPotentialSpacesCount;
}

function findBestCandidate(date) {
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const dateString = normalizeDate(date).toDateString();
  
  const candidates = allRequests.filter(r =>
    normalizeDate(r.requestedDate).toDateString() === dateString &&
    (r.status === 'not_assigned' || r.status === 'pending')
  );

  if (candidates.length === 0) return null;

  const candidatesWithPriority = calculatePriority(candidates);
  return candidatesWithPriority[0];
}

// =================================================================
// GESTIONE DISPONIBILITÀ TEMPORANEE
// =================================================================

function addTemporaryAvailability(payload) {
  const { spaceId, date } = payload;
  if (!spaceId || !date) throw new Error("ID del parcheggio e data sono obbligatori.");

  const targetDate = normalizeDate(date);
  const availSheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.SHEETS.TEMPORARY_AVAILABILITY);
  
  const newId = "avail_" + Utilities.getUuid();
  availSheet.appendRow([newId, spaceId, targetDate]);

  // Controlla se l'aggiunta risolve l'overbooking (logica invariata)
  const isOverbooking = checkOverbookingForDate(targetDate);

  /*logToClient(`isOverbooking: ${isOverbooking}`);
  
  if (!isOverbooking) {
    Logger.log("L'aggiunta del posto ha risolto l'overbooking. Pulizia dello storico.");
    clearHistoryForDate(targetDate);
  }*/

  // --- INIZIO NUOVA LOGICA PER ASSEGNAZIONE GIORNO STESSO ---
  const today = normalizeDate(new Date());
  if (targetDate.getTime() === today.getTime()) {
    Logger.log("Disponibilità aggiunta per oggi. Tentativo di assegnazione immediata.");
    
    // Cerchiamo il miglior candidato per oggi
    const candidate = findBestCandidate(targetDate); // Cerca 'not_assigned' o 'pending' per oggi
    
    if (candidate) {
      logToClient(`Trovato candidato ${candidate.userId} per il posto.`);
      Logger.log(`Trovato candidato ${candidate.userId} per il posto.`);
      const allSpaces = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES);
      const spaceDetails = allSpaces.find(s => s.id === spaceId);
      
      if (spaceDetails) {
        // Assegna il parcheggio. Registra nello storico solo se c'era overbooking *prima* di questa assegnazione.
        assignParking(candidate, spaceDetails, isOverbooking);
      }
    } else {
      Logger.log("Nessun candidato 'not_assigned' o 'pending' trovato per oggi.");
    }
  }
  // --- FINE NUOVA LOGICA ---

  // Riassegnazione immediata se dopo le 19:00 e per domani (logica invariata)
  handleInstantReassignment(spaceId, targetDate, isOverbooking);

  return { availabilityId: newId, parkingSpaceId: spaceId, availableDate: targetDate };
}

// --- FUNZIONE DI PULIZIA STORICO AGGIORNATA (Più robusta) ---
function clearHistoryForDate(date) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.ASSIGNMENT_HISTORY);
  const data = sheet.getDataRange().getValues();
  const targetDateStr = formatDate(date); // Uso confronto stringa dd/MM/yyyy
  
  for(let i=data.length-1; i>=1; i--) {
    // Colonna 1 è assignmentDate (indice 1)
    const rowDate = data[i][1];
    if (rowDate && formatDate(rowDate) === targetDateStr) {
        sheet.deleteRow(i+1);
    }
  }
}

function handleInstantReassignment(spaceId, targetDate, isOverbooking) {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowNorm = normalizeDate(tomorrow);

  if (now.getHours() < CONFIG.ASSIGNMENT_HOUR) return;
  if (normalizeDate(targetDate).getTime() !== tomorrowNorm.getTime()) return;

  Logger.log("Tentativo riassegnazione immediata post-orario per domani.");
  
  const candidate = findBestCandidate(targetDate);
  if (!candidate) return;

  const allSpaces = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES);
  const spaceDetails = allSpaces.find(s => s.id === spaceId);
  
  if (spaceDetails) {
    assignParking(candidate, spaceDetails, isOverbooking);
  }
}

function getTemporaryAvailabilities(payload) {
  const { spaceId } = payload;
  if (!spaceId) throw new Error("ID del parcheggio non fornito.");

  const allAvailabilities = getSheetAsJSON(CONFIG.SHEETS.TEMPORARY_AVAILABILITY);
  const today = normalizeDate(new Date());

  return allAvailabilities
    .filter(avail => 
      avail.parkingSpaceId === spaceId && 
      normalizeDate(avail.availableDate) >= today
    )
    .sort((a, b) => normalizeDate(a.availableDate) - normalizeDate(b.availableDate));
}

function removeTemporaryAvailability(payload) {
  const { availabilityId } = payload;
  if (!availabilityId) throw new Error("ID della disponibilità non fornito.");

  const result = findRowByColumn(CONFIG.SHEETS.TEMPORARY_AVAILABILITY, 'availabilityId', availabilityId);
  if (!result) throw new Error("Disponibilità non trovata.");

  // Estrai i dati PRIMA di cancellare la riga
  const spaceIdToRemove = result.data[result.headers.indexOf('parkingSpaceId')];
  const targetDate = normalizeDate(result.data[result.headers.indexOf('availableDate')]);
  const dateString = targetDate.toDateString();

  // 1. Cancella la riga della disponibilità
  const sheetAvail = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.SHEETS.TEMPORARY_AVAILABILITY);
  sheetAvail.deleteRow(result.row);
  Logger.log(`Disponibilità ${availabilityId} per ${spaceIdToRemove} il ${dateString} rimossa.`);

  //Annulla assegnazione collegata ---
  const requestsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  const requestsData = requestsSheet.getDataRange().getValues();
  const requestsHeaders = requestsData[0];
  let cancelledAssignment = false;

  // Cerca tra tutte le richieste se qualcuna aveva QUESTO posto assegnato in QUELLA data
  for (let i = requestsData.length - 1; i >= 1; i--) {
    const request = {};
    requestsHeaders.forEach((header, index) => request[header] = requestsData[i][index]);

    const requestDate = normalizeDate(request.requestedDate);

    if (request.status === 'assigned' &&
        request.assignedParkingSpaceId === spaceIdToRemove &&
        requestDate.toDateString() === dateString) {

      Logger.log(`Trovata richiesta ${request.requestId} assegnata al posto ${spaceIdToRemove} rimosso. Annullamento in corso...`);

      // Annulla l'assegnazione
      updateCell(requestsSheet, i + 1, 'status', 'not_assigned', requestsHeaders); // Torna a not_assigned
      updateCell(requestsSheet, i + 1, 'assignedParkingSpaceId', '', requestsHeaders);
      updateCell(requestsSheet, i + 1, 'assignedParkingSpaceNumber', '', requestsHeaders);

      // Rimuovi l'utente dallo storico per questa data specifica
      removeFromHistory(request.userId, targetDate);
      cancelledAssignment = true;
      Logger.log(`Assegnazione per ${request.userId} annullata e rimosso dallo storico per ${dateString}.`);
      break; // Trovata e annullata, possiamo uscire dal ciclo
    }
  }

  // Se abbiamo annullato un'assegnazione, rivalutiamo l'overbooking
  // (Anche se rimuovere un posto di solito CAUSA overbooking, lo facciamo per coerenza)
  if (cancelledAssignment) {
    const isOverbookingNow = checkOverbookingForDate(targetDate);
    if (!isOverbookingNow) {
        Logger.log(`La rimozione della disponibilità e l'annullamento hanno risolto l'overbooking per ${dateString}. Pulizia storico (se necessario).`);
        clearHistoryForDate(targetDate); // Pulisce lo storico SOLO se ora non c'è più overbooking
    } else {
        Logger.log(`Overbooking persiste per ${dateString} dopo la rimozione della disponibilità.`);
    }
  }

  return { message: "Disponibilità rimossa con successo." + (cancelledAssignment ? " L'assegnazione collegata è stata annullata." : "") };
}

// ===================================================
// --- FUNZIONI ADMIN PER MODALE CALENDARIO ---
// ===================================================

/**
 * AZIONE ADMIN: Cancella TUTTE le richieste (pending, not_assigned, assigned) per un giorno.
 * Se ci sono assegnazioni, pulisce anche lo storico per garantire coerenza.
 */
function adminCancelAllRequestsForDate(payload) {
  const { date } = payload;
  if (!date) throw new Error("Data non fornita.");
  
  // Usiamo la stringa formattata per confronto sicuro
  const targetDateStr = formatDate(date); 
  const targetDateObj = normalizeDate(date);
  
  logToClient(`ADMIN ACTION: Cancellazione TOTALE richieste per ${targetDateStr}`, "INFO");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  const data = sheet.getDataRange().getValues();
  
  const headers = data[0].map(h => String(h).trim());
  const dateColIdx = headers.indexOf('requestedDate');
  const statusColIdx = headers.indexOf('status');
  const userColIdx = headers.indexOf('userId');

  let deletedCount = 0;
  const usersToNotify = {}; 

  // Iteriamo al contrario per cancellare senza sfasare gli indici
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const rowDateRaw = row[dateColIdx];
    
    if (!rowDateRaw) continue;
    
    const rowDateStr = formatDate(rowDateRaw);
    
    if (rowDateStr === targetDateStr) {
        const status = String(row[statusColIdx] || '').trim();
        
        const userId = row[userColIdx];
        usersToNotify[userId] = true;
        sheet.deleteRow(i + 1);
        deletedCount++;
    }
  }
  
  // --- PULIZIA STORICO ---
  // Cancelliamo lo storico per questa data (necessario se abbiamo cancellato delle assigned)
  if (deletedCount > 0) {
      clearHistoryForDate(targetDateObj);
  }
  
  SpreadsheetApp.flush();

  // Notifiche
  Object.keys(usersToNotify).forEach(userId => {
    sendAdminCancellationEmail(userId, targetDateObj);
  });
  
  logToClient(`ADMIN ACTION: Eliminate ${deletedCount} richieste per ${targetDateStr}.`);
  return { message: `Sono state eliminate ${deletedCount} richieste per il ${targetDateStr} e lo storico è stato aggiornato.` };
}

/**
 * AZIONE ADMIN: Resetta tutte le assegnazioni E i rifiuti (le porta in 'pending')
 * e cancella lo storico per quel giorno.
 */
function adminResetAssignmentsForDate(payload) {
  const { date } = payload;
  if (!date) throw new Error("Data non fornita.");
  
  // Usiamo la stringa formattata per un confronto sicuro (es. "11/12/2025")
  const targetDateStr = formatDate(date);
  logToClient(`ADMIN ACTION: Reset completo (assegnati/non assegnati) per ${targetDateStr}`, "INFO");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  const data = sheet.getDataRange().getValues();
  
  // Puliamo gli header per sicurezza
  const headers = data[0].map(h => String(h).trim());
  
  const dateColIdx = headers.indexOf('requestedDate');
  const statusColIdx = headers.indexOf('status');
  const userColIdx = headers.indexOf('userId');
  const assignedIdColIdx = headers.indexOf('assignedParkingSpaceId');
  const assignedNumColIdx = headers.indexOf('assignedParkingSpaceNumber');

  if (dateColIdx === -1 || statusColIdx === -1) {
     throw new Error("Colonne necessarie non trovate nel foglio Requests.");
  }

  let resetCount = 0;
  const usersToNotify = {}; // Solo chi aveva il posto
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowDateRaw = row[dateColIdx];
    const statusRaw = String(row[statusColIdx] || '').trim();
    
    // Se la data è vuota, salta
    if (!rowDateRaw) continue;

    // Converti la data della riga in stringa "dd/MM/yyyy"
    const rowDateStr = formatDate(rowDateRaw);
    
    // Confronto stringa vs stringa (Molto più robusto)
    if (rowDateStr === targetDateStr) {
      logToClient(`row[userColIdx]: ${row[userColIdx]} - statusRaw: ${statusRaw}`);
      // --- MODIFICA CRUCIALE: Includiamo anche 'not_assigned' ---
      if (statusRaw === 'assigned' || statusRaw === 'not_assigned') {
        const userId = row[userColIdx];
        
        // Notifica solo chi aveva il posto (gli viene tolto)
        // Chi era 'not_assigned' torna in gara senza notifiche (per non creare confusione)
        if (statusRaw === 'assigned') {
           usersToNotify[userId] = true; 
        }
        
        // Resetta i campi
        sheet.getRange(i + 1, statusColIdx + 1).setValue('pending');
        sheet.getRange(i + 1, assignedIdColIdx + 1).setValue('');
        sheet.getRange(i + 1, assignedNumColIdx + 1).setValue('');
        
        resetCount++;
      }
    }
  }
  
  if (resetCount > 0) {
    logToClient(`ADMIN ACTION: ${resetCount} richieste resettate a 'pending'. Pulizia storico...`);
    
    // Per pulire lo storico serve l'oggetto data, usiamo normalizeDate
    const targetDateObj = normalizeDate(date);
    clearHistoryForDate(targetDateObj); 

    // Invia email solo a chi ha perso l'assegnazione
    Object.keys(usersToNotify).forEach(userId => {
      sendAdminCancellationEmail(userId, date); 
    });
  } else {
    logToClient(`ADMIN ACTION: Nessuna richiesta processata (assigned/not_assigned) trovata per il reset!`);
  }

  // Fondamentale per salvare le modifiche immediatamente
  SpreadsheetApp.flush(); 

  return { message: `${resetCount} richieste (assegnate o non) sono state resettate allo stato 'In attesa' per il ${targetDateStr}.` };
}

/**
 * AZIONE ADMIN: Resetta tutte le assegnazioni (le porta in 'pending')
 * e cancella lo storico per quel giorno.
 */
function adminResetAssignmentsForDate(payload) {
  const { date } = payload;
  if (!date) throw new Error("Data non fornita.");
  
  const targetDate = normalizeDate(date);
  const dateString = targetDate.toDateString();
  logToClient(`ADMIN ACTION: Reset assegnazioni per ${dateString}`, "INFO");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  let resetCount = 0;
  const usersToNotify = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const requestDate = normalizeDate(row[headers.indexOf('requestedDate')]);
    const status = row[headers.indexOf('status')];
    
    if (requestDate.toDateString() === dateString && (status === 'assigned' || status === 'not_assigned')) {
      const userId = row[headers.indexOf('userId')];
      usersToNotify[userId] = true; // Segna l'utente per la notifica
      
      updateCell(sheet, i + 1, 'status', 'pending', headers);
      updateCell(sheet, i + 1, 'assignedParkingSpaceId', '', headers);
      updateCell(sheet, i + 1, 'assignedParkingSpaceNumber', '', headers);
      resetCount++;
    }
  }
  
  if (resetCount > 0) {
    logToClient(`ADMIN ACTION: ${resetCount} richieste resettate a 'pending'. Pulizia storico...`);
    clearHistoryForDate(targetDate); // Pulisce TUTTO lo storico per quel giorno

    // Invia email agli utenti la cui assegnazione è stata resettata
    Object.keys(usersToNotify).forEach(userId => {
      // Potremmo creare un'email apposita "sendAdminResetEmail", ma per ora usiamo quella di cancellazione
      sendAdminCancellationEmail(userId, targetDate); 
    });

  } else {
    logToClient(`ADMIN ACTION: Nessuna richiesta 'assigned' trovata per il reset.`);
  }

  return { message: `${resetCount} assegnazioni sono state resettate allo stato 'In attesa' per il ${formatDate(targetDate)}.` };
}

/**
 * AZIONE ADMIN: Fa partire manualmente l'assegnazione per un giorno specifico.
 */
function adminManuallyAssignForDate(payload) {
  const { date } = payload;
  if (!date) throw new Error("Data non fornita.");
  
  const targetDate = normalizeDate(date);
  logToClient(`ADMIN ACTION: Avvio assegnazione manuale per ${formatDate(targetDate)}`, "INFO");

  // Chiama la funzione di assegnazione riutilizzabile
  const result = processRequestsForDate(targetDate);
  
  return { 
    message: `Processo di assegnazione manuale completato per il ${formatDate(targetDate)}. 
Risultati: ${result.assigned} assegnati, ${result.failed} non assegnati.` 
  };
}

/**
 * Invia una comunicazione a TUTTI gli utenti e opzionalmente salva un banner.
 */
function sendAdminCommunication(payload) {
  const { message, isPersistent, startDate, endDate } = payload;
  
  if (!message) throw new Error("Il messaggio non può essere vuoto.");
  if (isPersistent && (!startDate || !endDate)) throw new Error("Data inizio e fine obbligatorie per messaggi persistenti.");

  // 1. Invia email a TUTTI gli utenti
  const allUsers = getSheetAsJSON(CONFIG.SHEETS.USERS);
  let emailCount = 0;
  
  // Utilizziamo un ciclo semplice. Per grandi numeri, considerare BCC o quote.
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
  
  logToClient(`Email inviata a ${emailCount} utenti.`);

  // 2. Se persistente, salva nel database
  if (isPersistent) {
    const commSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.COMMUNICATIONS);
    const id = "comm_" + new Date().getTime();
    
    commSheet.appendRow([
      id, 
      message, 
      true, 
      normalizeDate(startDate), 
      normalizeDate(endDate), 
      new Date()
    ]);
    logToClient(`Comunicazione persistente salvata.`);
  }

  return { message: `Comunicazione inviata a ${emailCount} utenti.` };
}

/**
 * Recupera TUTTI i messaggi attivi per OGGI da mostrare in Home.
 */
function getActiveCommunication() {
  const commSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.COMMUNICATIONS);
  if (!commSheet) return []; // Ritorna array vuoto
  
  const data = commSheet.getDataRange().getValues();
  if (data.length < 2) return []; 
  
  const headers = data.shift();
  const today = normalizeDate(new Date()).getTime();
  
  const activeMessages = []; // Array per accumulare i messaggi

  // Scorriamo al contrario per avere i più recenti per primi
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    const isPersistent = row[headers.indexOf('isPersistent')];
    
    if (isPersistent === true) {
      const startDate = normalizeDate(row[headers.indexOf('startDate')]).getTime();
      const endDate = normalizeDate(row[headers.indexOf('endDate')]).getTime();
      
      if (today >= startDate && today <= endDate) {
        // Invece di ritornare, aggiungiamo all'array
        activeMessages.push({
          message: row[headers.indexOf('message')],
          id: row[headers.indexOf('id')]
        });
      }
    }
  }
  
  return activeMessages; // Restituisce l'array completo
}

/**
 * AZIONE ADMIN: Cancella una comunicazione specifica.
 */
function deleteCommunication(payload) {
  const { id } = payload;
  if (!id) throw new Error("ID comunicazione mancante.");
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.COMMUNICATIONS);
  const result = findRowByColumn(CONFIG.SHEETS.COMMUNICATIONS, 'id', id);
  
  if (!result) throw new Error("Comunicazione non trovata.");
  
  sheet.deleteRow(result.row);
  logToClient(`Comunicazione ${id} eliminata.`);
  
  return { message: "Comunicazione cancellata con successo." };
}