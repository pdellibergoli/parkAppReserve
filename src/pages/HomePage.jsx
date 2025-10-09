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
import DayBookingsModal from '../components/DayBookingsModal';
import { callApi } from '../services/api';
import { useLoading } from '../context/LoadingContext';

const locales = { 'it': it };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// Funzione helper per confrontare le date in modo sicuro, ignorando fuso orario e orario
const areDatesOnSameDay = (first, second) => {
  if (!first || !second) return false;
  return format(first, 'yyyy-MM-dd') === format(second, 'yyyy-MM-dd');
};

const HomePage = () => {
  const { allBookings, users, parkingSpaces, loading, error, fetchData, handleOpenEditModal, handleOpenAddModal } = useOutletContext();
  const { setIsLoading } = useLoading();
  
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [date, setDate] = useState(new Date());

  const dayPropGetter = (date) => {
    const day = date.getDay();
    if (day === 0 || day === 6) {
      return { className: 'weekend-day-bg' }; // Usiamo una classe per lo stile
    }
    return {};
  };

  const handleDayClick = (date) => {
    setSelectedDate(date);
    setIsDayModalOpen(true);
  };
  
  const bookingsForSelectedDay = useMemo(() => {
    if (!selectedDate || !allBookings || !parkingSpaces) return [];
    
    return allBookings
      .filter(b => b.date && areDatesOnSameDay(new Date(b.date), selectedDate))
      .map(booking => {
          const space = parkingSpaces.find(s => s.id === booking.parkingSpaceId);
          return { ...booking, parkingSpaceNumber: space ? space.number : 'N/A' };
      })
      .sort((a, b) => {
          const numA = parseInt(String(a.parkingSpaceNumber).replace(/\D/g, ''), 10) || 0;
          const numB = parseInt(String(b.parkingSpaceNumber).replace(/\D/g, ''), 10) || 0;
          return numA - numB;
      });
  }, [selectedDate, allBookings, parkingSpaces]);

  const handleDeleteBooking = async (bookingId) => {
    if (window.confirm('Sei sicuro di voler cancellare questa prenotazione?')) {
        setIsLoading(true);
        try {
            await callApi('deleteBookings', { bookingIds: [bookingId] });
            fetchData();
            setIsDayModalOpen(false); // Chiudiamo la modale dopo la cancellazione
        } catch (err) {
            alert(`Errore: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }
  };

  const handleEditBooking = (booking) => {
    setIsDayModalOpen(false); // Chiudiamo la modale dei dettagli del giorno
    handleOpenEditModal(booking); // Apriamo la modale di modifica (dal MainLayout)
  };

  
  const CustomDateCellWrapper = ({ children, value }) => {
    const bookingsOnDay = useMemo(() => 
      allBookings.filter(b => b.date && areDatesOnSameDay(new Date(b.date), value)),
      [allBookings, value]
    );
    const count = bookingsOnDay.length;
    
    // Cloniamo l'elemento figlio originale (il contenitore della cella)
    // e aggiungiamo le nostre modifiche senza rompere la struttura.
    const child = React.Children.only(children);
    return React.cloneElement(
      child,
      {
        onClick: () => handleDayClick(value),
        className: `${child.props.className} rbc-day-bg-clickable ${count > 0 ? 'has-booking-badge' : ''}`,
      },
      <>
        {child.props.children}
        {count > 0 && (
          <div className="booking-badge-container">
            <div className="booking-count-badge">{count}</div>
          </div>
        )}
      </>
    );
  };

  
  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <>
      <div className="calendar-container">
        <Calendar
          localizer={localizer}
          events={[]}
          style={{ height: '75vh' }}
          culture='it'
          messages={{ next: "Succ", previous: "Prec", today: "Oggi" }}
          dayPropGetter={dayPropGetter}
          components={{
            dateCellWrapper: CustomDateCellWrapper,
          }}
          date={date}
          view="month" // Imposta la vista fissa a 'month'
          onNavigate={newDate => setDate(newDate)}
          views={['month']}
          selectable
        />
      </div>

      <button className="add-booking-btn" onClick={handleOpenAddModal}>+ Aggiungi prenotazione</button>
      
      <DayBookingsModal
        isOpen={isDayModalOpen}
        onClose={() => setIsDayModalOpen(false)}
        date={selectedDate}
        bookings={bookingsForSelectedDay}
        users={users}
        parkingSpaces={parkingSpaces}
        onDelete={handleDeleteBooking}
        onEdit={handleEditBooking}
      />
    </>
  );
};

export default HomePage;