// src/services/api.js

// IMPORTANTE: Sostituisci questa URL con quella della TUA applicazione web Google Apps Script!
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCpm_k3mW7UnrNs1kf28UXOZvDx4XfCBH0DFctLauA3AsNXqyJp0AjRVLBy3pDRvI/exec";

/**
 * Funzione generica per chiamare la nostra API su Google Apps Script.
 * @param {string} action L'azione da eseguire (es. 'login', 'getBookings').
 * @param {object} payload I dati da inviare.
 * @returns {Promise<any>} La risposta dal server.
 */
export const callApi = async (action, payload = {}) => {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Apps Script richiede questo header specifico
      },
      body: JSON.stringify({ action, payload }),
      // Aggiungi mode: 'no-cors' se incontri problemi di CORS, ma gestisce gli errori in modo diverso
    });

    // Apps Script avvolge la risposta, quindi dobbiamo analizzarla
    const result = await response.json();

    if (result.status === 'error') {
      throw new Error(result.message);
    }
    
    return result.data;

  } catch (error) {
    console.error(`Errore durante la chiamata API per l'azione '${action}':`, error);
    // Rilancia l'errore per poterlo gestire nel componente che ha chiamato l'API
    throw error;
  }
};