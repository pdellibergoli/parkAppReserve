// src/services/api.js

const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

if (!SCRIPT_URL) {
  // Se la variabile non è definita, blocchiamo l'app con un errore chiaro.
  throw new Error("La variabile d'ambiente VITE_GOOGLE_SCRIPT_URL non è stata impostata o è vuota.");
}

export const callApi = async (action, payload = {}) => {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action, payload }),
    });

    const result = await response.json();

    // --- NUOVO: Stampa i log ricevuti dal backend ---
    if (result.logs && Array.isArray(result.logs)) {
      console.groupCollapsed(`[API Response Logs for ${action}]`); // Raggruppa i log per chiarezza
      result.logs.forEach(logMsg => console.debug(logMsg)); // Usa console.debug o console.log
      console.groupEnd();
    }
    // --- FINE NUOVO ---

    if (result.status === 'error') {
      // Logghiamo l'errore anche qui se presente nei log inviati
      console.error(`Errore API (${action}): ${result.message}`);
      throw new Error(result.message);
    }

    return result.data; // Restituisci solo i dati effettivi come prima

  } catch (error) {
    // --- MODIFICA: Non rilanciare l'errore se è già stato gestito sopra ---
    // Se l'errore viene dal nostro blocco 'if (result.status === 'error')',
    // è già stato loggato. Altrimenti, gestisci errori di rete o JSON non valido.
    if (!error.message.startsWith('Errore API')) {
         console.error(`ERRORE FETCH/JSON API per '${action}':`, error);
         // Blocco diagnostico per risposta grezza (invariato)
        try {
          const rawResponse = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action, payload }),
          });
          const responseText = await rawResponse.text();
          console.log('--- INIZIO RISPOSTA GREZZA DAL SERVER GOOGLE ---');
          console.log(responseText);
          console.log('--- FINE RISPOSTA GREZZA DAL SERVER GOOGLE ---');
        } catch (e) {
          console.error("Impossibile anche recuperare la risposta come testo.", e);
        }
        // Rilancia solo errori non gestiti dal backend
        throw error;
    }
    // Se l'errore era già loggato dal backend, non lo rilanciamo per evitare duplicati
     // ma potremmo voler restituire qualcosa o gestire diversamente
     // A seconda di come il tuo frontend gestisce gli errori API
     throw error; // Rilanciamo comunque per ora, ma potresti voler cambiare qui
  }
};