import React, { useState, useMemo } from 'react'; 
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import it from 'date-fns/locale/it';
import { callApi } from '../services/api'; 
import './BookingDetailsModal.css';
import '../components/AddBookingModal.css'; 

// Componente per l'avatar dell'utente, ora accetta e usa un colore personalizzato
const Avatar = ({ user }) => {
  const getInitials = () => {
    if (!user) return '...';
    if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
    return user.firstName ? user.firstName[0] : 'U';
  };
  
  const color = user.avatarColor || '#DE1F3C'; 

  return <div className="detail-avatar" style={{ backgroundColor: color }}>{getInitials()}</div>;
};

const EditBookingModalContent = ({ bookingData, parkingSpaces, allBookings, users, onClose, onBookingUpdated }) => {
  const { user: loggedInUser } = useAuth();

  const originalDate = format(new Date(bookingData.date), 'yyyy-MM-dd');

  const [selectedDate, setSelectedDate] = useState(originalDate);
  const [selectedSpaceId, setSelectedSpaceId] = useState(bookingData.parkingSpaceId);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Calcoliamo i parcheggi disponibili (escludendo la prenotazione corrente per quella data)
  const availableSpaces = useMemo(() => {
    if (!selectedDate) return [];
    
    // 1. Troviamo gli ID dei parcheggi già prenotati nella data selezionata
    const bookedSpaceIds = allBookings
      .filter(booking => 
        format(new Date(booking.date), 'yyyy-MM-dd') === selectedDate && booking.id !== bookingData.id // Escludiamo la prenotazione che stiamo modificando
      )
      .map(booking => booking.parkingSpaceId);
      
    // 2. Filtriamo l'elenco di tutti i parcheggi, tenendo solo quelli non prenotati
    return parkingSpaces.filter(space => !bookedSpaceIds.includes(space.id));

  }, [selectedDate, allBookings, parkingSpaces, bookingData.id]);

  // Controlliamo se l'utente sta cercando di prenotare un altro posto per lo stesso giorno
  const userHasOtherBookingOnDate = useMemo(() => {
    // Verifichiamo se esiste una prenotazione diversa da QUESTA prenotazione
    return allBookings.some(booking => 
      format(new Date(booking.date), 'yyyy-MM-dd') === selectedDate && 
      booking.userId === loggedInUser.id &&
      booking.id !== bookingData.id
    );
  }, [selectedDate, allBookings, loggedInUser.id, bookingData.id]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSpaceId) {
      setError("Per favore, seleziona un parcheggio.");
      return;
    }

    // Se l'utente ha già un'altra prenotazione per quel giorno
    if (userHasOtherBookingOnDate) {
        setError("Hai già un'altra prenotazione per questo giorno. Non puoi modificarla in questa data.");
        return;
    }
    
    // Verifichiamo se i dati sono cambiati prima di chiamare l'API
    if (selectedDate === originalDate && selectedSpaceId === bookingData.parkingSpaceId) {
        setError("Nessuna modifica rilevata.");
        return;
    }

    setError('');
    setLoading(true);

    try {
      const updatedData = {
        bookingId: bookingData.id,
        date: selectedDate,
        parkingSpaceId: selectedSpaceId,
      };
      
      // Chiamata API per aggiornare la prenotazione
      await callApi('updateBooking', updatedData); 
      onBookingUpdated(); // Aggiorna il calendario in HomePage
    } catch (err) {
      setError(err.message || 'Si è verificato un errore durante la modifica.');
    } finally {
      setLoading(false);
    }
  };

  const currentSpace = parkingSpaces.find(p => p.id === selectedSpaceId);
  const isFormValid = selectedSpaceId && !userHasOtherBookingOnDate && !loading;

  return (
    <div className="add-booking-form"> {/* Usiamo la classe della modale di Aggiunta per lo stile */}
      <p>Modifica la tua prenotazione per il {format(new Date(bookingData.date), 'EEEE dd MMMM yyyy', { locale: it })}.</p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="booking-date">Data</label>
          <input
            type="date"
            id="booking-date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              // Se il parcheggio attuale non è disponibile nella nuova data, lo resettiamo.
              if (!availableSpaces.some(s => s.id === selectedSpaceId) && availableSpaces.length > 0) {
                 setSelectedSpaceId('');
              }
            }}
            min={format(new Date(), 'yyyy-MM-dd')} // Non si può prenotare nel passato
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="parking-space">Parcheggio</label>
          <select
              id="parking-space"
              value={selectedSpaceId}
              onChange={(e) => setSelectedSpaceId(e.target.value)}
              required
              // Se l'utente ha un'altra prenotazione quel giorno, disabilitiamo la selezione del parcheggio (non può cambiare)
              disabled={userHasOtherBookingOnDate}
          >
              
              <option value="" disabled>
              {availableSpaces.length > 0 ? 'Scegli un posto...' : 'Nessun posto disponibile'}
              </option>

              {/* Manteniamo l'opzione attualmente selezionata se non è disponibile, per non perderla finché non si cambia data */}
              {currentSpace && !availableSpaces.some(s => s.id === currentSpace.id) && (
                <option value={currentSpace.id} disabled>
                    {currentSpace.number} (Attualmente non disponibile o selezionato)
                </option>
              )}
              
              {availableSpaces
                .map(space => (
                  <option key={space.id} value={space.id}>
                    {space.number} 
                    {space.id === bookingData.parkingSpaceId && selectedDate === originalDate ? ' (Attuale)' : ''}
                  </option>
              ))}
          </select>
          {userHasOtherBookingOnDate && <p className="warning-message">Hai già un'altra prenotazione per il giorno selezionato.</p>}
        </div>

        {error && <p className="error-message">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onClose} disabled={loading}>Annulla</button>
          <button type="submit" className="submit-btn" disabled={!isFormValid}>
            {loading ? <div className="spinner-small"></div> : 'Salva Modifiche'}
          </button>
        </div>
      </form>
    </div>
  );
};

const BookingDetailsModal = ({ isOpen, onClose, event, users, parkingSpaces, allBookings, onDelete, onBookingUpdated }) => {
  const { user: loggedInUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false); 

  if (!isOpen || !event) return null;

  const bookingData = event.resource;
  const bookingUser = users.find(u => u.id === bookingData.userId);
  const parkingSpot = parkingSpaces.find(p => p.id === bookingData.parkingSpaceId);

  const isMyBooking = bookingUser && loggedInUser.id === bookingUser.id;

  const handleDelete = () => {
    if (window.confirm('Sei sicuro di voler cancellare questa prenotazione?')) {
      onDelete(bookingData.id);
    }
  };
  
  // Funzione per chiudere sia la modale di dettaglio che il form di modifica
  const handleClose = () => {
      setIsEditing(false); 
      onClose();
  }
  
  // Gestisce la chiusura del form di modifica e torna alla vista dettagli
  const handleCancelEdit = () => {
      setIsEditing(false);
  }

  // Contenuto della modale basato sullo stato isEditing
  let modalTitle = isEditing ? 'Modifica Prenotazione' : 'Dettagli Prenotazione';
  let modalBody;

  if (isEditing) {
      modalBody = (
          <EditBookingModalContent
            bookingData={bookingData}
            parkingSpaces={parkingSpaces}
            allBookings={allBookings}
            users={users}
            onClose={handleCancelEdit} // Al "Cancel" torniamo alla vista dettagli
            onBookingUpdated={() => { // Quando l'aggiornamento ha successo
                onBookingUpdated(); 
                handleClose(); // Chiudiamo la modale principale
            }}
          />
      );
  } else {
    // Vista Dettagli Originale
    modalBody = bookingUser && parkingSpot ? (
        <div className="booking-details">
          <div className="user-info">
            <Avatar user={bookingUser} />
            <span className="user-name">{bookingUser.firstName} {bookingUser.lastName}</span>
          </div>
          <div className="detail-row">
            <strong>Parcheggio:</strong>
            <span>{parkingSpot.number}</span>
          </div>
          <div className="detail-row">
            <strong>Data:</strong>
            <span>{format(new Date(bookingData.date), 'EEEE dd MMMM yyyy', { locale: it })}</span>
          </div>
          
          {isMyBooking && (
            <div className="modal-actions">
              <button className="edit-btn" onClick={() => setIsEditing(true)}>Modifica</button> {/* Apre il form di modifica */}
              <button className="delete-btn" onClick={handleDelete}>Cancella</button>
            </div>
          )}
        </div>
      ) : (
        <p>Caricamento dettagli...</p>
      );
  }
  
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle}>
      {modalBody}
    </Modal>
  );
};

export default BookingDetailsModal;