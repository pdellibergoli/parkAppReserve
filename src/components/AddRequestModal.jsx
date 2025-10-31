import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { callApi } from '../services/api';
import { format, isBefore, startOfToday, getDay, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

// --- NUOVE IMPORTAZIONI ---
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css'; // Importa lo stile base
// --- FINE NUOVE IMPORTAZIONI ---

// CSS della modale (contiene gli stili personalizzati per il DayPicker)
import './AddRequestModal.css'; 

// Funzione helper per formattare la data
const formatDateKey = (date) => format(date, 'yyyy-MM-dd');

const AddRequestModal = ({ isOpen, onClose, onRquestCreated }) => {
  const [selectedDates, setSelectedDates] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // --- NUOVO STATO PER LE RICHIESTE ESISTENTI ---
  // Usiamo un Set per ricerche veloci (contiene stringhe 'yyyy-MM-dd')
  const [existingRequestDates, setExistingRequestDates] = useState(new Set());
  // --- FINE NUOVO STATO ---
  
  const { user } = useAuth();
  const { setIsLoading } = useLoading();
  const today = startOfToday();

  // Reset degli stati E CARICAMENTO DATI quando la modale si apre
  useEffect(() => {
    if (isOpen) {
      setSelectedDates([]);
      setError('');
      setMessage('');
      setSubmitLoading(false);
      setCurrentMonth(new Date());
      
      // --- NUOVO: Carica le richieste esistenti ---
      const fetchExistingRequests = async () => {
        try {
          const requests = await callApi('getRequests', { userId: user.id });
          // Filtriamo solo le richieste "attive" (non quelle già annullate)
          const activeRequestDates = requests
            .filter(req => req.status !== 'cancelled_by_user')
            .map(req => formatDateKey(new Date(req.requestedDate)));
            
          setExistingRequestDates(new Set(activeRequestDates));
        } catch (err) {
          console.error("Errore caricamento richieste esistenti:", err);
          // Non blocchiamo la modale se fallisce, l'utente può comunque inviare
        }
      };
      
      fetchExistingRequests();
      // --- FINE NUOVO ---
      
    }
  }, [isOpen, user.id]); // Dipende da isOpen e user.id

  // Gestione invio form (Modificato per evitare doppie richieste)
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedDates || selectedDates.length === 0) {
        setError("Devi selezionare almeno una data.");
        return;
    }
    
    // --- NUOVO CONTROLLO: Filtra date già richieste ---
    const newDatesToSend = [];
    const alreadyRequested = [];
    
    selectedDates.forEach(date => {
      const dateKey = formatDateKey(date);
      if (existingRequestDates.has(dateKey)) {
        alreadyRequested.push(format(date, 'dd/MM/yyyy'));
      } else {
        newDatesToSend.push(dateKey);
      }
    });

    // Se l'utente ha selezionato SOLO date già richieste
    if (newDatesToSend.length === 0 && alreadyRequested.length > 0) {
        setError(`Hai già una richiesta attiva per: ${alreadyRequested.join(', ')}. Deselezionale per continuare.`);
        return;
    }
    // Se ha selezionato un mix, inviamo solo quelle nuove
    if (alreadyRequested.length > 0) {
        // Avvisiamo l'utente ma procediamo
        alert(`Le richieste per ${alreadyRequested.join(', ')} sono state ignorate perché già esistenti.`);
    }
    // --- FINE CONTROLLO ---
    
    setError('');
    setMessage('');
    setIsLoading(true);
    setSubmitLoading(true);

    try {
      const response = await callApi('createBatchRequests', {
        userId: user.id,
        dates: newDatesToSend, // Inviamo solo le NUOVE date
      });
      setMessage(response.message);
      // Aggiorniamo le date esistenti nello stato per riflettere i nuovi invii
      setExistingRequestDates(prevSet => new Set([...prevSet, ...newDatesToSend]));
      setSelectedDates([]); // Svuotiamo la selezione corrente
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setSubmitLoading(false);
    }
  };

  const handleCloseAndRefresh = () => {
      onRquestCreated(); // Questa funzione aggiorna i dati in HomePage
      onClose();
  }

  // Messaggio di avviso (invariato)
  const showLateRequestWarning = useMemo(() => {
    const now = new Date();
    if (now.getHours() < 19) return false;
    const todayString = formatDateKey(now);
    return selectedDates.some(date => formatDateKey(date) === todayString);
  }, [selectedDates]);

  // Definiamo i giorni disabilitati (passato e weekend)
  const disabledDays = [
    { before: today }, 
    { dayOfWeek: [0, 6] }
  ];
  
  // --- NUOVO: Definiamo i modificatori per lo stile ---
  const modifiers = {
    // Applica lo stile 'requested' se la data è nel Set (e non è già selezionata)
    requested: (date) => existingRequestDates.has(formatDateKey(date)) && !selectedDates.some(selDate => format(selDate, 'yyyy-MM-dd') === formatDateKey(date)),
    // Applica lo stile 'disabled' se è passato, weekend O GIA' RICHIESTO
    disabled: [
        { before: today },
        { dayOfWeek: [0, 6] },
        (date) => existingRequestDates.has(formatDateKey(date)) // Rende non cliccabili i giorni già richiesti
    ]
  };
  // --- FINE NUOVO ---

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invia Richiesta Parcheggio">
      {message ? (
        <div className="success-container">
          <p className="success-message" style={{textAlign: 'center'}}>{message}</p>
          <div className="modal-actions">
            <button className="submit-btn" onClick={handleCloseAndRefresh}>Chiudi</button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="add-booking-form">
          <p>Clicca sui giorni del calendario per selezionarli. I giorni con un pallino indicano una richiesta già inviata.</p>
          <div className="form-group">
            <div className="modal-calendar-container">
              <DayPicker
                mode="multiple"
                min={0}
                selected={selectedDates}
                onSelect={setSelectedDates}
                locale={it}
                // --- MODIFICA: Applica disabled e modifiers ---
                disabled={modifiers.disabled}
                modifiers={modifiers}
                // --- FINE MODIFICA ---
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                showOutsideDays
                modifiersClassNames={{
                  selected: 'rdp-day_selected',
                  today: 'rdp-day_today',
                  requested: 'rdp-day_requested' // Applica la classe custom
                }}
              />
            </div>
          </div>
          
          {/* Riepilogo date (invariato) */}
          <div className="selected-dates-summary">
            <strong>Date Selezionate ({selectedDates ? selectedDates.length : 0}):</strong>
            <div className="dates-list-scroll">
              {selectedDates && selectedDates.length > 0 ? (
                [...selectedDates]
                  .sort((a, b) => a.getTime() - b.getTime())
                  .map(date => (
                    <span key={date.toISOString()} className="date-tag">
                      {format(date, 'dd/MM/yyyy')}
                    </span>
                  ))
              ) : (
                <span>Nessuna data selezionata.</span>
              )}
            </div>
          </div>

          {showLateRequestWarning && (
            <p className="warning-message" style={{ textAlign: 'center' }}>
              Attenzione: L'assegnazione principale per oggi è già avvenuta. La tua richiesta per oggi verrà messa in lista d'attesa.
            </p>
          )}

          {error && <p className="error-message">{error}</p>}
          
          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose} disabled={submitLoading}>Annulla</button>
            <button 
              type="submit" 
              className="submit-btn" 
              disabled={submitLoading || !selectedDates || selectedDates.length === 0}
            >
              {submitLoading ? <div className="spinner-small"></div> : `Invia ${selectedDates ? selectedDates.length : 0} Richiesta/e`}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default AddRequestModal;