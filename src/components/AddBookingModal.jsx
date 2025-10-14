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
  const [message, setMessage] = useState(''); // Stato per i messaggi di successo (es. richiesta inviata)
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
      setMessage(''); // Pulisce i messaggi all'apertura
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
  
  // --- LOGICA PER MOSTRARE IL PULSANTE DI RICHIESTA ---
  const showRequestButton = useMemo(() => {
    // Non mostrare il pulsante in modalità modifica o se l'utente ha già una prenotazione
    if (isEditMode || userHasBookingOnDate) return false;

    // Controlla se ci sono parcheggi fissi disponibili tra quelli liberi
    const hasAvailableFixedSpaces = availableSpaces.some(space => space.isFixed === true);

    // Mostra il pulsante solo se NON ci sono parcheggi fissi disponibili
    return !hasAvailableFixedSpaces;
  }, [availableSpaces, userHasBookingOnDate, isEditMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSpaceId) {
      setError("Per favore, seleziona un parcheggio.");
      return;
    }
    setError('');
    setIsLoading(true);
    setLoading(true);

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
      setIsLoading(false);
      setLoading(false);
    }
  };

  // --- FUNZIONE PER GESTIRE LA RICHIESTA ---
  const handleRequestParking = async () => {
    setIsLoading(true);
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await callApi('requestParkingSpace', { date: selectedDate, userId: user.id });
      setMessage(response.message); // Mostra il messaggio di successo
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  };

  const modalTitle = isEditMode ? 'Modifica Prenotazione' : 'Aggiungi Prenotazione';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      {message ? (
        <div className="success-container">
          <p className="success-message" style={{textAlign: 'center'}}>{message}</p>
          <div className="modal-actions">
            <button className="submit-btn" onClick={onClose}>Chiudi</button>
          </div>
        </div>
      ) : (
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
            <p className="warning-message">Hai già una prenotazione per il giorno selezionato.</p>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="parking-space">Seleziona un parcheggio</label>
                <select id="parking-space" value={selectedSpaceId} onChange={(e) => setSelectedSpaceId(e.target.value)} required={!showRequestButton} disabled={availableSpaces.length === 0}>
                  <option value="">
                    {availableSpaces.length > 0 ? "Scegli un posto..." : "Nessun posto prenotabile"}
                  </option>
                  {isEditMode && initialBookingData?.parkingSpaceId && !availableSpaces.some(s => s.id === initialBookingData.parkingSpaceId) && (
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
              
              {showRequestButton && (
                  <div className="warning-message">
                      <p>Non ci sono posti fissi disponibili. Puoi inviare una richiesta per un posto.</p>
                  </div>
              )}
            </>
          )}
          
          {error && <p className="error-message">{error}</p>}
          
          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose} disabled={loading}>Annulla</button>
            
            {!userHasBookingOnDate && (
              <button type="submit" className="submit-btn" disabled={!selectedSpaceId || loading}>
                {loading ? <div className="spinner-small"></div> : (isEditMode ? 'Salva Modifiche' : 'Conferma')}
              </button>
            )}

            {/* Mostra il pulsante di richiesta solo se le condizioni sono soddisfatte */}
            {showRequestButton && (
              <button type="button" className="request-btn" onClick={handleRequestParking} disabled={loading}>
                {loading ? <div className="spinner-small"></div> : 'Invia Richiesta'}
              </button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
};

export default AddBookingModal;