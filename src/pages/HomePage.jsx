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
import SendCommunicationModal from '../components/SendCommunicationModal';
import { callApi } from '../services/api';
import { useLoading } from '../context/LoadingContext';
import { useAuth } from '../context/AuthContext';
// --- MODIFICA: Aggiunta FaTimes ---
import { FaCar, FaBullhorn, FaInfoCircle, FaTimes } from 'react-icons/fa';

const locales = { 'it': it };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const areDatesOnSameDay = (first, second) => {
  if (!first || !second) return false;
  return format(new Date(first), 'yyyy-MM-dd') === format(new Date(second), 'yyyy-MM-dd');
};

const HomePage = () => {
  const { handleOpenAddModal, handleOpenEditModal, refreshKey, forceDataRefresh } = useOutletContext();
  const { setIsLoading } = useLoading();
  const { user } = useAuth(); 
  
  const [allRequests, setAllRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [date, setDate] = useState(new Date());

  const [activeBanners, setActiveBanners] = useState([]);
  const [isCommModalOpen, setIsCommModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [requestsData, usersData, bannersData] = await Promise.all([
        callApi('getRequests', {}),
        callApi('getUsersWithPriority'),
        callApi('getActiveCommunication')
      ]);
      setAllRequests(requestsData);
      setUsers(usersData);
      
      if (Array.isArray(bannersData)) {
          setActiveBanners(bannersData);
      } else if (bannersData) {
          setActiveBanners([bannersData]);
      } else {
          setActiveBanners([]);
      }

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
    setSelectedDate(date); 
    setIsDayModalOpen(true);
  };

  // --- NUOVA FUNZIONE: Cancella Banner ---
  const handleDeleteBanner = async (bannerId) => {
    if (window.confirm("Sei sicuro di voler cancellare questa comunicazione?")) {
      setIsLoading(true);
      try {
        await callApi('deleteCommunication', { id: bannerId });
        forceDataRefresh(); // Ricarica la pagina per rimuovere il banner
      } catch (err) {
        alert(`Errore: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };
  // -------------------------------------
  
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

    const myRequestStatus = useMemo(() => {
        if (!user || count === 0) return null;
        const myRequest = requestsOnDay.find(request => request.userId === user.id);
        return myRequest ? myRequest.status : null;
    }, [requestsOnDay, user, count]);
    
    const child = React.Children.only(children);
    return React.cloneElement(
      child,
      {
        onClick: () => handleDayClick(value),
        className: `${child.props.className} rbc-day-bg-clickable ${count > 0 ? 'has-booking-badge' : ''}`,
      },
      <>
        {child.props.children} 
        <div className="day-indicators-container">
            {count > 0 && (
              <div className="booking-badge-container">
                <div className="booking-count-badge">{count}</div>
              </div>
            )}
            {myRequestStatus && (
                <div className="my-request-icon-container">
                    <FaCar className={`my-request-icon status-${myRequestStatus}`} />
                </div>
            )}
        </div>
      </>
    );
  };
  
  const handleEditRequest = (request, actorId = null) => {
    setIsDayModalOpen(false);
    handleOpenEditModal(request, actorId);
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <>
      {activeBanners.length > 0 && (
        <div className="banners-wrapper">
          {activeBanners.map(banner => (
            /* --- MODIFICA: Layout Banner con bottone cancella --- */
            <div key={banner.id} className="communication-banner">
              <div className="banner-content">
                <FaInfoCircle className="banner-icon" />
                <span>{banner.message}</span>
              </div>
              
              {user && user.isAdmin && (
                <button 
                  className="banner-close-btn" 
                  onClick={() => handleDeleteBanner(banner.id)}
                  title="Cancella comunicazione"
                >
                  <FaTimes />
                </button>
              )}
            </div>
            /* --- FINE MODIFICA --- */
          ))}
        </div>
      )}
      
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

      <div className="calendar-legend">
        <div className="legend-item">
          <FaCar className="my-request-icon status-assigned" />
          <span>Richiesta Assegnata</span>
        </div>
        <div className="legend-item">
          <FaCar className="my-request-icon status-pending" />
          <span>Richiesta In Attesa</span>
        </div>
        <div className="legend-item">
          <FaCar className="my-request-icon status-not_assigned" />
          <span>Richiesta Non Assegnata</span>
        </div>
      </div>

      <button className="add-booking-btn" onClick={handleOpenAddModal}>+ Invia richiesta</button>
      
      {user && user.isAdmin && (
        <button className="admin-comm-btn" onClick={() => setIsCommModalOpen(true)} title="Invia Comunicazione">
            <FaBullhorn />
        </button>
      )}

      <DayRequestsModal
        isOpen={isDayModalOpen}
        onClose={() => setIsDayModalOpen(false)}
        requests={requestsForSelectedDay}
        selectedDate={selectedDate}
        users={users}
        onEdit={handleEditRequest}
        onRefreshData={forceDataRefresh}
      />

      <SendCommunicationModal 
        isOpen={isCommModalOpen} 
        onClose={() => setIsCommModalOpen(false)} 
      />
    </>
  );
};

export default HomePage;