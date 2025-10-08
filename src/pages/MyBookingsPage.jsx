import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { callApi } from '../services/api';
import { format } from 'date-fns';
import it from 'date-fns/locale/it';
import './MyBookingsPage.css';


const MyBookingsPage = () => {
  // 2. Ricevi i dati e le funzioni dal MainLayout invece di usare stati locali
  const { allBookings, parkingSpaces, loading, error, fetchData } = useOutletContext();
  const { user } = useAuth();
  const { setIsLoading } = useLoading();

  const [selectedBookings, setSelectedBookings] = useState([]);
  
  // 3. Calcola le prenotazioni dell'utente usando i dati ricevuti dal layout
  const myBookings = useMemo(() => {
    if (!allBookings || !parkingSpaces) return [];
    
    return allBookings
        .filter(booking => booking.userId === user.id)
        .map(booking => {
          const space = parkingSpaces.find(s => s.id === booking.parkingSpaceId);
          return { ...booking, parkingSpaceNumber: space ? space.number : 'N/A' };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [allBookings, parkingSpaces, user.id]);


  const handleDeleteSelected = async (bookingIdsToDelete = selectedBookings) => {
    if (bookingIdsToDelete.length === 0) return;

    if (window.confirm(`Sei sicuro di voler cancellare ${bookingIdsToDelete.length} prenotazione/i?`)) {
      setIsLoading(true);
      try {
        await callApi('deleteBookings', { bookingIds: bookingIdsToDelete });
        fetchData(); // 4. Usa la funzione 'fetchData' del layout per aggiornare i dati globali
        setSelectedBookings([]); 
      } catch (err) {
        alert(`Errore durante la cancellazione: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

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
            disabled={selectedBookings.length === 0}
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
              const isPast = bookingDate.setHours(0,0,0,0) < today.setHours(0,0,0,0);
              
              return (
                <li key={booking.id} className={selectedBookings.includes(booking.id) ? 'selected' : ''}>
                  <div className="checkbox-container">
                    <input 
                      type="checkbox" 
                      id={`cb-${booking.id}`} 
                      checked={selectedBookings.includes(booking.id)}
                      onChange={() => setSelectedBookings(prev => prev.includes(booking.id) ? prev.filter(id => id !== booking.id) : [...prev, booking.id])}
                      disabled={isPast}
                    />
                     <label htmlFor={`cb-${booking.id}`}></label>
                  </div>
                  <div className="booking-info">
                    <span className="booking-date">{format(new Date(booking.date), 'EEEE dd MMMM yyyy', { locale: it })}</span>
                    <span className="booking-space">Parcheggio: <strong>{booking.parkingSpaceNumber}</strong></span>
                  </div>
                  <div className="booking-actions">
                      {/* La logica per la modifica va gestita tramite la modale globale o spostata */}
                      <button 
                          onClick={() => alert("La modifica va fatta dal calendario principale.")} 
                          className="cancel-btn" 
                          disabled={isPast}
                      >
                          Modifica
                      </button>
                      <button 
                          onClick={() => handleDeleteSelected([booking.id])} 
                          className="delete-button" 
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
    </>
  );
};

export default MyBookingsPage;