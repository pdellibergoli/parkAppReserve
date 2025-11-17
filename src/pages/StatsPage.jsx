import React, { useState, useEffect, useMemo } from 'react';
import { callApi } from '../services/api';
import { subDays, subMonths, startOfDay, endOfDay, format } from 'date-fns';
import { getTextColor } from '../utils/colors';
import UserAssignmentsModal from '../components/UserAssignmentsModal';
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

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedUserForModal, setSelectedUserForModal] = useState(null);
  const [assignmentsForModal, setAssignmentsForModal] = useState([]);


  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [history, users, spaces] = await Promise.all([
          callApi('getAssignmentHistory'),
          // --- MODIFICA 1: Chiama la nuova funzione API ---
          callApi('getUsersWithPriority'), 
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

  const spaceMap = useMemo(() => new Map(allData.spaces.map(s => [s.id, s.number])), [allData.spaces]);

  const statsData = useMemo(() => {
    const { history, users } = allData;
    if (!users.length) return []; // Non serve più spaceMap.size qui

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
      // I conteggi sulla card (totalAssignments, parkingCounts)
      // rispettano ancora i filtri di data selezionati dall'utente
      const userAssignments = filteredHistory.filter(h => h.userId === user.id);
      const totalAssignments = userAssignments.length;
      
      const parkingCounts = userAssignments.reduce((acc, curr) => {
        // Assicurati che spaceMap sia pronto prima di usarlo
        const spaceName = spaceMap.get(curr.parkingSpaceId) || 'Sconosciuto';
        acc[spaceName] = (acc[spaceName] || 0) + 1;
        return acc;
      }, {});
      const sortedParkingCounts = Object.entries(parkingCounts).sort(([, a], [, b]) => b - a);
      
      // user.successRate (da 0.0 a 1.0) è già calcolato dal backend (ultimi 30gg)
      return { user, totalAssignments, parkingCounts: sortedParkingCounts, userAssignments }; 
    })
    // --- MODIFICA 2: Ordina per priorità (tasso successo crescente) ---
    // Chi ha il tasso più basso (es. 0%) ha più probabilità e appare prima
    .sort((a,b) => a.user.successRate - b.user.successRate);

    return userStats;
  }, [allData, filterType, startDate, endDate, spaceMap]); // Aggiunto spaceMap alle dipendenze

  const handleOpenDetailsModal = (userData) => {
      setSelectedUserForModal(userData.user);
      // Passiamo le assegnazioni filtrate dal periodo selezionato
      setAssignmentsForModal(userData.userAssignments); 
      setIsDetailsModalOpen(true);
  };


  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;

  // Determina il testo del filtro data
  let filterText = 'totali';
  if (filterType === 'week') filterText = 'ultimi 7 giorni';
  if (filterType === 'month') filterText = 'ultimo mese';
  if (filterType === 'custom' && startDate && endDate) filterText = 'nel periodo';


  return (
    <>
      <div className="stats-container">
        <h1>Statistiche di Assegnazione</h1>
        <p>Visualizza le statistiche degli utenti. Le card sono ordinate per priorità di assegnazione (chi ha il tasso di successo più basso ha più probabilità).
          <b> Le assegnazioni si riferiscono alle giornate di overbooking e cosiderano le assegnazioni fatte negli utlimi 30 giorni.</b>
        </p>

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
          {statsData.map((userData) => (
            <div 
              key={userData.user.id} 
              className="user-stat-card" 
              onClick={() => handleOpenDetailsModal(userData)}
              style={{cursor: 'pointer'}} 
            >
              <div className="card-header">
                <UserAvatar user={userData.user} />
                {/* --- MODIFICA 3: Mostra la priorità --- */}
                <div className="user-info">
                  <span className="user-name">{userData.user.firstName} {userData.user.lastName}</span>
                  <span className="user-priority-rate">
                    Priorità (Tasso Successo 30gg): <strong>{`${(userData.user.successRate * 100).toFixed(0)}%`}</strong>
                  </span>
                  <span className="total-bookings">{userData.totalAssignments} assegnazioni ({filterText})</span>
                </div>
                {/* --- FINE MODIFICA 3 --- */}
              </div>
              <div className="card-body">
                {userData.totalAssignments > 0 ? (
                  <ul className="parking-counts-list">
                    {userData.parkingCounts.map(([spaceName, count]) => (
                      <li key={spaceName}>
                        <span>{spaceName || 'Sconosciuto'}</span>
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

      <UserAssignmentsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        user={selectedUserForModal}
        userAssignments={assignmentsForModal} // Passa le assegnazioni filtrate
        spaceMap={spaceMap}
      />
    </>
  );
};

export default StatsPage;