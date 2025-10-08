import React, { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import it from 'date-fns/locale/it';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './HomePage.css';

import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BookingDetailsModal from '../components/BookingDetailsModal';
import { callApi } from '../services/api';
import { useLoading } from '../context/LoadingContext';

const locales = { 'it': it };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const HomePage = () => {
  // Riceve i dati e le funzioni dal MainLayout tramite il "context" dell'Outlet
  const { allBookings, users, parkingSpaces, loading, error, fetchData } = useOutletContext();
  const { setIsLoading } = useLoading();
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  
  // Stati per la navigazione del calendario
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState('month');
  
  const { user } = useAuth();

  // Calcola gli eventi per il calendario basandosi sui dati ricevuti
  const events = useMemo(() => {
    if (loading || error || !allBookings.length) return [];
    
    return allBookings.map(booking => {
      const bookingUser = users.find(u => u.id === booking.userId);
      const parkingSpot = parkingSpaces.find(p => p.id === booking.parkingSpaceId);
      return {
        title: `${parkingSpot?.number || 'N/A'} - ${bookingUser?.firstName || 'Utente'}`,
        start: new Date(booking.date),
        end: new Date(booking.date),
        resource: booking, // Contiene i dati grezzi della prenotazione
      };
    });
  }, [allBookings, users, parkingSpaces, loading, error]);

  const eventStyleGetter = (event) => {
    const isMyBooking = event.resource.userId === user.id;
    return {
      style: {
        backgroundColor: isMyBooking ? '#DE1F3C' : '#e0e0e0',
        borderRadius: '5px',
        color: isMyBooking ? 'white' : 'black',
        border: '2px solid #000000',
        display: 'block',
      },
    };
  };

  const handleOpenDetailsModal = (event) => {
    setSelectedEvent(event);
    setIsDetailsModalOpen(true);
  };
  
  const handleCloseDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleDeleteBooking = async (bookingId) => {
    setIsLoading(true);
    try {
      await callApi('deleteBookings', { bookingIds: [bookingId] });
      fetchData(); // Usa la funzione fetchData ricevuta dal layout per ricaricare
      handleCloseDetailsModal();
    } catch (err) {
      alert(`Errore: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookingUpdated = () => {
    fetchData(); // Usa la funzione fetchData ricevuta dal layout
  };

  const dayPropGetter = (date) => {
    const day = date.getDay(); // 0 = Domenica, 6 = Sabato

    // Se è Sabato o Domenica...
    if (day === 0 || day === 6) {
      // ...restituisci un oggetto 'style' che imposta il colore di sfondo direttamente.
      // Questo ha la priorità su qualsiasi regola CSS esterna.
      return {
        style: {
          backgroundColor: '#f5f5f5', // Grigio chiaro
        },
      };
    }
    // Per tutti gli altri giorni, non facciamo nulla.
    return {};
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
          onSelectEvent={handleOpenDetailsModal}

          dayPropGetter={dayPropGetter}
          
          // Props per la navigazione
          date={date}
          view={view}
          onNavigate={newDate => setDate(newDate)}
          onView={newView => setView(newView)}
        />
      </div>

      <BookingDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={handleCloseDetailsModal} 
        event={selectedEvent}
        users={users}
        parkingSpaces={parkingSpaces}
        allBookings={allBookings} 
        onDelete={handleDeleteBooking}
        onBookingUpdated={handleBookingUpdated} 
      />
    </>
  );
};

export default HomePage;