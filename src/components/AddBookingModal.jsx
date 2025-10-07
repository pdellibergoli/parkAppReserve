import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { callApi } from '../services/api';
import { format } from 'date-fns';
import './AddBookingModal.css';

const AddBookingModal = ({ isOpen, onClose, onBookingAdded, parkingSpaces, allBookings }) => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const availableSpaces = useMemo(() => {
    if (!selectedDate) return [];
    
    const bookedSpaceIds = allBookings
      .filter(booking => format(new Date(booking.date), 'yyyy-MM-dd') === selectedDate)
      .map(booking => booking.parkingSpaceId);
      
    return parkingSpaces.filter(space => !bookedSpaceIds.includes(space.id));
  }, [selectedDate, allBookings, parkingSpaces]);

  const userHasBookingOnDate = useMemo(() => {
    return allBookings.some(booking => 
      format(new Date(booking.date), 'yyyy-MM-dd') === selectedDate && booking.userId === user.id
    );
  }, [selectedDate, allBookings, user.id]);

  const showRequestButton = useMemo(() => {
    if (userHasBookingOnDate) return false;
    const hasAvailableFixedSpaces = availableSpaces.some(space => space.isFixed === true);
    return !hasAvailableFixedSpaces;
  }, [availableSpaces, userHasBookingOnDate]);

  // --- 1. NUOVA LOGICA: Troviamo l'oggetto completo del parcheggio selezionato ---
  const selectedSpace = useMemo(() => {
    // Cerca nell'array di tutti i parcheggi quello che corrisponde all'ID selezionato
    return parkingSpaces.find(space => space.id === selectedSpaceId);
  }, [selectedSpaceId, parkingSpaces]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSpaceId) {
      setError("Per favore, seleziona un parcheggio.");
      return;
    }
    setError('');
    setLoading(true);

    try {
      const newBookingData = {
        date: selectedDate,
        parkingSpaceId: selectedSpaceId,
        userId: user.id,
      };
      
      const createdBooking = await callApi('createBooking', newBookingData);
      onBookingAdded(createdBooking);
      handleClose();

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestParking = async () => {
    if (userHasBookingOnDate) {
      setError("Hai già una prenotazione per questo giorno.");
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await callApi('requestParkingSpace', { date: selectedDate, userId: user.id });
      setMessage(response.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleClose = () => {
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
    setSelectedSpaceId('');
    setError('');
    setMessage('');
    setLoading(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Aggiungi Prenotazione">
      {message ? (
        <div className="success-message">{message}</div>
      ) : (
        <form onSubmit={handleSubmit} className="add-booking-form">
          {/* ... (la parte superiore del form rimane invariata) ... */}
          <div className="form-group">
            <label htmlFor="booking-date">Seleziona una data</label>
            <input type="date" id="booking-date" value={selectedDate} onChange={(e) => { setSelectedSpaceId(''); setSelectedDate(e.target.value); }} min={format(new Date(), 'yyyy-MM-dd')} required />
          </div>

          {userHasBookingOnDate ? (
            <p className="warning-message">Hai già una prenotazione per il giorno selezionato.</p>
          ) : availableSpaces.length > 0 ? (
            <div className="form-group">
              <label htmlFor="parking-space">Seleziona un parcheggio</label>
              <select id="parking-space" value={selectedSpaceId} onChange={(e) => setSelectedSpaceId(e.target.value)} required>
                <option value="">Scegli un posto...</option>
                {availableSpaces.map(space => {
                  let label = '';
                  const isPaid = String(space.number).toLowerCase().includes('pagamento');

                  if (isPaid) {
                    label = ''; 
                  } else if (space.isFixed === false) {
                    label = '(Chiedere prima conferma)';
                  }

                  return (
                    <option key={space.id} value={space.id}>
                      {space.number} {label}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <div className="no-spaces-message">
              <p>Nessun parcheggio disponibile per questa data.</p>
            </div>
          )}

          {showRequestButton && availableSpaces.length > 0 && (
            <div className="no-spaces-message">
                <p>Non ci sono più parcheggi liberi disponibili.</p>
                <p>Puoi chiedere alle Business Manager se il loro è disponibile,</p>
                <p>segnalare che parcheggerai a Pagamento,</p>
                <p>oppure puoi inviare una richiesta agli altri utenti per cedere il loro posto.</p>
            </div>
          )}
          
          {error && <p className="error-message">{error}</p>}
          
          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={handleClose}>Annulla</button>
            
            {(availableSpaces.length > 0 && !userHasBookingOnDate) && (
              <button type="submit" className="submit-btn" disabled={!selectedSpaceId || loading}>
                {loading ? <div className="spinner-small"></div> : 'Conferma'}
              </button>
            )}

            {/* --- 2. MODIFICA CONDIZIONE: Aggiungiamo il controllo sul parcheggio selezionato --- */}
            {showRequestButton && (!selectedSpace || selectedSpace.isFixed !== false) && (
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