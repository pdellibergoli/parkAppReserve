import React, { useState, useEffect, useMemo } from 'react';
import { callApi } from '../services/api';
import { subDays, subMonths, startOfDay, endOfDay, format } from 'date-fns';
import { getTextColor } from '../utils/colors';
import UserAssignmentsModal from '../components/UserAssignmentsModal'; // 1. Importa la nuova modale
import './StatsPage.css';

// UserAvatar rimane invariato
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

  // 2. Stati per la modale
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedUserForModal, setSelectedUserForModal] = useState(null);
  const [assignmentsForModal, setAssignmentsForModal] = useState([]);


  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
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
  
  // Gestione date range (invariata)
  useEffect(() => {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      const tempStart = startDate; setStartDate(endDate); setEndDate(tempStart);
    }
  }, [startDate, endDate]);
  const handleStartDateChange = (dateValue) => {
    setStartDate(dateValue); if (dateValue && !endDate) setEndDate(dateValue); setFilterType('custom');
  };
  const handleEndDateChange = (dateValue) => {
    setEndDate(dateValue); if(dateValue && !startDate) setStartDate(dateValue); setFilterType('custom');
  };

  // 3. Mappa per i nomi dei parcheggi (spostata qui per passarla alla modale)
  const spaceMap = useMemo(() => new Map(allData.spaces.map(s => [s.id, s.number])), [allData.spaces]);

  // Calcolo dati per le card (ora include le assegnazioni filtrate)
  const statsData = useMemo(() => {
    const { history, users } = allData;
    if (!users.length || !spaceMap.size) return [];

    let filteredHistory = history;
    if (filterType !== 'all') {
      let start, end; const today = new Date();
      if (filterType === 'week') { start = startOfDay(subDays(today, 7)); end = endOfDay(today); }
      else if (filterType === 'month') { start = startOfDay(subMonths(today, 1)); end = endOfDay(today); }
      else if (filterType === 'custom' && startDate && endDate) { start = startOfDay(new Date(startDate)); end = endOfDay(new Date(endDate)); }
      if (start && end) {
        if (start > end) [start, end] = [end, start];
        filteredHistory = history.filter(h => { const d = new Date(h.assignmentDate); return d >= start && d <= end; });
      }
    }
    
    const userStats = users.map(user => {
      const userAssignments = filteredHistory.filter(h => h.userId === user.id); // Lista assegnazioni per l'utente
      const totalAssignments = userAssignments.length;
      const parkingCounts = userAssignments.reduce((acc, curr) => {
        const spaceName = spaceMap.get(curr.parkingSpaceId) || 'Sconosciuto';
        acc[spaceName] = (acc[spaceName] || 0) + 1;
        return acc;
      }, {});
      const sortedParkingCounts = Object.entries(parkingCounts).sort(([, a], [, b]) => b - a);
      
      // Aggiungiamo userAssignments all'oggetto restituito
      return { user, totalAssignments, parkingCounts: sortedParkingCounts, userAssignments }; 
    })
    .sort((a,b) => b.totalAssignments - a.totalAssignments);

    return userStats;
  }, [allData, filterType, startDate, endDate, spaceMap]);

  // 4. Funzione per aprire la modale
  const handleOpenDetailsModal = (userData) => {
      setSelectedUserForModal(userData.user);
      setAssignmentsForModal(userData.userAssignments); // Passa le assegnazioni filtrate
      setIsDetailsModalOpen(true);
  };


  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <>
      <div className="stats-container">
        <h1>Statistiche di Assegnazione</h1>
        <p>Visualizza il numero totale di parcheggi assegnati a ogni utente e il dettaglio per singolo posto.</p>

        {/* Filtri (invariati) */}
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

        {/* Griglia delle card */}
        <div className="stats-grid">
          {/* 5. Aggiungi onClick alla card */}
          {statsData.map((userData) => (
            <div 
              key={userData.user.id} 
              className="user-stat-card" 
              onClick={() => handleOpenDetailsModal(userData)} // Rendi cliccabile
              style={{cursor: 'pointer'}} // Aggiungi cursore per indicare cliccabilità
            >
              <div className="card-header">
                <UserAvatar user={userData.user} />
                <div className="user-info">
                  <span className="user-name">{userData.user.firstName} {userData.user.lastName}</span>
                  <span className="total-bookings">{userData.totalAssignments} assegnazioni totali</span>
                </div>
              </div>
              <div className="card-body">
                {userData.totalAssignments > 0 ? (
                  <ul className="parking-counts-list">
                    {userData.parkingCounts.map(([spaceName, count]) => (
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

      {/* 6. Renderizza la modale */}
      <UserAssignmentsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        user={selectedUserForModal}
        userAssignments={assignmentsForModal}
        spaceMap={spaceMap} // Passa la mappa dei parcheggi
      />
    </>
  );
};

export default StatsPage;