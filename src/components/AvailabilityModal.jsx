import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { callApi } from '../services/api';
import { useLoading } from '../context/useLoading';
import { format, startOfToday } from 'date-fns';
import { it } from 'date-fns/locale';

import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import './AvailabilityModal.css';

// Funzione helper per formattare la data come chiave
const formatDateKey = (date) => format(date, 'yyyy-MM-dd');

const AvailabilityModal = ({ isOpen, onClose, space, onSave }) => {
  const { setIsLoading } = useLoading();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Stato per le date selezionate nel calendario (oggetti Date)
  const [selectedDates, setSelectedDates] = useState([]);
  
  // Stato per memorizzare le disponibilità/disabilitazioni originali caricate (con ID)
  // Formato: [{ id: 'avail_123', date: DateObject }, ...]
  const [existingEntries, setExistingEntries] = useState([]);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = startOfToday();

  const isFixed = space?.isFixed === true;

  // Carica le disponibilità o disabilitazioni esistenti quando la modale si apre
  useEffect(() => {
    if (isOpen && space) {
      setError('');
      setSubmitLoading(false);
      setCurrentMonth(new Date());
      setIsLoading(true);

      const fetchEntries = async () => {
        try {
          const action = isFixed ? 'getTemporaryUnavailabilities' : 'getTemporaryAvailabilities';
          const data = await callApi(action, { spaceId: space.id });
          const items = Array.isArray(data) ? data : [];
          
          const dateField = isFixed ? 'unavailableDate' : 'availableDate';
          const idField = isFixed ? 'unavailabilityId' : 'availabilityId';

          const dates = items
            .filter(item => item && item[dateField])
            .map(item => new Date(item[dateField]));
            
          const mappedEntries = items
            .filter(item => item && item[dateField] && item[idField])
            .map(item => ({
              id: item[idField],
              date: new Date(item[dateField])
            }));
          
          setSelectedDates(dates);
          setExistingEntries(mappedEntries);
          
        } catch {
          setError(isFixed 
            ? "Impossibile caricare le disabilitazioni esistenti." 
            : "Impossibile caricare le disponibilità esistenti."
          );
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchEntries();
    }
  }, [isOpen, space, isFixed, setIsLoading]);

  // Gestione salvataggio
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setSubmitLoading(true);

    try {
      const originalDateSet = new Set(existingEntries.map(a => formatDateKey(a.date)));
      const newDateSet = new Set(selectedDates.map(formatDateKey));

      const datesToAdd = selectedDates.filter(date => !originalDateSet.has(formatDateKey(date)));
      const idsToRemove = existingEntries
        .filter(entry => !newDateSet.has(formatDateKey(entry.date)))
        .map(a => a.id);

      const addAction = isFixed ? 'addTemporaryUnavailability' : 'addTemporaryAvailability';
      const removeAction = isFixed ? 'removeTemporaryUnavailability' : 'removeTemporaryAvailability';
      const removeIdKey = isFixed ? 'unavailabilityId' : 'availabilityId';

      const addPromises = datesToAdd.map(date => 
        callApi(addAction, { 
          spaceId: space.id, 
          date: formatDateKey(date)
        })
      );
      
      const removePromises = idsToRemove.map(id => 
        callApi(removeAction, { [removeIdKey]: id })
      );

      await Promise.all([...addPromises, ...removePromises]);

      onSave();
      onClose();

    } catch (err) {
      setError(`Errore durante il salvataggio: ${err.message}`);
    } finally {
      setIsLoading(false);
      setSubmitLoading(false);
    }
  };

  // Definisci i giorni disabilitati dal calendario (passato e weekend)
  const disabledDays = [
    { before: today }, 
    { dayOfWeek: [0, 6] }
  ];

  const modalTitle = isFixed 
    ? `Disabilita Temporaneamente ${space?.number || ''}`
    : `Gestisci Disponibilità per ${space?.number || ''}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <form onSubmit={handleSubmit} className={`availability-form ${isFixed ? 'unavailability-mode' : ''}`}>
        <p>
          {isFixed
            ? 'Seleziona o deseleziona i giorni in cui questo parcheggio fisso sarà disabilitato.'
            : 'Seleziona o deseleziona i giorni in cui questo parcheggio non fisso è disponibile.'}
        </p>

        <div className={`modal-notice ${isFixed ? 'warning' : 'info'}`}>
          {isFixed ? (
            <>
              <strong>⚠️ Posto Fisso:</strong> I giorni selezionati saranno <strong>disabilitati</strong> e non verranno assegnati per le richieste.
            </>
          ) : (
            <>
              <strong>ℹ️ Posto Non Fisso:</strong> I giorni selezionati saranno <strong>disponibili</strong> per essere assegnati alle richieste.
            </>
          )}
        </div>
        
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
            {submitLoading ? <div className="spinner-small"></div> : (isFixed ? 'Salva Disabilitazioni' : 'Salva Modifiche')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AvailabilityModal;