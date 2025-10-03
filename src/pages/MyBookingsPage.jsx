import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { callApi } from '../services/api';
import { format } from 'date-fns';
import it from 'date-fns/locale/it';
import './MyBookingsPage.css';

import AddBookingModal from '../components/AddBookingModal'; // Modale riutilizzabile

const MyBookingsPage = () => {
  const [myBookings, setMyBookings] = useState([]);
  const [allBookings, setAllBookings] = useState([]); // Aggiunto: Tutte le prenotazioni per la logica di conflitto
  const [parkingSpaces, setParkingSpaces] = useState([]); // Aggiunto: Tutti i parcheggi
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBookings, setSelectedBookings] = useState([]); 

  // NUOVI STATI PER LA MODIFICA
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState(null); 
  // Fine NUOVI STATI

  const { user } = useAuth(); 

  const fetchMyBookings = useCallback(async () => {
    try {
      setLoading(true);
      // Recuperiamo TUTTI i dati necessari per la modale di modifica
      const [allBookingsData, allSpacesData] = await Promise.all([
        callApi('getBookings'),
        callApi('getParkingSpaces')
      ]);

      setAllBookings(allBookingsData);
      setParkingSpaces(allSpacesData);

      // Filtriamo per l'utente corrente e aggiungiamo il numero del parcheggio per la lista
      const userBookings = allBookingsData
        .filter(booking => booking.userId === user.id)
        .map(booking => {
          const space = allSpacesData.find(s => s.id === booking.parkingSpaceId);
          return { ...booking, parkingSpaceNumber: space ? space.number : 'N/A' };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date)); // Dalla più recente alla più vecchia

      setMyBookings(userBookings);
    } catch (err) {
      setError("Impossibile caricare le tue prenotazioni.");
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchMyBookings();
  }, [fetchMyBookings]);

  const handleSelectBooking = (bookingId) => {
    setSelectedBookings(prev => 
      prev.includes(bookingId) 
        ? prev.filter(id => id !== bookingId) 
        : [...prev, bookingId]
    );
  };

  const handleDeleteSelected = async (bookingIdsToDelete = selectedBookings) => { // Aggiornato per gestire singoli delete
    if (bookingIdsToDelete.length === 0) return;

    if (window.confirm(`Sei sicuro di voler cancellare ${bookingIdsToDelete.length} prenotazione/i?`)) {
      try {
        await callApi('deleteBookings', { bookingIds: bookingIdsToDelete });
        fetchMyBookings();
        setSelectedBookings([]); 
      } catch (err) {
        alert(`Errore durante la cancellazione: ${err.message}`);
      }
    }
  };

  // NUOVE FUNZIONI DI GESTIONE MODALE PER LA MODIFICA
  const handleEdit = (booking) => {
    const bookingDate = new Date(booking.date);
    const today = new Date();
    // Confrontiamo solo la data, ignorando l'orario
    if (bookingDate.setHours(0,0,0,0) < today.setHours(0,0,0,0)) {
        alert("Non è possibile modificare una prenotazione passata.");
        return;
    }
    setBookingToEdit(booking);
    setIsEditModalVisible(true);
  };

  const handleEditSuccess = () => {
      setIsEditModalVisible(false);
      setBookingToEdit(null);
      fetchMyBookings(); // Ricarica la lista dopo la modifica
  };

  const handleEditClose = () => {
      setIsEditModalVisible(false);
      setBookingToEdit(null);
  };
  // Fine NUOVE FUNZIONI

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;
  
  const today = new Date();

  return (
    <>
      <div className="my-bookings-container">
        <div className="page-header">
          <h1>Le mie prenotazioni</h1>
          <button 
            className="delete-selected-btn" 
            onClick={() => handleDeleteSelected()}
            disabled={selectedBookings.length === 0 || loading}
          >
            Cancella Selezionati ({selectedBookings.length})
          </button>
        </div>

        {myBookings.length === 0 ? (
          <p>Non hai nessuna prenotazione attiva.</p>
        ) : (
          <ul className="bookings-list">
            {myBookings.map(booking => {
              const bookingDate = new Date(booking.date);
              // Confrontiamo le date al giorno per determinare se è passata
              const isPast = bookingDate.setHours(0,0,0,0) < today.setHours(0,0,0,0);
              
              return (
                <li key={booking.id} className={selectedBookings.includes(booking.id) ? 'selected' : ''}>
                  <div className="checkbox-container">
                    <input 
                      type="checkbox" 
                      id={`cb-${booking.id}`} 
                      checked={selectedBookings.includes(booking.id)}
                      onChange={() => handleSelectBooking(booking.id)}
                      disabled={loading || isPast} // Disabilita selezione per prenotazioni passate
                    />
                     <label htmlFor={`cb-${booking.id}`}></label>
                  </div>
                  <div className="booking-info">
                    <span className="booking-date">{format(new Date(booking.date), 'EEEE dd MMMM yyyy', { locale: it })}</span>
                    <span className="booking-space">Parcheggio: <strong>{booking.parkingSpaceNumber}</strong></span>
                  </div>
                  {/* PULSANTI AZIONE */}
                  <div className="booking-actions">
                      {!isPast && (
                          <button 
                              onClick={() => handleEdit(booking)} 
                              className="edit-button" 
                              disabled={loading}
                          >
                              Modifica
                          </button>
                      )}
                      <button 
                          onClick={() => handleDeleteSelected([booking.id])} 
                          className="delete-button" 
                          disabled={loading}
                      >
                          Cancella
                      </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      
      {/* MODALE DI MODIFICA (riutilizza AddBookingModal) */}
      <AddBookingModal
          isOpen={isEditModalVisible}
          onClose={handleEditClose}
          onBookingAdded={handleEditSuccess} 
          initialBookingData={bookingToEdit} // Passa i dati per la modalità Edit
          parkingSpaces={parkingSpaces} // Passa tutti i parcheggi
          allBookings={allBookings} // Passa tutte le prenotazioni
      />
    </>
  );
};

export default MyBookingsPage;