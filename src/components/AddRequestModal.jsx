import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { callApi } from '../services/api';
import { 
  format, isBefore, startOfToday, getDay, parseISO, isSameMonth, 
  startOfMonth, endOfMonth, eachDayOfInterval, 
  startOfWeek, addDays 
} from 'date-fns';
import { it } from 'date-fns/locale';

import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css'; 

import './AddRequestModal.css'; 

// Funzione helper per formattare la data
const formatDateKey = (date) => format(date, 'yyyy-MM-dd');

const AddRequestModal = ({ isOpen, onClose, onRquestCreated }) => {
  const [selectedDates, setSelectedDates] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [existingRequestDates, setExistingRequestDates] = useState(new Set());
  
  const { user } = useAuth();
  const { setIsLoading } = useLoading();
  const today = startOfToday();

  // Reset e caricamento dati (invariato)
  useEffect(() => {
    if (isOpen) {
      setSelectedDates([]);
      setError('');
      setMessage('');
      setSubmitLoading(false);
      setCurrentMonth(new Date());
      
      const fetchExistingRequests = async () => {
        try {
          const requests = await callApi('getRequests', { userId: user.id });
          const activeRequestDates = requests
            .filter(req => req.status !== 'cancelled_by_user')
            .map(req => formatDateKey(new Date(req.requestedDate)));
            
          setExistingRequestDates(new Set(activeRequestDates));
        } catch (err) {
          console.error("Errore caricamento richieste esistenti:", err);
        }
      };
      
      fetchExistingRequests();
    }
  }, [isOpen, user.id]);

  // Gestione invio form (invariato)
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedDates || selectedDates.length === 0) {
        setError("Devi selezionare almeno una data.");
        return;
    }
    
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

    if (newDatesToSend.length === 0 && alreadyRequested.length > 0) {
        setError(`Hai già una richiesta attiva per: ${alreadyRequested.join(', ')}. Deselezionale per continuare.`);
        return;
    }
    if (alreadyRequested.length > 0) {
        alert(`Le richieste per ${alreadyRequested.join(', ')} sono state ignorate perché già esistenti.`);
    }
    
    if (newDatesToSend.length === 0) {
        setError("Nessuna nuova data valida selezionata.");
        return;
    }
    
    setError('');
    setMessage('');
    setIsLoading(true);
    setSubmitLoading(true);

    try {
      const response = await callApi('createBatchRequests', {
        userId: user.id,
        dates: newDatesToSend, 
      });
      setMessage(response.message);
      setExistingRequestDates(prevSet => new Set([...prevSet, ...newDatesToSend]));
      setSelectedDates([]); 
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setSubmitLoading(false);
    }
  };

  const handleCloseAndRefresh = () => {
      onRquestCreated(); 
      onClose();
  }

  // Messaggio di avviso (invariato)
  const showLateRequestWarning = useMemo(() => {
    const now = new Date();
    if (now.getHours() < 19) return false;
    const todayString = formatDateKey(now);
    return selectedDates.some(date => formatDateKey(date) === todayString);
  }, [selectedDates]);
  
  // Funzione helper per validare un singolo giorno (invariata)
  const isDayValid = (date) => {
    const dayOfWeek = getDay(date);
    const isPast = isBefore(date, today);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isAlreadyRequested = existingRequestDates.has(formatDateKey(date));
    
    return !isPast && !isWeekend && !isAlreadyRequested;
  };

  // Funzione selezione settimana (invariata)
  const handleSelectCurrentWeekWorkdays = () => {
    const monday = startOfWeek(today, { locale: it }); 
    const weekWorkdays = [];
    
    for (let i = 0; i < 5; i++) { 
      const day = addDays(monday, i);
      if (isDayValid(day)) { 
        weekWorkdays.push(day);
      }
    }

    const currentKeys = selectedDates.map(formatDateKey);
    const newKeys = weekWorkdays.map(formatDateKey);
    const allKeys = new Set([...currentKeys, ...newKeys]);
    
    setSelectedDates(Array.from(allKeys).map(key => parseISO(key)));
  };

  // Funzione selezione mese (invariata)
  const handleSelectAllWorkdays = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start, end });
    
    const validDaysToAdd = daysInMonth.filter(isDayValid);
    
    const currentKeys = selectedDates.map(formatDateKey);
    const newKeys = validDaysToAdd.map(formatDateKey);
    const allKeys = new Set([...currentKeys, ...newKeys]);
    
    setSelectedDates(Array.from(allKeys).map(key => parseISO(key)));
  };

  // --- MODIFICA QUI ---
  // Funzione per deselezionare TUTTO
  const handleDeselectAll = () => {
    setSelectedDates([]); // Svuota l'array
  };
  // --- FINE MODIFICA ---

  // Modificatori (invariati)
  const modifiers = {
    requested: (date) => existingRequestDates.has(formatDateKey(date)) && !selectedDates.some(selDate => format(selDate, 'yyyy-MM-dd') === formatDateKey(date)),
    disabled: [
        { before: today },
        { dayOfWeek: [0, 6] },
        (date) => existingRequestDates.has(formatDateKey(date))
    ]
  };

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
          <p>Clicca sui giorni per selezionarli. I giorni con pallino ⚪ sono già richiesti.</p>
          
          <div className="quick-select-buttons">
            <button 
              type="button" 
              className="quick-select-btn"
              onClick={handleSelectCurrentWeekWorkdays}
            >
              Questa Settimana
            </button>
            <button 
              type="button" 
              className="quick-select-btn"
              onClick={handleSelectAllWorkdays}
            >
              Questo Mese
            </button>
            {/* --- MODIFICA TESTO PULSANTE --- */}
            <button 
              type="button" 
              className="quick-select-btn secondary"
              onClick={handleDeselectAll}
            >
              Deseleziona Tutto
            </button>
            {/* --- FINE MODIFICA --- */}
          </div>

          <div className="form-group">
            <div className="modal-calendar-container">
              <DayPicker
                mode="multiple"
                min={0}
                selected={selectedDates}
                onSelect={setSelectedDates}
                locale={it}
                disabled={modifiers.disabled}
                modifiers={modifiers}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                showOutsideDays
                modifiersClassNames={{
                  selected: 'rdp-day_selected',
                  today: 'rdp-day_today',
                  requested: 'rdp-day_requested'
                }}
              />
            </div>
          </div>
          
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