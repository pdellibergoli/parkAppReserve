import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { callApi } from '../services/api';
import { useLoading } from '../context/LoadingContext';
import { format, isBefore, startOfToday, getDay, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import './AvailabilityModal.css'; // Useremo questo per gli stili del calendario

// Funzione helper per formattare la data come chiave
const formatDateKey = (date) => format(date, 'yyyy-MM-dd');

const AvailabilityModal = ({ isOpen, onClose, space, onSave }) => {
  const { setIsLoading } = useLoading();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Stato per le date selezionate nel calendario (oggetti Date)
  const [selectedDates, setSelectedDates] = useState([]);
  
  // Stato per memorizzare le disponibilità originali caricate (con ID)
  // Formato: [{ id: 'avail_123', date: DateObject }, ...]
  const [existingAvailabilities, setExistingAvailabilities] = useState([]);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = startOfToday();

  // Carica le disponibilità esistenti quando la modale si apre
  useEffect(() => {
    if (isOpen && space) {
      // Resetta gli stati
      setError('');
      setSubmitLoading(false);
      setCurrentMonth(new Date());
      setIsLoading(true);

      const fetchAvailabilities = async () => {
        try {
          const data = await callApi('getTemporaryAvailabilities', { spaceId: space.id });
          
          // Converti le stringhe di data in oggetti Date
          const availDates = data.map(avail => new Date(avail.availableDate));
          
          // Salva i dati originali (con ID) per il confronto al salvataggio
          const availData = data.map(avail => ({
            id: avail.availabilityId,
            date: new Date(avail.availableDate)
          }));
          
          setSelectedDates(availDates); // Imposta il calendario con le date esistenti
          setExistingAvailabilities(availData); // Salva lo stato originale
          
        } catch (err) {
          setError("Impossibile caricare le disponibilità esistenti.");
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchAvailabilities();
    }
  }, [isOpen, space, setIsLoading]);

  // Gestione salvataggio
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setSubmitLoading(true);

    try {
      // 1. Crea Set di stringhe 'yyyy-MM-dd' per un confronto facile
      const originalDateSet = new Set(existingAvailabilities.map(a => formatDateKey(a.date)));
      const newDateSet = new Set(selectedDates.map(formatDateKey));

      // 2. Trova le date da AGGIUNGERE
      // (Date che sono in newDateSet ma non in originalDateSet)
      const datesToAdd = selectedDates.filter(date => !originalDateSet.has(formatDateKey(date)));

      // 3. Trova le date da RIMUOVERE
      // (Date che erano in originalDateSet ma non più in newDateSet)
      // Abbiamo bisogno dei loro ID per l'API
      const idsToRemove = existingAvailabilities
        .filter(avail => !newDateSet.has(formatDateKey(avail.date)))
        .map(a => a.id);

      // 4. Esegui le chiamate API in parallelo
      const addPromises = datesToAdd.map(date => 
        callApi('addTemporaryAvailability', { 
          spaceId: space.id, 
          date: formatDateKey(date) // Invia come stringa
        })
      );
      
      const removePromises = idsToRemove.map(availabilityId => 
        callApi('removeTemporaryAvailability', { availabilityId })
      );

      await Promise.all([...addPromises, ...removePromises]);

      // Chiudi e aggiorna la pagina principale
      onSave();
      onClose();

    } catch (err) {
      setError(`Errore durante il salvataggio: ${err.message}`);
    } finally {
      setIsLoading(false);
      setSubmitLoading(false);
    }
  };

  // Definisci i giorni disabilitati (passato e weekend)
  const disabledDays = [
    { before: today }, 
    { dayOfWeek: [0, 6] }
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Gestisci Disponibilità per ${space?.number || ''}`}>
      <form onSubmit={handleSubmit} className="availability-form">
        <p>Seleziona o deseleziona i giorni in cui questo parcheggio è disponibile.</p>
        
        <div className="form-group">
          <div className="modal-calendar-container">
            <DayPicker
              mode="multiple"
              min={0}
              selected={selectedDates}
              onSelect={setSelectedDates}
              locale={it}
              disabled={disabledDays}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              showOutsideDays
              modifiersClassNames={{
                selected: 'rdp-day_selected',
                today: 'rdp-day_today'
              }}
            />
          </div>
        </div>

        {error && <p className="error-message" style={{ textAlign: 'center' }}>{error}</p>}
        
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onClose} disabled={submitLoading}>
            Annulla
          </button>
          <button type="submit" className="submit-btn" disabled={submitLoading}>
            {submitLoading ? <div className="spinner-small"></div> : 'Salva Modifiche'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AvailabilityModal;