import React, { useState, useEffect, useMemo } from 'react';
import { callApi } from '../services/api';
import { subDays, subMonths, startOfDay, endOfDay, addDays, format } from 'date-fns';
import { getTextColor } from '../utils/colors';
import './StatsPage.css';

const UserAvatar = ({ user }) => {
  const getInitials = () => {
    if (!user) return '?';
    if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
    return user.firstName ? user.firstName[0] : 'U';
  };
  
  const backgroundColor = user.avatarColor || '#DE1F3C';
  const textColor = getTextColor(backgroundColor);

  return <div className="stat-avatar" style={{ backgroundColor, color: textColor }}>{getInitials()}</div>;
};


const StatsPage = () => {
  const [allData, setAllData] = useState({ bookings: [], users: [], spaces: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterType, setFilterType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [bookings, users, spaces] = await Promise.all([
          callApi('getBookings'),
          callApi('getUsers'),
          callApi('getParkingSpaces')
        ]);
        setAllData({ bookings, users, spaces });
      } catch (err) {
        setError("Impossibile caricare i dati.");
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // --- NUOVO BLOCCO PER SINCRONIZZARE LE DATE ---
  // Questo useEffect si attiva ogni volta che le date cambiano.
  useEffect(() => {
    // Se la data di inizio è successiva a quella di fine, le invertiamo.
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      const tempStart = startDate;
      setStartDate(endDate);
      setEndDate(tempStart);
    }
  }, [startDate, endDate]);
  // --- FINE NUOVO BLOCCO ---
  
  const handleStartDateChange = (dateValue) => {
    setStartDate(dateValue);
    if (dateValue && !endDate) { // Se endDate è vuoto, lo impostiamo uguale a startDate
      setEndDate(dateValue);
    }
    setFilterType('custom');
  };

  const handleEndDateChange = (dateValue) => {
    setEndDate(dateValue);
    if(dateValue && !startDate) { // Se startDate è vuoto, lo impostiamo uguale a endDate
        setStartDate(dateValue);
    }
    setFilterType('custom');
  };

  const statsData = useMemo(() => {
    const { bookings, users, spaces } = allData;
    if (!users.length || !spaces.length) return [];

    let filteredBookings = bookings;

    if (filterType !== 'all') {
      let start, end;
      const today = new Date();

      if (filterType === 'week') {
        start = startOfDay(subDays(today, 7));
        end = endOfDay(today);
      } else if (filterType === 'month') {
        start = startOfDay(subMonths(today, 1));
        end = endOfDay(today);
      } else if (filterType === 'custom' && startDate && endDate) {
        start = startOfDay(new Date(startDate));
        end = endOfDay(new Date(endDate));
      }

      if (start && end) {
        // La logica di inversione per il calcolo non è più strettamente necessaria
        // grazie a useEffect, ma la lasciamo come sicurezza aggiuntiva.
        if (start > end) {
          [start, end] = [end, start];
        }
        filteredBookings = bookings.filter(b => {
          const bookingDate = new Date(b.date);
          return bookingDate >= start && bookingDate <= end;
        });
      }
    }

    const spaceMap = new Map(spaces.map(s => [s.id, s.number]));
    const userStats = users.map(user => {
      const userBookings = filteredBookings.filter(b => b.userId === user.id);
      const totalBookings = userBookings.length;
      
      const parkingCounts = userBookings.reduce((acc, currentBooking) => {
        const spaceName = spaceMap.get(currentBooking.parkingSpaceId) || 'Sconosciuto';
        acc[spaceName] = (acc[spaceName] || 0) + 1;
        return acc;
      }, {});

      const sortedParkingCounts = Object.entries(parkingCounts)
        .sort(([, countA], [, countB]) => countB - countA);

      return { user, totalBookings, parkingCounts: sortedParkingCounts };
    })
    .sort((a,b) => b.totalBookings - a.totalBookings);

    return userStats;

  }, [allData, filterType, startDate, endDate]);

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <div className="stats-container">
      <h1>Statistiche di Utilizzo</h1>
      <p>Visualizza il numero totale di prenotazioni per ogni utente e il dettaglio per singolo parcheggio.</p>

      <div className="filters-container">
        <div className="filter-buttons">
          <button onClick={() => setFilterType('all')} className={filterType === 'all' ? 'active' : ''}>Sempre</button>
          <button onClick={() => setFilterType('week')} className={filterType === 'week' ? 'active' : ''}>Ultimi 7 giorni</button>
          <button onClick={() => setFilterType('month')} className={filterType === 'month' ? 'active' : ''}>Ultimo mese ad oggi</button>
        </div>
        <div className="custom-date-filter">
        <span>Dal </span><input type="date" value={startDate} onChange={e => handleStartDateChange(e.target.value)} />
        <span>Al </span><input type="date" value={endDate} onChange={e => handleEndDateChange(e.target.value)} />
        </div>
      </div>

      <div className="stats-grid">
        {statsData.map(({ user, totalBookings, parkingCounts }) => (
          <div key={user.id} className="user-stat-card">
            <div className="card-header">
              <UserAvatar user={user} />
              <div className="user-info">
                <span className="user-name">{user.firstName} {user.lastName}</span>
                <span className="total-bookings">{totalBookings} prenotazioni totali</span>
              </div>
            </div>
            <div className="card-body">
              {totalBookings > 0 ? (
                <ul className="parking-counts-list">
                  {parkingCounts.map(([spaceName, count]) => (
                    <li key={spaceName}>
                      <span>{spaceName}</span>
                      <span className="count-badge">{count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-bookings-message">Nessuna prenotazione trovata in questo periodo.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsPage;