// src/pages/MyBookingsPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { callApi } from '../services/api';
import { format } from 'date-fns';
import it from 'date-fns/locale/it';
import './MyBookingsPage.css';

const MyBookingsPage = () => {
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBookings, setSelectedBookings] = useState([]); // Array di ID selezionati

  const { user } = useAuth();

  const fetchMyBookings = useCallback(async () => {
    try {
      setLoading(true);
      // Recuperiamo tutte le prenotazioni e i parcheggi
      const [allBookings, allSpaces] = await Promise.all([
        callApi('getBookings'),
        callApi('getParkingSpaces')
      ]);

      // Filtriamo per l'utente corrente e ordiniamo per data
      const userBookings = allBookings
        .filter(booking => booking.userId === user.id)
        .map(booking => {
          const space = allSpaces.find(s => s.id === booking.parkingSpaceId);
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

  const handleDeleteSelected = async () => {
    if (selectedBookings.length === 0) return;

    if (window.confirm(`Sei sicuro di voler cancellare ${selectedBookings.length} prenotazione/i?`)) {
      try {
        await callApi('deleteBookings', { bookingIds: selectedBookings });
        // Ricarichiamo la lista dopo la cancellazione
        fetchMyBookings();
        setSelectedBookings([]); // Svuotiamo la selezione
      } catch (err) {
        alert(`Errore durante la cancellazione: ${err.message}`);
      }
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <div className="my-bookings-container">
      <div className="page-header">
        <h1>Le mie prenotazioni</h1>
        <button 
          className="delete-selected-btn" 
          onClick={handleDeleteSelected}
          disabled={selectedBookings.length === 0}
        >
          Cancella Selezionati ({selectedBookings.length})
        </button>
      </div>

      {myBookings.length === 0 ? (
        <p>Non hai nessuna prenotazione attiva.</p>
      ) : (
        <ul className="bookings-list">
          {myBookings.map(booking => (
            <li key={booking.id} className={selectedBookings.includes(booking.id) ? 'selected' : ''}>
              <div className="checkbox-container">
                <input 
                  type="checkbox" 
                  id={`cb-${booking.id}`} 
                  checked={selectedBookings.includes(booking.id)}
                  onChange={() => handleSelectBooking(booking.id)}
                />
                 <label htmlFor={`cb-${booking.id}`}></label>
              </div>
              <div className="booking-info">
                <span className="booking-date">{format(new Date(booking.date), 'EEEE dd MMMM yyyy', { locale: it })}</span>
                <span className="booking-space">Parcheggio: <strong>{booking.parkingSpaceNumber}</strong></span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MyBookingsPage;