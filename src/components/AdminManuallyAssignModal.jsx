import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
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

import './AdminManuallyAssignModal.css';

const formatDateKey = (date) => format(date, 'yyyy-MM-dd');

const AdminManuallyAssignModal = ({ 
  isOpen, 
  onClose, 
  onRefreshData, 
  onOptimisticUpdate,
  usersList = [],      // Prop ricevuta senza chiamate di rete
  parkingSpaces = []   // Prop ricevuta senza chiamate di rete
}) => {
  const [targetUserId, setTargetUserId] = useState('');
  const [targetSpaceId, setTargetSpaceId] = useState('');
  const [selectedDates, setSelectedDates] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { setIsLoading } = useLoading();
  const today = startOfToday();

  // Reset e inizializzazione dello stato all'apertura (ZERO CHIAMATE NETWORK)
  useEffect(() => {
    if (isOpen) {
      setSelectedDates([]);
      setError('');
      setMessage('');
      setSubmitLoading(false);
      setCurrentMonth(new Date());
      setTargetUserId(usersList.length > 0 ? usersList[0].id : '');
      setTargetSpaceId(parkingSpaces.length > 0 ? parkingSpaces[0].id : '');
    }
  }, [isOpen, usersList, parkingSpaces]);

  const sortedUsers = useMemo(() => {
    return [...usersList].sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
  }, [usersList]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!targetUserId || !targetSpaceId || selectedDates.length === 0) {
      setError("Seleziona un utente, un posto auto ed almeno una data.");
      return;
    }

    setError('');
    setIsLoading(true);
    setSubmitLoading(true);

    const spaceObj = parkingSpaces.find(s => s.id === targetSpaceId);
    const spaceNumber = spaceObj ? (spaceObj.number || spaceObj.name) : 'Forzato';

    try {
      const formattedDates = selectedDates.map(formatDateKey);

      for (const dateStr of formattedDates) {
        const response = await callApi('adminAssignParckingForDate', {
          date: dateStr,
          userId: targetUserId,
          spaceId: targetSpaceId
        });

        // 1. Usa la richiesta restituita con l'ID reale dal Backend
        const realRequest = response?.request || response?.data?.request;

        if (typeof onOptimisticUpdate === 'function') {
          if (realRequest && realRequest.requestId) {
            onOptimisticUpdate(realRequest);
          } else {
            // Fallback locale in caso di assenza della proprietà
            onOptimisticUpdate({
              requestId: `req_${Date.now()}_${Math.random()}`,
              userId: targetUserId,
              requestedDate: dateStr,
              status: 'assigned',
              assignedParkingSpaceId: targetSpaceId,
              assignedParkingSpaceNumber: spaceNumber
            });
          }
        }
      }

      setMessage("Assegnazione manuale completata con successo!");
      setSelectedDates([]);
    } catch (err) {
      setError(err.message || "Errore durante l'assegnazione.");
    } finally {
      setIsLoading(false);
      setSubmitLoading(false);
    }
  };

  const isDayValid = (date) => {
    const dayOfWeek = getDay(date);
    const isPast = isBefore(date, today);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    return !isPast && !isWeekend;
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
    disabled: [
      { before: today },
      { dayOfWeek: [0, 6] }
    ]
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assegnazione Manuale Parcheggio">
      {message ? (
        <div className="success-container">
          <p className="success-message">{message}</p>
          <div className="modal-actions-sticky">
            <button className="submit-btn" onClick={onClose}>Chiudi</button>
          </div>
        </div>
      ) : (
        <div className="admin-assign-modal-wrapper">
          <form onSubmit={handleSubmit} className="modal-scroll-content">
            
            <div className="admin-selectors-container">
              <div className="admin-field">
                <label htmlFor="assignTargetUser">Utente:</label>
                <select 
                  id="assignTargetUser" 
                  value={targetUserId} 
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="user-select-compact"
                >
                  {sortedUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field">
                <label htmlFor="assignTargetSpace">Posto Auto:</label>
                <select 
                  id="assignTargetSpace" 
                  value={targetSpaceId} 
                  onChange={(e) => setTargetSpaceId(e.target.value)}
                  className="user-select-compact"
                >
                  {parkingSpaces.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.number || s.name || s.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
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
                    selected: 'rdp-day_selected'
                  }}
                />
              </div>
            </div>
            
            <div className="summary-section">
              <div className="selected-dates-summary">
                <strong>Riepilogo date da assegnare ({selectedDates.length}):</strong>
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
              {submitLoading ? <div className="spinner-small"></div> : `Assegna (${selectedDates.length})`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default AdminManuallyAssignModal;