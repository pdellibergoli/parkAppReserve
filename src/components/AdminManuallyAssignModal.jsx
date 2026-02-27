import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { callApi } from '../services/api';
import { 
  format, isBefore, startOfToday, getDay, 
  startOfWeek, addDays 
} from 'date-fns';
import { it } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import './AdminManuallyAssignModal.css';

const formatDateKey = (date) => format(date, 'yyyy-MM-dd');

const AdminManuallyAssignModal = ({ isOpen, onClose, onRefreshData }) => {
  const [selectedDates, setSelectedDates] = useState([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [usersList, setUsersList] = useState([]);
  const [spacesList, setSpacesList] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { setIsLoading } = useLoading();
  const today = startOfToday();

  useEffect(() => {
    if (isOpen) {
      setSelectedDates([]);
      setTargetUserId('');
      setSelectedSpaceId('');
      setError('');
      setMessage('');
      setCurrentMonth(new Date());

      const fetchData = async () => {
        setLoadingData(true);
        try {
          const [userData, spaceData] = await Promise.all([
            callApi('getUsers'),
            callApi('getParkingSpaces')
          ]);
          setUsersList(userData.sort((a, b) => a.firstName.localeCompare(b.firstName)));
          setSpacesList(spaceData.sort((a, b) => {
              const numA = parseInt(a.number) || 0;
              const numB = parseInt(b.number) || 0;
              return numA - numB;
          }));
        } catch (err) {
          setError("Errore nel caricamento dei dati.");
        } finally {
          setLoadingData(false);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetUserId || !selectedSpaceId || selectedDates.length === 0) {
      setError("Compila tutti i campi e seleziona almeno una data.");
      return;
    }

    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      // Invio di una chiamata API per ogni data selezionata (compatibilità backend)
      const promises = selectedDates.map(date => 
        callApi('adminManuallyAssignForDate', {
          date: formatDateKey(date),
          userId: targetUserId,
          spaceId: selectedSpaceId
        })
      );

      await Promise.all(promises);

      setMessage("Assegnazioni completate con successo!");
      setTimeout(() => {
        onRefreshData();
        onClose();
      }, 1500);
    } catch (err) {
      setError("Errore durante l'assegnazione: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isDayValid = (date) => {
    const isPast = isBefore(date, today);
    const isWeekend = getDay(date) === 0 || getDay(date) === 6;
    return !isPast && !isWeekend;
  };

  const handleSelectCurrentWeek = () => {
    const monday = startOfWeek(today, { locale: it });
    const days = [];
    for (let i = 0; i < 5; i++) {
      const day = addDays(monday, i);
      if (isDayValid(day)) days.push(day);
    }
    setSelectedDates(days);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assegnazione Manuale (Admin)">
      <form onSubmit={handleSubmit} className="admin-assign-form">
        
        <div className="admin-selectors-container">
          <div className="admin-field">
            <label>Utente:</label>
            <select 
              value={targetUserId} 
              onChange={(e) => setTargetUserId(e.target.value)}
              className="user-select-compact"
            >
              <option value="">Seleziona Utente...</option>
              {usersList.map(u => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label>Posto Auto:</label>
            <select 
              value={selectedSpaceId} 
              onChange={(e) => setSelectedSpaceId(e.target.value)}
              className="user-select-compact"
            >
              <option value="">Seleziona Posto...</option>
              {spacesList.map(s => (
                <option key={s.id} value={s.id}>Posto {s.number} {s.isFixed ? '(Fisso)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="quick-select-buttons">
          <button type="button" className="quick-select-btn" onClick={handleSelectCurrentWeek}>Settimana Corr.</button>
          <button type="button" className="quick-select-btn secondary" onClick={() => setSelectedDates([])}>Reset</button>
        </div>

        <div className="modal-calendar-container">
          <DayPicker
            mode="multiple"
            selected={selectedDates}
            onSelect={setSelectedDates}
            locale={it}
            disabled={{ before: today, dayOfWeek: [0, 6] }}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            showOutsideDays
            modifiersClassNames={{
              selected: 'rdp-day_selected',
              today: 'rdp-day_today'
            }}
          />
        </div>

        <div className="selected-dates-summary">
          <strong>Date selezionate: {selectedDates.length}</strong>
          <div className="dates-list-scroll">
            {selectedDates.length > 0 ? (
                selectedDates.sort((a,b) => a-b).map(d => (
                    <span key={d.toISOString()} className="date-tag">{format(d, 'dd/MM/yyyy')}</span>
                ))
            ) : <span>Nessuna data selezionata</span>}
          </div>
        </div>

        {error && <p className="error-message">{error}</p>}
        {message && <p className="success-message">{message}</p>}

        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onClose}>Annulla</button>
          <button type="submit" className="submit-btn" disabled={loadingData || selectedDates.length === 0}>
            Conferma
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AdminManuallyAssignModal;