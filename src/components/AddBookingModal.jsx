import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { callApi } from '../services/api';
import { format } from 'date-fns';
import './AddBookingModal.css';

const AddBookingModal = ({ isOpen, onClose, onBookingAdded, parkingSpaces, allBookings, initialBookingData = null }) => {
  const isEditMode = !!initialBookingData;
  const { user } = useAuth();
  
  // Stati iniziali per data e parcheggio
  const [selectedDate, setSelectedDate] = useState(
      isEditMode ? format(new Date(initialBookingData.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [selectedSpaceId, setSelectedSpaceId] = useState(initialBookingData?.parkingSpaceId || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Sincronizza lo stato con i dati iniziali quando il modale si apre
  useEffect(() => {
      if (isOpen && isEditMode) {
          setSelectedDate(format(new Date(initialBookingData.date), 'yyyy-MM-dd'));
          setSelectedSpaceId(initialBookingData.parkingSpaceId);
          setError('');
      } else if (isOpen && !isEditMode) {
          setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
          setSelectedSpaceId('');
          setError('');
      }
  }, [isOpen, initialBookingData, isEditMode]);


  // Calcoliamo i parcheggi disponibili
  const availableSpaces = useMemo(() => {
    if (!selectedDate || !allBookings || !parkingSpaces) return [];
    
    // Filtriamo le prenotazioni attive per la data selezionata
    const bookedSpaceIds = allBookings
      .filter(booking => {
          const isSameDate = format(new Date(booking.date), 'yyyy-MM-dd') === selectedDate;
          const isCurrentBooking = isEditMode && booking.id === initialBookingData.id;
          
          // In modalità modifica, ESCLUDIAMO la prenotazione che stiamo modificando dal controllo di conflitto
          return isSameDate && !isCurrentBooking;
      })
      .map(booking => booking.parkingSpaceId);
      
    // Filtriamo l'elenco di tutti i parcheggi, tenendo solo quelli non prenotati
    return parkingSpaces.filter(space => !bookedSpaceIds.includes(space.id));

  }, [selectedDate, allBookings, parkingSpaces, isEditMode, initialBookingData]);

  // Controlliamo se l'utente ha già una prenotazione per il giorno scelto (solo rilevante in Add Mode)
  const userHasBookingOnDate = useMemo(() => {
      // In Edit Mode, questo controllo è bypassato, poiché si sta modificando la propria prenotazione.
      if (isEditMode) return false; 
      
      return allBookings.some(booking => 
        format(new Date(booking.date), 'yyyy-MM-dd') === selectedDate && booking.userId === user.id
      );
  }, [selectedDate, allBookings, user.id, isEditMode]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSpaceId) {
      setError("Per favore, seleziona un parcheggio.");
      return;
    }
    
    // Controllo specifico per Add Mode
    if (userHasBookingOnDate) { 
        setError("Hai già una prenotazione per questo giorno. Non puoi aggiungerne un'altra.");
        return;
    }

    // Controlli specifici per la Modifica
    if (isEditMode) {
        const originalDate = format(new Date(initialBookingData.date), 'yyyy-MM-dd');
        if (selectedDate === originalDate && selectedSpaceId === initialBookingData.parkingSpaceId) {
            setError("Nessuna modifica rilevata.");
            return;
        }
    }

    setError('');
    setLoading(true);

    try {
      if (isEditMode) {
        // Logica di MODIFICA (updateBooking)
        const updatedData = {
            bookingId: initialBookingData.id,
            date: selectedDate,
            parkingSpaceId: selectedSpaceId,
        };
        await callApi('updateBooking', updatedData); 
      } else {
        // Logica di CREAZIONE (createBooking)
        const newBookingData = {
            date: selectedDate,
            parkingSpaceId: selectedSpaceId,
            userId: user.id,
        };
        await callApi('createBooking', newBookingData);
      }
      
      onBookingAdded(); // Funzione di callback per refreshare i dati
      handleClose(); // Chiudiamo e resettiamo la modale
    } catch (err) {
      // Catturiamo errori specifici dal backend, inclusi i conflitti
      const message = err.message || 'Si è verificato un errore.';
      setError(message);
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

  const isFormDisabled = loading || userHasBookingOnDate;


  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isEditMode ? "Modifica Prenotazione" : "Aggiungi Prenotazione"}>
      <form onSubmit={handleSubmit} className="add-booking-form">
        <div className="form-group">
          <label htmlFor="booking-date">Seleziona una data</label>
          <input
            type="date"
            id="booking-date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              // L'uso di useMemo e l'input event gestiscono il reset automatico dello spazio
            }}
            min={format(new Date(), 'yyyy-MM-dd')} // Non si può prenotare nel passato
            required
            disabled={loading}
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
                disabled={isFormDisabled || availableSpaces.length === 0}
            >
                <option value="" disabled>
                {availableSpaces.length > 0 ? 'Scegli un posto...' : 'Nessun posto disponibile'}
                </option>
                
                {/* Mostra l'opzione attualmente selezionata anche se non disponibile, se siamo in modalità modifica */}
                {isEditMode && selectedSpaceId && !availableSpaces.some(s => s.id === selectedSpaceId) && (
                    <option value={selectedSpaceId} disabled>
                        {parkingSpaces.find(s => s.id === selectedSpaceId)?.number} (Non più disponibile)
                    </option>
                )}

                {availableSpaces.map(space => (
                  <option key={space.id} value={space.id}>
                    {space.number}
                    {/* Indicatore visivo della prenotazione attuale per la modifica */}
                    {isEditMode && space.id === initialBookingData.parkingSpaceId && format(new Date(initialBookingData.date), 'yyyy-MM-dd') === selectedDate && ' (Attuale)'}
                  </option>
                ))}
            </select>
            </div>
        )}

        {error && <p className="error-message">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={handleClose}>Annulla</button>
          <button type="submit" className="submit-btn" disabled={isFormDisabled || loading}>
            {loading ? <div className="spinner-small"></div> : (isEditMode ? 'Salva Modifiche' : 'Conferma Prenotazione')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddBookingModal;