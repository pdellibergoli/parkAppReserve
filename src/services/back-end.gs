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
    TEMPORARY_AVAILABILITY: "TemporaryAvailability"
  },
  BASE_URL: "https://park-app-reserve.vercel.app/",
  EMAIL: {
    FROM_NAME: "Park app",
    REPLY_TO: "noreply@park-app.com"
  },
  TOKEN_EXPIRY: 3600000, // 1 ora in millisecondi
  ASSIGNMENT_HOUR: 19 // Ora di assegnazione automatica
};

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
  try {
    const data = parseRequestData(e);
    const result = routeAction(data.action, data.payload);
    return createJsonResponse({ status: 'success', data: result });
  } catch (error) {
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
    
    // Gestione utenti
    'updateUserProfile': () => updateUserProfile(payload),
    
    // Gestione parcheggi
    'addParkingSpace': () => addParkingSpace(payload),
    'deleteParkingSpace': () => deleteParkingSpace(payload),
    'updateParkingSpaceFixedStatus': () => updateParkingSpaceFixedStatus(payload),
    
    // Gestione richieste
    'getRequests': () => getRequestsForUser(payload),
    'createNewRequest': () => createNewRequest(payload),
    'createBatchRequests': () => createBatchRequests(payload),
    'cancelRequest': () => cancelRequest(payload),
    'cancelMultipleRequests': () => cancelMultipleRequests(payload),
    'updateRequestDate': () => updateRequestDate(payload),
    'cancelAssignmentAndReassign': () => cancelAssignmentAndReassign(payload),
    
    // Disponibilità temporanee
    'addTemporaryAvailability': () => addTemporaryAvailability(payload),
    'getTemporaryAvailabilities': () => getTemporaryAvailabilities(payload),
    'removeTemporaryAvailability': () => removeTemporaryAvailability(payload)
  };

  const handler = routes[action];
  if (!handler) throw new Error("Azione non valida: " + action);
  return handler();
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// =================================================================
// UTILITY FUNCTIONS
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
  
  if (colIndex === -1) throw new Error(`Colonna '${columnName}' non trovata`);
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex] === value) {
      return { row: i + 1, data: data[i], headers };
    }
  }
  return null;
}

