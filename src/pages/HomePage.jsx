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
import AdminManuallyAssignModal from '../components/AdminManuallyAssignModal'; 
import { fetchData as apiFetchData, postData, callApi } from '../services/api';
import { useLoading } from '../context/LoadingContext';
import { useAuth } from '../context/AuthContext';
import { FaCar, FaBullhorn, FaInfoCircle, FaTimes, FaUserShield, FaPlus } from 'react-icons/fa';

const locales = { 'it': it };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const areDatesOnSameDay = (first, second) => {
  if (!first || !second) return false;
  return format(new Date(first), 'yyyy-MM-dd') === format(new Date(second), 'yyyy-MM-dd');
};

const HomePage = () => {
  const context = useOutletContext() || {};
  const { 
    handleOpenAddModal, 
    handleOpenEditModal, 
    refreshKey, 
    forceDataRefresh,
    registerOptimisticHandlers 
  } = context;

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
  const [isAdminAssignOpen, setIsAdminAssignOpen] = useState(false);

  const [parkingSpaces, setParkingSpaces] = useState([]);
  const [temporaryAvailabilities, setTemporaryAvailabilities] = useState([]);

  const handleOptimisticUpdate = useCallback((updatedRequest) => {
    if (!updatedRequest) return;
    setAllRequests(prev => {
      const array = Array.isArray(prev) ? prev : [];
      
      const index = array.findIndex(r => 
        (r.requestId && r.requestId === updatedRequest.requestId) ||
        (r.userId === updatedRequest.userId && areDatesOnSameDay(r.requestedDate, updatedRequest.requestedDate))
      );

      if (index !== -1) {
        const next = [...array];
        next[index] = { ...next[index], ...updatedRequest };
        return next;
      }
      return [...array, updatedRequest];
    });
  }, []);

  const handleOptimisticDelete = useCallback((requestIdToDelete) => {
    setAllRequests(prev => {
      const array = Array.isArray(prev) ? prev : [];
      return array.filter(r => r.requestId !== requestIdToDelete);
    });
  }, []);

  // REGISTRA I GESTORI SU MAINLAYOUT QUANDO HOMEPAGE SI MONTA
  useEffect(() => {
    if (typeof registerOptimisticHandlers === 'function') {
      registerOptimisticHandlers({
        onUpdate: handleOptimisticUpdate,
        onDelete: handleOptimisticDelete,
        usersList: users,
        allRequests: allRequests
      });
    }
  }, [registerOptimisticHandlers, handleOptimisticUpdate, handleOptimisticDelete, users, allRequests]);

  const executeApi = useCallback(async (action, payload = {}, method = 'POST') => {
    if (typeof callApi === 'function') {
      return await callApi(action, payload, method);
    }
    if (method === 'POST') {
      return await postData(action, payload);
    }
    return await apiFetchData(action, payload);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const initialData = await executeApi('getInitialData', { userId: user?.id });

      setAllRequests(initialData?.requests || []);
      setUsers(initialData?.users || []);
      setActiveBanners(initialData?.banners || []);
      
      setParkingSpaces(initialData?.parkingSpaces || []);
      setTemporaryAvailabilities(initialData?.temporaryAvailabilities || []);
    } catch (err) {
      console.error("[HomePage Error]:", err);
      setError('Impossibile caricare i dati.');
    } finally {
      setLoading(false);
    }
  }, [executeApi, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const handleDayClick = (clickedDate) => {
    setSelectedDate(clickedDate); 
    setIsDayModalOpen(true);
  };

  const totalParkingForSelectedDate = useMemo(() => {
    if (!selectedDate) return 0;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // Contiamo i posti fissi
    const fixedCount = parkingSpaces.filter(s => s.isFixed || s.type === 'fixed').length;
    
    // Contiamo i posti resi disponibili temporaneamente per questa specifica data
    const tempCount = temporaryAvailabilities.filter(a => {
      const availDateStr = format(new Date(a.availableDate), 'yyyy-MM-dd');
      return availDateStr === dateStr;
    }).length;

    return fixedCount + tempCount;
  }, [selectedDate, parkingSpaces, temporaryAvailabilities]);

  const handleDeleteBanner = async (bannerId) => {
    if (window.confirm("Sei sicuro di voler cancellare questa comunicazione?")) {
      setIsLoading(true);
      try {
        await executeApi('deleteCommunication', { id: bannerId }, 'POST');
        setActiveBanners(prev => prev.filter(b => b.id !== bannerId)); 
      } catch (err) {
        alert(`Errore: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  const requestsForSelectedDay = useMemo(() => {
    const requestsArray = Array.isArray(allRequests) 
      ? allRequests 
      : (allRequests?.data && Array.isArray(allRequests.data) ? allRequests.data : []);

    if (!selectedDate || requestsArray.length === 0) return [];

    return requestsArray
      .filter(r => r && r.requestedDate && areDatesOnSameDay(r.requestedDate, selectedDate))
      .sort((a, b) => {
          const userA = users.find(u => u.id === a.userId);
          const userB = users.find(u => u.id === b.userId);
          return (userA?.firstName || '').localeCompare(userB?.firstName || '');
      });
  }, [selectedDate, allRequests, users]);
  
  const CustomDateCellWrapper = ({ children, value }) => {
    const requestsOnDay = useMemo(() => {
      const requestsArray = Array.isArray(allRequests) 
        ? allRequests 
        : (allRequests?.data && Array.isArray(allRequests.data) ? allRequests.data : []);

      return requestsArray.filter(r => 
        r &&
        r.requestedDate && 
        areDatesOnSameDay(r.requestedDate, value) &&
        r.status !== 'cancelled_by_user'
      );
    }, [value]);

    const count = requestsOnDay.length;

    const myRequestStatus = useMemo(() => {
      if (!user || count === 0) return null;
      const myRequest = requestsOnDay.find(request => request.userId === user.id);
      return myRequest ? myRequest.status : null;
    }, [requestsOnDay, count]);
    
    const child = React.Children.only(children);
    return React.cloneElement(
      child,
      {
        onClick: (e) => {
          if (child.props.onClick) child.props.onClick(e);
          handleDayClick(value);
        },
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
            <div key={banner.id} className="communication-banner">
              <div className="banner-content">
                <FaInfoCircle className="banner-icon" />
                <span>{banner.message}</span>
              </div>
              {user?.isAdmin && (
                <button className="banner-close-btn" onClick={() => handleDeleteBanner(banner.id)}>
                  <FaTimes />
                </button>
              )}
            </div>
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
          components={{ dateCellWrapper: CustomDateCellWrapper }}
          date={date}
          view="month"
          onNavigate={newDate => setDate(newDate)}
          views={['month']}
          selectable={true}
          onSelectSlot={(slotInfo) => handleDayClick(slotInfo.start)}
        />
      </div>

      <div className="calendar-legend">
        <div className="legend-item"><FaCar className="my-request-icon status-assigned" /> <span>Assegnata</span></div>
        <div className="legend-item"><FaCar className="my-request-icon status-pending" /> <span>In Attesa</span></div>
        <div className="legend-item"><FaCar className="my-request-icon status-not_assigned" /> <span>Non Assegnata</span></div>
      </div>

      <div className="floating-actions-container">
        {user?.isAdmin && (
          <>
            <button 
              className="floating-btn admin-assign-btn" 
              onClick={() => setIsAdminAssignOpen(true)}
              title="Assegnazione Manuale"
            >
              <FaUserShield /> <span>Assegna Posto</span>
            </button>
            <button 
              className="floating-btn admin-comm-btn-alt" 
              onClick={() => setIsCommModalOpen(true)} 
              title="Invia Comunicazione"
            >
              <FaBullhorn /> <span>Comunicazione</span>
            </button>
          </>
        )}
        <button className="floating-btn add-booking-btn-alt" onClick={handleOpenAddModal}>
          <FaPlus /> <span>Invia richiesta</span>
        </button>
      </div>

      <DayRequestsModal
        isOpen={isDayModalOpen}
        onClose={() => setIsDayModalOpen(false)}
        requests={requestsForSelectedDay}
        selectedDate={selectedDate}
        users={users}
        totalParkingSpaces={totalParkingForSelectedDate}
        onEdit={handleEditRequest}
        onRefreshData={forceDataRefresh}
        onOptimisticUpdate={handleOptimisticUpdate}
        onOptimisticDelete={handleOptimisticDelete}
      />

      <SendCommunicationModal onBannerCreated={(newBanner) => setActiveBanners(prev => [newBanner, ...prev])} />

      {user?.isAdmin && (
        <AdminManuallyAssignModal 
          isOpen={isAdminAssignOpen}
          onClose={() => setIsAdminAssignOpen(false)}
          onRefreshData={forceDataRefresh}
          onOptimisticUpdate={handleOptimisticUpdate}
          usersList={users}
          parkingSpaces={parkingSpaces}
        />
      )}
    </>
  );
};

export default HomePage;