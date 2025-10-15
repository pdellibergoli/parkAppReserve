import React, { useState, useEffect, useMemo } from 'react';
import { callApi } from '../services/api';
import { subDays, subMonths, startOfDay, endOfDay, format } from 'date-fns';
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
  const [allData, setAllData] = useState({ history: [], users: [], spaces: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterType, setFilterType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        // MODIFICA: Carichiamo lo storico delle assegnazioni
        const [history, users, spaces] = await Promise.all([
          callApi('getAssignmentHistory'),
          callApi('getUsers'),
          callApi('getParkingSpaces')
        ]);
        setAllData({ history, users, spaces });
      } catch (err) {
        setError("Impossibile caricare i dati delle statistiche.");
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);
  
  useEffect(() => {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      const tempStart = startDate;
      setStartDate(endDate);
      setEndDate(tempStart);
    }
  }, [startDate, endDate]);
  
  const handleStartDateChange = (dateValue) => {
    setStartDate(dateValue);
    if (dateValue && !endDate) {
      setEndDate(dateValue);
    }
    setFilterType('custom');
  };

  const handleEndDateChange = (dateValue) => {
    setEndDate(dateValue);
    if(dateValue && !startDate) {
        setStartDate(dateValue);
    }
    setFilterType('custom');
  };

  const statsData = useMemo(() => {
    // MODIFICA: Usiamo 'history' invece di 'bookings'
    const { history, users, spaces } = allData;
    if (!users.length || !spaces.length) return [];

    let filteredHistory = history;

    // La logica di filtraggio per data ora usa 'assignmentDate'
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
        if (start > end) [start, end] = [end, start];
        
        filteredHistory = history.filter(h => {
          const assignmentDate = new Date(h.assignmentDate);
          return assignmentDate >= start && assignmentDate <= end;
        });
      }
    }

    const spaceMap = new Map(spaces.map(s => [s.id, s.number]));
    
    // Il calcolo delle statistiche ora si basa sullo storico filtrato
    const userStats = users.map(user => {
      const userAssignments = filteredHistory.filter(h => h.userId === user.id);
      const totalAssignments = userAssignments.length;
      
      const parkingCounts = userAssignments.reduce((acc, currentAssignment) => {
        const spaceName = spaceMap.get(currentAssignment.parkingSpaceId) || 'Sconosciuto';
        acc[spaceName] = (acc[spaceName] || 0) + 1;
        return acc;
      }, {});

      const sortedParkingCounts = Object.entries(parkingCounts)
        .sort(([, countA], [, countB]) => countB - countA);

      return { user, totalAssignments, parkingCounts: sortedParkingCounts };
    })
    .sort((a,b) => b.totalAssignments - a.totalAssignments);

    return userStats;

  }, [allData, filterType, startDate, endDate]);

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <div className="stats-container">
      <h1>Statistiche di Assegnazione</h1>
      <p>Visualizza il numero totale di parcheggi assegnati a ogni utente e il dettaglio per singolo posto.</p>

      <div className="filters-container">
        <div className="filter-buttons">
          <button onClick={() => setFilterType('all')} className={filterType === 'all' ? 'active' : ''}>Sempre</button>
          <button onClick={() => setFilterType('week')} className={filterType === 'week' ? 'active' : ''}>Ultimi 7 giorni</button>
          <button onClick={() => setFilterType('month')} className={filterType === 'month' ? 'active' : ''}>Ultimo mese</button>
        </div>
        <div className="custom-date-filter">
        <span>Dal </span><input type="date" value={startDate} onChange={e => handleStartDateChange(e.target.value)} />
        <span>Al </span><input type="date" value={endDate} onChange={e => handleEndDateChange(e.target.value)} />
        </div>
      </div>

      <div className="stats-grid">
        {statsData.map(({ user, totalAssignments, parkingCounts }) => (
          <div key={user.id} className="user-stat-card">
            <div className="card-header">
              <UserAvatar user={user} />
              <div className="user-info">
                <span className="user-name">{user.firstName} {user.lastName}</span>
                <span className="total-bookings">{totalAssignments} assegnazioni totali</span>
              </div>
            </div>
            <div className="card-body">
              {totalAssignments > 0 ? (
                <ul className="parking-counts-list">
                  {parkingCounts.map(([spaceName, count]) => (
                    <li key={spaceName}>
                      <span>{spaceName}</span>
                      <span className="count-badge">{count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-bookings-message">Nessuna assegnazione trovata in questo periodo.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsPage;