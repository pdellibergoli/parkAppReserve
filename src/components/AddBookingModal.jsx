// src/components/AddBookingModal.jsx

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
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Calcoliamo i parcheggi disponibili ogni volta che la data selezionata o le prenotazioni cambiano
  const availableSpaces = useMemo(() => {
    if (!selectedDate) return [];
    
    // 1. Troviamo gli ID dei parcheggi già prenotati nella data selezionata
    const bookedSpaceIds = allBookings
      .filter(booking => format(new Date(booking.date), 'yyyy-MM-dd') === selectedDate)
      .map(booking => booking.parkingSpaceId);
      
    // 2. Filtriamo l'elenco di tutti i parcheggi, tenendo solo quelli non prenotati
    return parkingSpaces.filter(space => !bookedSpaceIds.includes(space.id));

  }, [selectedDate, allBookings, parkingSpaces]);

  // Controlliamo se l'utente ha già una prenotazione per il giorno scelto
  const userHasBookingOnDate = useMemo(() => {
    return allBookings.some(booking => 
      format(new Date(booking.date), 'yyyy-MM-dd') === selectedDate && booking.userId === user.id
    );
  }, [selectedDate, allBookings, user.id]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSpaceId) {
      setError("Per favore, seleziona un parcheggio.");
      return;
    }
    if (userHasBookingOnDate) {
        setError("Hai già una prenotazione per questo giorno. Non puoi aggiungerne un'altra.");
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
      onBookingAdded(createdBooking); // Passiamo la nuova prenotazione al genitore
      handleClose(); // Chiudiamo e resettiamo la modale
    } catch (err) {
      setError(err.message || 'Si è verificato un errore.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleClose = () => {
    // Resettiamo lo stato quando la modale viene chiusa
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
    setSelectedSpaceId('');
    setError('');
    setLoading(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Aggiungi Prenotazione">
      <form onSubmit={handleSubmit} className="add-booking-form">
        <div className="form-group">
          <label htmlFor="booking-date">Seleziona una data</label>
          <input
            type="date"
            id="booking-date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSelectedSpaceId(''); // Resetta il parcheggio quando cambia la data
            }}
            min={format(new Date(), 'yyyy-MM-dd')} // Non si può prenotare nel passato
            required
          />
        </div>

        {userHasBookingOnDate ? (
            <p className="warning-message">Hai già una prenotazione per il giorno selezionato.</p>
        ) : (
            <div className="form-group">
            <label htmlFor="parking-space">Seleziona un parcheggio</label>
            <select
                id="parking-space"
                value={selectedSpaceId}
                onChange={(e) => setSelectedSpaceId(e.target.value)}
                required
                disabled={availableSpaces.length === 0}
            >
                <option value="" disabled>
                {availableSpaces.length > 0 ? 'Scegli un posto...' : 'Nessun posto disponibile'}
                </option>
                {availableSpaces.map(space => (
                <option key={space.id} value={space.id}>{space.number}</option>
                ))}
            </select>
            </div>
        )}

        {error && <p className="error-message">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={handleClose}>Annulla</button>
          <button type="submit" className="submit-btn" disabled={loading || userHasBookingOnDate}>
            {loading ? <div className="spinner-small"></div> : 'Conferma Prenotazione'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddBookingModal;