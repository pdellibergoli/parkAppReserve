import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { callApi } from '../services/api';
import { format } from 'date-fns';
import './AddBookingModal.css';

const AddBookingModal = ({ isOpen, onClose, onBookingAdded, initialBookingData, parkingSpaces, allBookings }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [error, setError] = useState('');
  
  const [loading, setLoading] = useState(false); 
  
  const { user } = useAuth();
  const { setIsLoading } = useLoading();

  const isEditMode = !!initialBookingData;

  useEffect(() => {
    if (isOpen) {
      if (isEditMode) {
        setSelectedDate(format(new Date(initialBookingData.date), 'yyyy-MM-dd'));
        setSelectedSpaceId(initialBookingData.parkingSpaceId);
      } else {
        setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
        setSelectedSpaceId('');
      }
      setError('');
    }
  }, [isOpen, isEditMode, initialBookingData]);

  const availableSpaces = useMemo(() => {
    if (!selectedDate) return [];
    
    const bookedSpaceIds = allBookings
      .filter(booking => {
        const isSameDate = format(new Date(booking.date), 'yyyy-MM-dd') === selectedDate;
        const isCurrentBookingInEdit = isEditMode && booking.id === initialBookingData.id;
        return isSameDate && !isCurrentBookingInEdit;
      })
      .map(booking => booking.parkingSpaceId);
      
    return parkingSpaces.filter(space => !bookedSpaceIds.includes(space.id));
  }, [selectedDate, allBookings, parkingSpaces, isEditMode, initialBookingData]);

  const userHasBookingOnDate = useMemo(() => {
    const bookingIdToIgnore = isEditMode ? initialBookingData.id : null;

    return allBookings.some(booking => 
      format(new Date(booking.date), 'yyyy-MM-dd') === selectedDate && 
      booking.userId === user.id &&
      booking.id !== bookingIdToIgnore
    );
  }, [selectedDate, allBookings, user.id, isEditMode, initialBookingData]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSpaceId) {
      setError("Per favore, seleziona un parcheggio.");
      return;
    }
    setError('');
    setIsLoading(true); // Attiva l'overlay globale
    setLoading(true);   // Attiva lo spinner locale nel pulsante

    try {
      if (isEditMode) {
        await callApi('updateBooking', { 
            bookingId: initialBookingData.id, 
            date: selectedDate, 
            parkingSpaceId: selectedSpaceId 
        });
      } else {
        await callApi('createBooking', {
            date: selectedDate,
            parkingSpaceId: selectedSpaceId,
            userId: user.id,
        });
      }
      onBookingAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false); // Disattiva l'overlay globale
      setLoading(false);   // Disattiva lo spinner locale
    }
  };

  const modalTitle = isEditMode ? 'Modifica Prenotazione' : 'Aggiungi Prenotazione';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <form onSubmit={handleSubmit} className="add-booking-form">
        <div className="form-group">
          <label htmlFor="booking-date">Seleziona una data</label>
          <input 
            type="date" 
            id="booking-date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            min={format(new Date(), 'yyyy-MM-dd')} 
            required 
          />
        </div>

        {userHasBookingOnDate ? (
          <p className="warning-message">Hai già un'altra prenotazione per il giorno selezionato.</p>
        ) : (
          <div className="form-group">
            <label htmlFor="parking-space">Seleziona un parcheggio</label>
            <select id="parking-space" value={selectedSpaceId} onChange={(e) => setSelectedSpaceId(e.target.value)} required>
              <option value="">
                {availableSpaces.length > 0 ? "Scegli un posto..." : "Nessun posto disponibile"}
              </option>
              {isEditMode && initialBookingData.parkingSpaceId && !availableSpaces.some(s => s.id === initialBookingData.parkingSpaceId) && (
                <option key={initialBookingData.parkingSpaceId} value={initialBookingData.parkingSpaceId}>
                    {parkingSpaces.find(p => p.id === initialBookingData.parkingSpaceId)?.number}
                </option>
              )}
              {availableSpaces.map(space => 
                <option key={space.id} value={space.id}>
                  {space.number}
                </option>
              )}
            </select>
          </div>
        )}
        
        {error && <p className="error-message">{error}</p>}
        
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onClose} disabled={loading}>Annulla</button>
          {!userHasBookingOnDate && (
            <button type="submit" className="submit-btn" disabled={!selectedSpaceId || loading}>
              {loading ? <div className="spinner-small"></div> : (isEditMode ? 'Salva Modifiche' : 'Conferma')}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default AddBookingModal;