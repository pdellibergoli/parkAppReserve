// src/pages/HomePage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import it from 'date-fns/locale/it';

// Assicurati che questo import sia presente!
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './HomePage.css';

import { callApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import BookingDetailsModal from '../components/BookingDetailsModal';
import AddBookingModal from '../components/AddBookingModal';

const locales = { 'it': it };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const HomePage = () => {
  const [events, setEvents] = useState([]);
  const [allBookings, setAllBookings] = useState([]); // Aggiunto per passare al BookingDetailsModal
  const [users, setUsers] = useState([]);
  const [parkingSpaces, setParkingSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Stati per la navigazione del calendario
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState('month');

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
      setAllBookings(bookingsData); // Salva tutte le prenotazioni

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

  const eventStyleGetter = (event) => {
    const isMyBooking = event.resource.userId === user.id;
    return {
      style: {
        backgroundColor: isMyBooking ? '#DE1F3C' : '#3174ad',
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setIsDetailsModalOpen(true);
  };

  const handleDeleteBooking = async (bookingId) => {
    try {
      await callApi('deleteBookings', { bookingIds: [bookingId] });
      fetchData(); // Ricarica i dati
      setIsDetailsModalOpen(false);
    } catch (err) {
      alert(`Errore: ${err.message}`);
    }
  };
  
  // Funzione per ricaricare i dati dopo l'aggiunta o la MODIFICA
  const handleBookingAddedOrUpdated = () => {
    fetchData(); 
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <>
      <div className="calendar-container">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '75vh' }}
          culture='it'
          messages={{ next: "Succ", previous: "Prec", today: "Oggi", month: "Mese", week: "Settimana", day: "Giorno" }}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          
          // Props per la navigazione
          date={date}
          view={view}
          onNavigate={newDate => setDate(newDate)}
          onView={newView => setView(newView)}
        />
        <button className="add-booking-btn" onClick={() => setIsAddModalOpen(true)}>+</button>
      </div>

      <BookingDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        event={selectedEvent}
        users={users}
        parkingSpaces={parkingSpaces}
        allBookings={allBookings} // PASSATO per la logica di modifica
        onDelete={handleDeleteBooking}
        onBookingUpdated={handleBookingAddedOrUpdated} // PASSATO per il refresh dopo modifica
      />

      <AddBookingModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onBookingAdded={handleBookingAddedOrUpdated} // Aggiornato per coerenza
        parkingSpaces={parkingSpaces}
        allBookings={allBookings}
      />
    </>
  );
};

export default HomePage;