function updateCell(sheet, rowIndex, columnName, value, headers) {
  const colIndex = headers.indexOf(columnName);
  if (colIndex === -1) throw new Error(`Colonna '${columnName}' non trovata`);
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

function updateParkingSpaceFixedStatus(payload) {
  const { spaceId, isFixed } = payload;
  if (!spaceId) throw new Error("ID del parcheggio non fornito.");
  
  const result = findRowByColumn(CONFIG.SHEETS.PARKING_SPACES, 'id', spaceId);
  if (!result) throw new Error("Parcheggio non trovato.");
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.PARKING_SPACES);
  updateCell(sheet, result.row, 'isFixed', isFixed, result.headers);
  
  return { spaceId, isFixed };
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

function updateRequestDate(payload) {
  const { requestId, newDate } = payload;
  if (!requestId || !newDate) {
    throw new Error("Dati insufficienti per aggiornare la richiesta.");
  }

  const result = findRowByColumn(CONFIG.SHEETS.REQUESTS, 'requestId', requestId);
  if (!result) throw new Error("Richiesta da aggiornare non trovata.");
  
  const status = result.data[result.headers.indexOf('status')];
  const requestDate = normalizeDate(result.data[result.headers.indexOf('requestedDate')]);
  const userId = result.data[result.headers.indexOf('userId')];
  const today = normalizeDate(new Date());

  if (status !== 'pending') {
    throw new Error("Puoi modificare solo le richieste in attesa.");
  }
  
  if (requestDate < today) {
    throw new Error("Non puoi modificare una richiesta passata.");
  }

  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const targetDate = normalizeDate(newDate);
  const hasExistingRequest = allRequests.some(req =>
    req.userId === userId &&
    req.requestId !== requestId &&
    normalizeDate(req.requestedDate).getTime() === targetDate.getTime()
  );

  if (hasExistingRequest) {
    throw new Error("Hai già un'altra richiesta per la nuova data selezionata.");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  updateCell(sheet, result.row, 'requestedDate', targetDate, result.headers);
  
  return { message: "Richiesta aggiornata con successo." };
}

function createBatchRequests(payload) {
  const { userId, dates } = payload;
  if (!userId || !dates || !Array.isArray(dates) || dates.length === 0) {
    throw new Error("ID utente e un array di date sono obbligatori.");
  }

  const requestsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const userRequests = allRequests.filter(req => req.userId === userId);

  const validDates = dates
    .map(dateStr => normalizeDate(dateStr))
    .filter(date => isWeekday(date))
    .filter(date => {
      const dateString = date.toDateString();
      const hasExisting = userRequests.some(req => 
        normalizeDate(req.requestedDate).toDateString() === dateString
      );
      if (hasExisting) {
        throw new Error(`Hai già una richiesta esistente per il giorno ${formatDate(date)}.`);
      }
      return true;
    });

  if (validDates.length === 0) {
    throw new Error("Nessun giorno lavorativo valido selezionato.");
  }

  // Rimuovi duplicati
  const uniqueDates = validDates.filter((date, index, self) =>
    index === self.findIndex(d => d.getTime() === date.getTime())
  );

  const createdRequestIds = [];
  uniqueDates.forEach(date => {
    const requestId = "req_" + Utilities.getUuid();
    requestsSheet.appendRow([requestId, userId, date, 'pending', '', '']);
    createdRequestIds.push({ requestId, date });
  });

  // Assegnazione istantanea se dopo le 19:00 per oggi
  handleInstantAssignmentForToday(createdRequestIds, userId);

  return { message: `Sono state create con successo ${uniqueDates.length} richieste.` };
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

function cancelMultipleRequests(payload) {
  const { requestIds } = payload;
  if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
    throw new Error("Nessun ID di richiesta fornito.");
  }

  const uniqueRequestIds = [...new Set(requestIds)];
  let processedCount = 0;
  let errors = [];

  uniqueRequestIds.forEach(reqId => {
    try {
      const result = findRowByColumn(CONFIG.SHEETS.REQUESTS, 'requestId', reqId);
      if (!result) return;

      const status = result.data[result.headers.indexOf('status')];
      const requestDate = normalizeDate(result.data[result.headers.indexOf('requestedDate')]);
      const today = normalizeDate(new Date());

      if (requestDate < today) return;

      if (status === 'pending') {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
        sheet.deleteRow(result.row);
        processedCount++;
      } else if (status === 'assigned') {
        cancelAssignmentAndReassign({ requestId: reqId });
        processedCount++;
      }
    } catch (e) {
      errors.push(`Errore processando ${reqId}: ${e.message}`);
    }
  });

  if (processedCount === 0 && errors.length === 0) {
    throw new Error("Nessuna delle richieste selezionate poteva essere processata.");
  }

  let message = `${processedCount} richieste sono state processate con successo.`;
  if (errors.length > 0) {
    message += ` Errori: ${errors.join(', ')}`;
  }

  return { message };
}

// =================================================================
// PROCESSO DI ASSEGNAZIONE
// =================================================================

function processPendingRequests() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowNorm = normalizeDate(tomorrow);

  const allRequests = getSheetAsJSON(CONFIG.SHEETS.REQUESTS);
  const pendingForTomorrow = allRequests.filter(req =>
    req.status === 'pending' && 
    normalizeDate(req.requestedDate).getTime() === tomorrowNorm.getTime()
  );

  if (pendingForTomorrow.length === 0) {
    Logger.log("Nessuna richiesta in attesa per domani.");
    return;
  }

  const availableSpaces = getAvailableSpacesForDate(tomorrowNorm);

  if (availableSpaces.length === 0) {
    pendingForTomorrow.forEach(request => {
      updateRequestStatus(request.requestId, 'not_assigned');
      sendFailureEmail(request.userId, request.requestedDate);
    });
    Logger.log("Nessun parcheggio disponibile. Tutte le richieste respinte.");
    return;
  }

  if (pendingForTomorrow.length <= availableSpaces.length) {
    // Caso normale: non registrare nello storico
    Logger.log("Caso normale: assegnazione senza storico.");
    pendingForTomorrow.forEach((request, index) => {
      assignParking(request, availableSpaces[index], false);
    });
  } else {
    // Overbooking: registra nello storico
    Logger.log("Caso overbooking: registrazione nello storico.");
    const requestsWithPriority = calculatePriority(pendingForTomorrow);
    
    for (let i = 0; i < availableSpaces.length; i++) {
      assignParking(requestsWithPriority[i], availableSpaces[i], true);
    }

    for (let i = availableSpaces.length; i < requestsWithPriority.length; i++) {
      updateRequestStatus(requestsWithPriority[i].requestId, 'not_assigned');
      sendFailureEmail(requestsWithPriority[i].userId, requestsWithPriority[i].requestedDate);
    }
  }
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

function calculatePriority(requests) {
  const history = getSheetAsJSON(CONFIG.SHEETS.ASSIGNMENT_HISTORY);
  
  return requests
    .map(request => ({
      ...request,
      priority: history.filter(h => h.userId === request.userId).length
    }))
    .sort((a, b) => a.priority - b.priority || Math.random() - 0.5);
}

function assignParking(request, space, recordInHistory = true) {
  updateRequestStatus(request.requestId, 'assigned', space.id, space.number);

  if (recordInHistory) {
    const historySheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.SHEETS.ASSIGNMENT_HISTORY);
    historySheet.appendRow([request.userId, request.requestedDate, space.id]);
  }

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
 * Annulla un'assegnazione esistente, tenta di riassegnare il posto
 * e pulisce lo storico della data se l'overbooking viene risolto.
 */
function cancelAssignmentAndReassign(payload) {
  const { requestId } = payload;
  if (!requestId) throw new Error("ID della richiesta non fornito.");

  // Trova la richiesta da annullare
  const result = findRowByColumn(CONFIG.SHEETS.REQUESTS, 'requestId', requestId);
  if (!result) throw new Error("Richiesta non trovata.");
  
  const requestToCancel = {};
  result.headers.forEach((header, index) => requestToCancel[header] = result.data[index]);

  // Controlli preliminari
  if (requestToCancel.status !== 'assigned') throw new Error("Puoi annullare solo un parcheggio assegnato.");
  const requestDate = normalizeDate(requestToCancel.requestedDate);
  const today = normalizeDate(new Date());
  if (requestDate < today) throw new Error("Non puoi annullare un'assegnazione passata.");

  const cancelledSpaceId = requestToCancel.assignedParkingSpaceId;
  const cancelledSpaceNumber = requestToCancel.assignedParkingSpaceNumber;
  const cancellingUserId = requestToCancel.userId;

  // 1. Rimuovi dallo storico l'utente che annulla (SEMPRE)
  removeFromHistory(cancellingUserId, requestDate);

  // 2. Aggiorna lo stato della richiesta annullata
  const requestsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.REQUESTS);
  updateCell(requestsSheet, result.row, 'status', 'cancelled_by_user', result.headers);
  updateCell(requestsSheet, result.row, 'assignedParkingSpaceId', '', result.headers);
  updateCell(requestsSheet, result.row, 'assignedParkingSpaceNumber', '', result.headers);
  
  // 3. Tenta la riassegnazione
  let reassigned = false;
  const newRecipient = findBestCandidate(requestDate); // Trova il miglior candidato tra 'not_assigned' o 'pending'
  
  if (newRecipient) {
    // Calcola se c'era overbooking *prima* della riassegnazione (ma dopo la cancellazione)
    // per decidere se registrare la *nuova* assegnazione
    const isOverbookingBeforeReassign = checkOverbookingForDate(requestDate); 
    
    assignParking(
      newRecipient, 
      { id: cancelledSpaceId, number: cancelledSpaceNumber }, 
      isOverbookingBeforeReassign // Registra solo se c'era ancora overbooking
    );
    reassigned = true;
    Logger.log(`Riassegnazione per ${requestDate.toDateString()}: Posto ${cancelledSpaceNumber} assegnato a ${newRecipient.userId}. Registrato nello storico: ${isOverbookingBeforeReassign}`);
  }

  // 4. RIVALUTA LO STATO FINALE e pulisci lo storico se l'overbooking è risolto
  // Rileggi le richieste AGGIORNATE per la data
  const finalRequestsOnDate = getSheetAsJSON(CONFIG.SHEETS.REQUESTS).filter(r => 
      normalizeDate(r.requestedDate).toDateString() === requestDate.toDateString()
  );
  const finalAssignedCount = finalRequestsOnDate.filter(r => r.status === 'assigned').length;
  
  // Ricalcola i posti totali disponibili per essere sicuri
  const allSpaces = getSheetAsJSON(CONFIG.SHEETS.PARKING_SPACES);
  const fixedSpaces = allSpaces.filter(space => space.isFixed === true);
  const tempAvail = getSheetAsJSON(CONFIG.SHEETS.TEMPORARY_AVAILABILITY).filter(avail => normalizeDate(avail.availableDate).toDateString() === requestDate.toDateString());
  const tempSpacesDetails = tempAvail.map(avail => allSpaces.find(space => space.id === avail.parkingSpaceId)).filter(Boolean);
  const totalAvailableSpacesCount = [...fixedSpaces, ...tempSpacesDetails].length; // Conteggio totale posti

  Logger.log(`Stato finale per ${requestDate.toDateString()}: Assegnati=${finalAssignedCount}, Posti totali=${totalAvailableSpacesCount}`);

  // Se il numero finale di assegnati è <= ai posti totali, pulisci lo storico per quella data
  if (finalAssignedCount <= totalAvailableSpacesCount) {
      Logger.log("Overbooking risolto per la data. Pulizia dello storico...");
      clearHistoryForDate(requestDate);
  } else {
       Logger.log("Overbooking persiste per la data. Lo storico rimane.");
  }

  return { message: "La tua assegnazione è stata annullata" + (reassigned ? " e il posto è stato riassegnato." : ".") };
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
  const dateString = normalizeDate(date).toDateString();
  
  const activeRequests = allRequests.filter(r =>
    normalizeDate(r.requestedDate).toDateString() === dateString &&
    (r.status === 'pending' || r.status === 'assigned')
  );

  const availableSpaces = getAvailableSpacesForDate(date);
  
  return activeRequests.length > availableSpaces.length;
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

  // Controlla se l'aggiunta risolve l'overbooking
  const isOverbooking = checkOverbookingForDate(targetDate);
  
  if (!isOverbooking) {
    Logger.log("L'aggiunta del posto ha risolto l'overbooking. Pulizia dello storico.");
    clearHistoryForDate(targetDate);
  }

  // Riassegnazione immediata se dopo le 19:00 e per domani
  handleInstantReassignment(spaceId, targetDate, isOverbooking);

  return { availabilityId: newId, parkingSpaceId: spaceId, availableDate: targetDate };
}

function clearHistoryForDate(date) {
  const historySheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.SHEETS.ASSIGNMENT_HISTORY);
  const data = historySheet.getDataRange().getValues();
  const dateString = normalizeDate(date).toDateString();
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (normalizeDate(data[i][1]).toDateString() === dateString) {
      historySheet.deleteRow(i + 1);
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

  const result = findRowByColumn(CONFIG.SHEETS.TEMPORARY_AVAILABILITY, 'id', availabilityId);
  if (!result) throw new Error("Disponibilità non trovata.");
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.SHEETS.TEMPORARY_AVAILABILITY);
  sheet.deleteRow(result.row);
  
  return { message: "Disponibilità rimossa con successo." };
}