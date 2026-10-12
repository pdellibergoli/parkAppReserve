import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import it from 'date-fns/locale/it';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './HomePage.css';

import { clearPrioritiesCache } from '../utils/priorityCache';
import { useOutletContext } from 'react-router-dom';
import SendCommunicationModal from '../components/SendCommunicationModal';
import { fetchData as apiFetchData, postData, callApi } from '../services/api';
import { useLoading } from '../context/LoadingContext';
import { useAuth } from '../context/AuthContext';
import { FaCar, FaBullhorn, FaInfoCircle, FaTimes, FaUserShield, FaPlus } from 'react-icons/fa';

// Modali caricate solo quando aperte
const DayRequestsModal = React.lazy(() => import('../components/DayRequestsModal'));
const AdminManuallyAssignModal = React.lazy(() => import('../components/AdminManuallyAssignModal'));

const locales = { 'it': it };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const areDatesOnSameDay = (first, second) => {
  if (!first || !second) return false;
  return format(new Date(first), 'yyyy-MM-dd') === format(new Date(second), 'yyyy-MM-dd');
};

const dayKeyOf = (value) => format(new Date(value), 'yyyy-MM-dd');

// Contenuto condiviso con le celle del calendario.
// Definito a livello di modulo: il wrapper delle celle è lo STESSO tipo di componente
// ad ogni render, così React aggiorna le celle senza smontarle/rimontarle.
const CalendarUIContext = React.createContext(null);

const DateCellWrapper = ({ children, value }) => {
  const ui = React.useContext(CalendarUIContext);
  const child = React.Children.only(children);

  const dayInfo = ui ? ui.days.get(dayKeyOf(value)) : null;
  const count = dayInfo ? dayInfo.count : 0;
  const myRequestStatus = dayInfo ? dayInfo.myStatus : null;

  const baseClass = child.props.className ? `${child.props.className} ` : '';

  return React.cloneElement(
    child,
    {
      onClick: (e) => {
        if (child.props.onClick) child.props.onClick(e);
        if (ui) ui.onDayClick(value);
      },
      className: `${baseClass}rbc-day-bg-clickable${count > 0 ? ' has-booking-badge' : ''}`,
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

// Oggetti costanti: evitano di ricreare props ad ogni render del calendario
const CALENDAR_COMPONENTS = { dateCellWrapper: DateCellWrapper };
const CALENDAR_MESSAGES = { next: "Succ", previous: "Prec", today: "Oggi" };
const CALENDAR_STYLE = { height: '75vh' };

const HomePage = () => {
  const context = useOutletContext() || {};
  const { 
    globalMonthCacheRef, // RECUPERATO DAL CONTESTO
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

  // Usiamo il Ref globale o un fallback locale
  const localCacheRef = useRef({});
  const monthCacheRef = globalMonthCacheRef || localCacheRef;

  // Pulisce le cache in memoria quando c'e una modifica ai dati
  const handleRefreshDataAndCache = useCallback(() => {
    clearPrioritiesCache();
    monthCacheRef.current = {}; 
    if (typeof forceDataRefresh === 'function') {
      forceDataRefresh();
    }
  }, [forceDataRefresh, monthCacheRef]);

  const handleOptimisticUpdate = useCallback((updatedRequest) => {
    if (!updatedRequest) return;
    clearPrioritiesCache();
    monthCacheRef.current = {}; 
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
  }, [monthCacheRef]);

  const handleOptimisticDelete = useCallback((requestIdToDelete) => {
    clearPrioritiesCache();
    monthCacheRef.current = {}; 
    setAllRequests(prev => {
      const array = Array.isArray(prev) ? prev : [];
      return array.filter(r => r.requestId !== requestIdToDelete);
    });
  }, [monthCacheRef]);

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

  const fetchData = useCallback(async (targetDate = date, isForced = false) => {
    const monthKey = format(targetDate, 'yyyy-MM');

    // SE IL MESE È GIÀ SALVATO IN CACHE GLOBALE E NON È UN REFRESH FORZATO: 0 MS!
    if (!isForced && monthCacheRef.current[monthKey]) {
      const cached = monthCacheRef.current[monthKey];
      setAllRequests(cached.requests);
      setUsers(cached.users);
      setActiveBanners(cached.banners);
      setParkingSpaces(cached.parkingSpaces);
      setTemporaryAvailabilities(cached.temporaryAvailabilities);
      setLoading(false);
      return;
    }

    setLoading(true);
    setIsLoading(true);
    setError('');
    try {
      const initialData = await executeApi('getInitialData', { 
        userId: user?.id,
        targetDate: format(targetDate, 'yyyy-MM-dd') 
      });

      const fetchedRequests = initialData?.requests || [];
      const fetchedUsers = initialData?.users || [];
      const fetchedBanners = initialData?.banners || [];
      const fetchedSpaces = initialData?.parkingSpaces || [];
      const fetchedTempAvail = initialData?.temporaryAvailabilities || [];

      setAllRequests(fetchedRequests);
      setUsers(fetchedUsers);
      setActiveBanners(fetchedBanners);
      setParkingSpaces(fetchedSpaces);
      setTemporaryAvailabilities(fetchedTempAvail);

      // SALVA NEL REF GLOBALE
      monthCacheRef.current[monthKey] = {
        requests: fetchedRequests,
        users: fetchedUsers,
        banners: fetchedBanners,
        parkingSpaces: fetchedSpaces,
        temporaryAvailabilities: fetchedTempAvail
      };
    } catch (err) {
      console.error("[HomePage Error]:", err);
      setError('Impossibile caricare i dati.');
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  }, [executeApi, user?.id, date, setIsLoading, monthCacheRef]);

  const handleNavigate = async (newDate) => {
    setDate(newDate);
    await fetchData(newDate); 
  };

  useEffect(() => {
    fetchData(date, false); // Tenta prima di usare la cache globale se disponibile
  }, [refreshKey]);

  // Mappa data -> richieste: calcolata UNA VOLTA per render (invece di 42 filtri per cella)
  const dayMap = useMemo(() => {
    const requestsArray = Array.isArray(allRequests)
      ? allRequests
      : (allRequests?.data && Array.isArray(allRequests.data) ? allRequests.data : []);

    const map = new Map();
    for (const r of requestsArray) {
      if (!r || !r.requestedDate) continue;
      const key = dayKeyOf(r.requestedDate);
      let info = map.get(key);
      if (!info) {
        info = { all: [], count: 0, myStatus: null };
        map.set(key, info);
      }
      info.all.push(r);
      if (r.status !== 'cancelled_by_user') {
        info.count += 1;
        if (user && info.myStatus === null && r.userId === user.id) {
          info.myStatus = r.status;
        }
      }
    }
    return map;
  }, [allRequests, user]);

  // Lookup O(1) per gli utenti (usato nell'ordinamento della modale giorno)
  const usersMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const totalParkingForSelectedDate = useMemo(() => {
    if (!selectedDate) return 0;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const fixedCount = parkingSpaces.filter(s => s.isFixed || s.type === 'fixed').length;
    
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
    if (!selectedDate) return [];

    const dayInfo = dayMap.get(dayKeyOf(selectedDate));
    if (!dayInfo) return [];

    return [...dayInfo.all].sort((a, b) => {
      const nameA = usersMap.get(a.userId)?.firstName || '';
      const nameB = usersMap.get(b.userId)?.firstName || '';
      return nameA.localeCompare(nameB);
    });
  }, [selectedDate, dayMap, usersMap]);

  const handleDayClick = useCallback((clickedDate) => {
    setSelectedDate(clickedDate);
    setIsDayModalOpen(true);
  }, []);

  // Contesto memoizzato: le celle si aggiornano SOLO quando cambiano i dati
  const calendarUIValue = useMemo(
    () => ({ days: dayMap, user, onDayClick: handleDayClick }),
    [dayMap, user, handleDayClick]
  );

  const handleEditRequest = (request, actorId = null) => {
    setIsDayModalOpen(false);
    handleOpenEditModal(request, actorId);
  };

  //if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
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
        <CalendarUIContext.Provider value={calendarUIValue}>
          <Calendar
            localizer={localizer}
            events={[]}
            style={CALENDAR_STYLE}
            culture='it'
            messages={CALENDAR_MESSAGES}
            components={CALENDAR_COMPONENTS}
            date={date}
            view="month"
            onNavigate={handleNavigate}
            views={['month']}
            selectable={true}
            onSelectSlot={(slotInfo) => handleDayClick(slotInfo.start)}
          />
        </CalendarUIContext.Provider>
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

      {isDayModalOpen && (
        <React.Suspense fallback={null}>
          <DayRequestsModal
            isOpen={isDayModalOpen}
            onClose={() => setIsDayModalOpen(false)}
            requests={requestsForSelectedDay}
            selectedDate={selectedDate}
            users={users}
            totalParkingSpaces={totalParkingForSelectedDate}
            onEdit={handleEditRequest}
            onRefreshData={handleRefreshDataAndCache}
            onOptimisticUpdate={handleOptimisticUpdate}
            onOptimisticDelete={handleOptimisticDelete}
          />
        </React.Suspense>
      )}

      <SendCommunicationModal 
        isOpen={isCommModalOpen} 
        onClose={() => setIsCommModalOpen(false)} 
        onBannerCreated={(newBanner) => setActiveBanners(prev => [newBanner, ...prev])} 
      />

      {user?.isAdmin && isAdminAssignOpen && (
        <React.Suspense fallback={null}>
          <AdminManuallyAssignModal 
            isOpen={isAdminAssignOpen}
            onClose={() => setIsAdminAssignOpen(false)}
            onRefreshData={handleRefreshDataAndCache}
            onOptimisticUpdate={handleOptimisticUpdate}
            usersList={users}
            parkingSpaces={parkingSpaces}
          />
        </React.Suspense>
      )}
    </>
  );
};

export default HomePage;