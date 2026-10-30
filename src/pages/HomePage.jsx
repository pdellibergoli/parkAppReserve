import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import it from 'date-fns/locale/it';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './HomePage.css';

import { addMonths } from 'date-fns';
import { useOutletContext } from 'react-router-dom';
import { callApi } from '../services/api';
import { invalidateData } from '../services/dataStore';
import { applyRequestDelete, applyRequestUpdate, monthQuery, prefetch, referenceQuery } from '../services/queries';
import { useQuery } from '../hooks/useQuery';
import { useLoading } from '../context/LoadingContext';
import { useAuth } from '../context/AuthContext';
import { FaCar, FaBullhorn, FaInfoCircle, FaTimes, FaUserShield, FaPlus } from 'react-icons/fa';

// Modali caricate solo quando aperte
const DayRequestsModal = React.lazy(() => import('../components/DayRequestsModal'));
const AdminManuallyAssignModal = React.lazy(() => import('../components/AdminManuallyAssignModal'));
const SendCommunicationModal = React.lazy(() => import('../components/SendCommunicationModal'));

const locales = { 'it': it };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const EMPTY_LIST = [];

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
  const { handleOpenAddModal, handleOpenEditModal } = useOutletContext() || {};

  const { setIsLoading } = useLoading();
  const { user } = useAuth();

  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [date, setDate] = useState(new Date());

  const [isCommModalOpen, setIsCommModalOpen] = useState(false);
  const [isAdminAssignOpen, setIsAdminAssignOpen] = useState(false);

  const reference = useQuery(referenceQuery());
  const month = useQuery(monthQuery(date));

  const users = reference.data?.users ?? EMPTY_LIST;
  const parkingSpaces = reference.data?.parkingSpaces ?? EMPTY_LIST;
  const activeBanners = reference.data?.banners ?? EMPTY_LIST;
  const allRequests = month.data?.requests ?? EMPTY_LIST;
  const temporaryAvailabilities = month.data?.temporaryAvailabilities ?? EMPTY_LIST;
  const temporaryUnavailabilities = month.data?.temporaryUnavailabilities ?? EMPTY_LIST;

  const isFirstLoad = reference.isLoading || month.isLoading;
  const error = (reference.error && !reference.data) || (month.error && !month.data)
    ? 'Impossibile caricare i dati.'
    : '';

  // L'overlay compare solo se non c'è nulla da mostrare: gli aggiornamenti in background sono invisibili
  useEffect(() => {
    if (!isFirstLoad) return undefined;
    setIsLoading(true);
    return () => setIsLoading(false);
  }, [isFirstLoad, setIsLoading]);

  // Il mese successivo è il più consultato per le nuove richieste
  const monthLoaded = !month.isLoading;
  useEffect(() => {
    if (monthLoaded) prefetch(monthQuery(addMonths(date, 1)));
  }, [monthLoaded, date]);

  const handleNavigate = (newDate) => setDate(newDate);

  // Mappa data -> richieste: calcolata UNA VOLTA per render (invece di 42 filtri per cella)
  const dayMap = useMemo(() => {
    const map = new Map();
    for (const r of allRequests) {
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

    // Posti fissi
    const fixedSpaces = parkingSpaces.filter(s => s.isFixed || s.type === 'fixed');

    // Posti fissi disabilitati per questa data
    const disabledFixedSpaceIds = new Set(
      temporaryUnavailabilities
        .filter(u => {
          if (!u || !u.unavailableDate) return false;
          const unavailDateStr = format(new Date(u.unavailableDate), 'yyyy-MM-dd');
          return unavailDateStr === dateStr;
        })
        .map(u => u.parkingSpaceId)
    );

    const activeFixedCount = fixedSpaces.filter(s => !disabledFixedSpaceIds.has(s.id)).length;
    
    // Posti non fissi con disponibilità temporanea per questa data
    const tempCount = temporaryAvailabilities.filter(a => {
      if (!a || !a.availableDate) return false;
      const availDateStr = format(new Date(a.availableDate), 'yyyy-MM-dd');
      return availDateStr === dateStr;
    }).length;

    return activeFixedCount + tempCount;
  }, [selectedDate, parkingSpaces, temporaryAvailabilities, temporaryUnavailabilities]);

  const handleDeleteBanner = async (bannerId) => {
    if (window.confirm("Sei sicuro di voler cancellare questa comunicazione?")) {
      setIsLoading(true);
      try {
        await callApi('deleteCommunication', { id: bannerId });
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
            onRefreshData={invalidateData}
            onOptimisticUpdate={applyRequestUpdate}
            onOptimisticDelete={applyRequestDelete}
          />
        </React.Suspense>
      )}

      {isCommModalOpen && (
        <React.Suspense fallback={null}>
          <SendCommunicationModal
            isOpen={isCommModalOpen}
            onClose={() => setIsCommModalOpen(false)}
          />
        </React.Suspense>
      )}

      {user?.isAdmin && isAdminAssignOpen && (
        <React.Suspense fallback={null}>
          <AdminManuallyAssignModal 
            isOpen={isAdminAssignOpen}
            onClose={() => setIsAdminAssignOpen(false)}
            onRefreshData={invalidateData}
            onOptimisticUpdate={applyRequestUpdate}
            usersList={users}
            parkingSpaces={parkingSpaces}
          />
        </React.Suspense>
      )}
    </>
  );
};

export default HomePage;