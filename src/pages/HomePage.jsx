// src/pages/HomePage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import it from 'date-fns/locale/it';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './HomePage.css';

import { callApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import BookingDetailsModal from '../components/BookingDetailsModal';
import AddBookingModal from '../components/AddBookingModal'; // <-- IMPORTIAMO LA NUOVA MODALE

const locales = { 'it': it };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const HomePage = () => {
  const [events, setEvents] = useState([]);
  const [allBookings, setAllBookings] = useState([]); // Stato per le prenotazioni grezze
  const [users, setUsers] = useState([]);
  const [parkingSpaces, setParkingSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Stati per le modali
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); // <-- STATO PER LA NUOVA MODALE

  const { user } = useAuth();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [bookingsData, usersData, spacesData] = await Promise.all([
        callApi('getBookings'),
        callApi('getUsers'),
        callApi('getParkingSpaces'),
      ]);

      setUsers(usersData);
      setParkingSpaces(spacesData);
      setAllBookings(bookingsData); // <-- SALVIAMO I DATI GREZZI

      const calendarEvents = bookingsData.map(booking => {
        const bookingUser = usersData.find(u => u.id === booking.userId);
        const parkingSpot = spacesData.find(p => p.id === booking.parkingSpaceId);
        return {
          title: `${parkingSpot?.number || 'N/A'} - ${bookingUser?.firstName || 'Utente'}`,
          start: new Date(booking.date),
          end: new Date(booking.date),
          resource: booking,
        };
      });
      setEvents(calendarEvents);
    } catch (err) {
      setError('Impossibile caricare i dati delle prenotazioni. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setIsDetailsModalOpen(true);
  };
  
  const handleDeleteBooking = async (bookingId) => {
    try {
      await callApi('deleteBookings', { bookingIds: [bookingId] });
      // Aggiorniamo entrambi gli stati per mantenere la consistenza
      setEvents(prev => prev.filter(event => event.resource.id !== bookingId));
      setAllBookings(prev => prev.filter(booking => booking.id !== bookingId));
      setIsDetailsModalOpen(false);
    } catch (err) {
      alert(`Errore: ${err.message}`);
    }
  };

  const handleBookingAdded = (newBooking) => {
    // Aggiorniamo gli stati per riflettere la nuova prenotazione senza ricaricare la pagina
    const bookingUser = users.find(u => u.id === newBooking.userId);
    const parkingSpot = parkingSpaces.find(p => p.id === newBooking.parkingSpaceId);

    const newCalendarEvent = {
        title: `${parkingSpot?.number || 'N/A'} - ${bookingUser?.firstName || 'Utente'}`,
        start: new Date(newBooking.date),
        end: new Date(newBooking.date),
        resource: { ...newBooking, parkingSpaceNumber: parkingSpot.number },
    };

    setEvents(prev => [...prev, newCalendarEvent]);
    setAllBookings(prev => [...prev, { ...newBooking, parkingSpaceNumber: parkingSpot.number }]);
  };


  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <>
      <div className="calendar-container">
        <Calendar
          localizer={localizer}
          events={events}
          // ... altre props del calendario ...
          onSelectEvent={handleSelectEvent}
          // ... etc ...
        />
        {/* Il pulsante ora apre la modale di aggiunta */}
        <button className="add-booking-btn" onClick={() => setIsAddModalOpen(true)}>+</button>
      </div>

      <BookingDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        event={selectedEvent}
        users={users}
        parkingSpaces={parkingSpaces}
        onDelete={handleDeleteBooking}
      />

      {/* RENDERIZZIAMO LA NUOVA MODALE */}
      <AddBookingModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onBookingAdded={handleBookingAdded}
        parkingSpaces={parkingSpaces}
        allBookings={allBookings}
      />
    </>
  );
};

export default HomePage;