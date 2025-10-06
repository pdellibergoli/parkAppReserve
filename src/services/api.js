import dotenv from 'dotenv';

dotenv.config();
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

    // Tentiamo di leggere la risposta come JSON
    const result = await response.json();

    if (result.status === 'error') {
      throw new Error(result.message);
    }
    
    return result.data;

  } catch (error) {
    // --- BLOCCO DIAGNOSTICO ---
    // Se il "catch" viene attivato, significa che response.json() è fallito.
    // Questo è il momento perfetto per leggere la risposta come testo e vedere cosa contiene.
    
    console.error(`ERRORE DURANTE LA CHIAMATA API per l'azione '${action}':`, error);

    // Ora proviamo a recuperare la risposta come testo grezzo
    try {
      // Per fare questo, dobbiamo rieseguire la chiamata fetch, perché il corpo
      // di una risposta può essere letto una sola volta.
      const rawResponse = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action, payload }),
      });
      const responseText = await rawResponse.text();
      
      console.log('--- INIZIO RISPOSTA GREZZA DAL SERVER GOOGLE ---');
      console.log(responseText);
      console.log('--- FINE RISPOSTA GREZZA DAL SERVER GOOGLE ---');
      
      // Mostriamo un errore più specifico all'utente
      alert("Errore di comunicazione con il server. Controlla la console per i dettagli (premi F12).");

    } catch (e) {
      console.error("Impossibile anche recuperare la risposta come testo.", e);
    }
    
    // Rilanciamo l'errore originale per non interrompere il flusso
    throw error;
  }
};