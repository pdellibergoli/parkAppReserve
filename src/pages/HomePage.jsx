import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import it from 'date-fns/locale/it';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './HomePage.css';

import { useOutletContext } from 'react-router-dom';
import DayRequestsModal from '../components/DayRequestsModal';
import { callApi } from '../services/api';
import { useLoading } from '../context/LoadingContext';

const locales = { 'it': it };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const areDatesOnSameDay = (first, second) => {
  if (!first || !second) return false;
  return format(new Date(first), 'yyyy-MM-dd') === format(new Date(second), 'yyyy-MM-dd');
};

const HomePage = () => {
  const { handleOpenAddModal, handleOpenEditModal, refreshKey, forceDataRefresh } = useOutletContext();
  const { setIsLoading } = useLoading();
  
  const [allRequests, setAllRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [date, setDate] = useState(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [requestsData, usersData] = await Promise.all([
        callApi('getRequests', {}),
        callApi('getUsers'),
      ]);
      setAllRequests(requestsData);
      setUsers(usersData);
    } catch (err) {
      setError('Impossibile caricare i dati. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);
  
  const handleDayClick = (date) => {
    const requestsOnDay = allRequests.filter(r => r.requestedDate && areDatesOnSameDay(new Date(r.requestedDate), date));
    if (requestsOnDay.length > 0) {
        setSelectedDate(date);
        setIsDayModalOpen(true);
    }
  };
  
  const requestsForSelectedDay = useMemo(() => {
    if (!selectedDate || !allRequests) return [];
    
    return allRequests
      .filter(r => r.requestedDate && areDatesOnSameDay(new Date(r.requestedDate), selectedDate))
      .sort((a, b) => {
          const userA = users.find(u => u.id === a.userId);
          const userB = users.find(u => u.id === b.userId);
          return (userA?.firstName || '').localeCompare(userB?.firstName || '');
      });
  }, [selectedDate, allRequests, users]);
  
  const CustomDateCellWrapper = ({ children, value }) => {
    const requestsOnDay = useMemo(() => 
      allRequests.filter(r => r.requestedDate && areDatesOnSameDay(new Date(r.requestedDate), value)),
      [allRequests, value]
    );
    const count = requestsOnDay.length;
    
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
  
  const handleCancelRequest = async (requestId) => {
    if (window.confirm('Sei sicuro di voler cancellare questa richiesta?')) {
        setIsLoading(true);
        try {
            await callApi('cancelRequest', { requestId });
            setIsDayModalOpen(false);
            forceDataRefresh();
        } catch (err) {
            alert(`Errore: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }
  };

  // 1. NUOVA FUNZIONE PER ANNULLARE L'ASSEGNAZIONE
  const handleCancelAssignment = async (requestId) => {
    if (window.confirm('Sei sicuro di voler annullare questa assegnazione e cedere il tuo posto?')) {
        setIsLoading(true);
        try {
            await callApi('cancelAssignmentAndReassign', { requestId });
            setIsDayModalOpen(false); // Chiudi la modale
            forceDataRefresh(); // Ricarica i dati
        } catch (err) {
            alert(`Errore durante l'annullamento: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }
  };

  const handleEditRequest = (request) => {
    setIsDayModalOpen(false);
    handleOpenEditModal(request);
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
          components={{
            dateCellWrapper: CustomDateCellWrapper,
          }}
          date={date}
          view="month"
          onNavigate={newDate => setDate(newDate)}
          views={['month']}
        />
      </div>

      <button className="add-booking-btn" onClick={handleOpenAddModal}>+ Invia richiesta</button>
      
      {/* 2. PASSA LA NUOVA FUNZIONE ALLA MODALE */}
      <DayRequestsModal
        isOpen={isDayModalOpen}
        onClose={() => setIsDayModalOpen(false)}
        requests={requestsForSelectedDay}
        users={users}
        onCancel={handleCancelRequest}
        onEdit={handleEditRequest}
        onCancelAssignment={handleCancelAssignment}
      />
    </>
  );
};

export default HomePage;