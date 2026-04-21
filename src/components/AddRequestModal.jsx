import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { callApi } from '../services/api';
import { 
  format, isBefore, startOfToday, getDay, parseISO, 
  startOfMonth, endOfMonth, eachDayOfInterval, 
  startOfWeek, addDays 
} from 'date-fns';
import { it } from 'date-fns/locale';

import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css'; 

import './AddRequestModal.css'; 

const formatDateKey = (date) => format(date, 'yyyy-MM-dd');

const AddRequestModal = ({ isOpen, onClose, onRquestCreated }) => {
  const [selectedDates, setSelectedDates] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [existingRequestDates, setExistingRequestDates] = useState(new Set());
  
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false); 
  const [targetUserId, setTargetUserId] = useState('');

  const { user } = useAuth();
  const { setIsLoading } = useLoading();
  const today = startOfToday();

  useEffect(() => {
    if (isOpen) {
      setSelectedDates([]);
      setError('');
      setMessage('');
      setSubmitLoading(false);
      setCurrentMonth(new Date());
      setTargetUserId(user.id);

      const fetchData = async () => {
        try {
          if (user.isAdmin) {
            setUsersLoading(true);
            const allUsers = await callApi('getUsers');
            setUsersList(allUsers.sort((a, b) => a.firstName.localeCompare(b.firstName)));
            setUsersLoading(false);
          }
          await fetchExistingRequestsForUser(user.id);
        } catch (err) {
          console.error("Errore caricamento dati:", err);
          setUsersLoading(false);
        }
      };
      
      fetchData();
    }
  }, [isOpen, user.id, user.isAdmin]);

  const fetchExistingRequestsForUser = async (userId) => {
    try {
      const requests = await callApi('getRequests', { userId: userId });
      const activeRequestDates = requests
        .filter(req => req.status !== 'cancelled_by_user')
        .map(req => formatDateKey(new Date(req.requestedDate)));
      setExistingRequestDates(new Set(activeRequestDates));
    } catch (err) {
      console.error("Errore caricamento richieste esistenti:", err);
    }
  };

  const handleUserChange = async (e) => {
    const newUserId = e.target.value;
    setTargetUserId(newUserId);
    setSelectedDates([]); 
    setIsLoading(true); 
    try {
      await fetchExistingRequestsForUser(newUserId); 
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedDates || selectedDates.length === 0) return;
    
    const newDatesToSend = selectedDates
      .map(date => formatDateKey(date))
      .filter(dateKey => !existingRequestDates.has(dateKey));

    if (newDatesToSend.length === 0) {
        setError("Nessuna nuova data valida selezionata.");
        return;
    }
    
    setError('');
    setIsLoading(true);
    setSubmitLoading(true);

    try {
      const response = await callApi('createBatchRequests', {
        userId: targetUserId, 
        dates: newDatesToSend, 
        actorId: user.id 
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

  const showLateRequestWarning = useMemo(() => {
    const now = new Date();
    if (now.getHours() < 19) return false;
    const todayString = formatDateKey(now);
    return selectedDates.some(date => formatDateKey(date) === todayString);
  }, [selectedDates]);
  
  const isDayValid = (date) => {
    const dayOfWeek = getDay(date);
    const isPast = isBefore(date, today);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isAlreadyRequested = existingRequestDates.has(formatDateKey(date));
    return !isPast && !isWeekend && !isAlreadyRequested;
  };

  const handleSelectCurrentWeekWorkdays = () => {
    const monday = startOfWeek(today, { locale: it }); 
    const weekWorkdays = [];
    for (let i = 0; i < 5; i++) { 
      const day = addDays(monday, i);
      if (isDayValid(day)) weekWorkdays.push(day);
    }
    const currentKeys = selectedDates.map(formatDateKey);
    const newKeys = weekWorkdays.map(formatDateKey);
    const allKeys = new Set([...currentKeys, ...newKeys]);
    setSelectedDates(Array.from(allKeys).map(key => parseISO(key)));
  };

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

  const modifiers = {
    requested: (date) => existingRequestDates.has(formatDateKey(date)) && !selectedDates.some(selDate => formatDateKey(selDate) === formatDateKey(date)),
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
          <p className="success-message">{message}</p>
          <div className="modal-actions-sticky">
            <button className="submit-btn" onClick={handleCloseAndRefresh}>Chiudi</button>
          </div>
        </div>
      ) : (
        <div className="add-request-modal-wrapper">
          <form onSubmit={handleSubmit} className="modal-scroll-content">
            
            {user.isAdmin && (
              <div className="admin-selectors-container">
                <div className="admin-field">
                  <label htmlFor="targetUser">Prenota per l'utente:</label>
                  <select 
                    id="targetUser" 
                    value={targetUserId} 
                    onChange={handleUserChange}
                    className="user-select-compact"
                    disabled={usersLoading}
                  >
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} {u.id === user.id ? '(Tu)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            
            <div className="quick-select-section">
              <div className="quick-select-buttons">
                <button type="button" className="quick-select-btn" onClick={handleSelectCurrentWeekWorkdays}>Questa Settimana</button>
                <button type="button" className="quick-select-btn" onClick={handleSelectAllWorkdays}>Tutto il Mese</button>
                <button type="button" className="quick-select-btn secondary" onClick={() => setSelectedDates([])}>Deseleziona</button>
              </div>
            </div>

            <div className="calendar-section">
              <div className="modal-calendar-container">
                <DayPicker
                  mode="multiple"
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
                    requested: 'rdp-day_requested'
                  }}
                />
              </div>
            </div>
            
            <div className="summary-section">
              <div className="selected-dates-summary">
                <strong>Riepilogo date selezionate ({selectedDates.length}):</strong>
                <div className="dates-list-scroll">
                  {selectedDates.length > 0 ? (
                    [...selectedDates]
                      .sort((a, b) => a.getTime() - b.getTime())
                      .map(date => (
                        <span key={date.toISOString()} className="date-tag">
                          {format(date, 'dd/MM/yyyy')}
                        </span>
                      ))
                  ) : (
                    <span style={{fontSize: '0.8rem', opacity: 0.6}}>Nessuna data selezionata.</span>
                  )}
                </div>
              </div>
            </div>

            {showLateRequestWarning && (
              <p className="warning-message">
                Attenzione: L'assegnazione principale per oggi è già avvenuta.
              </p>
            )}

            {error && <p className="error-message">{error}</p>}
          </form>
          
          <div className="modal-actions-sticky">
            <button type="button" className="cancel-btn" onClick={onClose} disabled={submitLoading}>Annulla</button>
            <button 
              type="submit" 
              className="submit-btn" 
              onClick={handleSubmit}
              disabled={submitLoading || selectedDates.length === 0}
            >
              {submitLoading ? <div className="spinner-small"></div> : `Invia richieste (${selectedDates.length})`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default AddRequestModal;