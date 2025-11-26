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
    if (!users.length) return []; 

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
      const userAssignments = filteredHistory.filter(h => h.userId === user.id);
      const totalAssignments = userAssignments.length;
      
      const parkingCounts = userAssignments.reduce((acc, curr) => {
        const spaceName = spaceMap.get(curr.parkingSpaceId) || 'Sconosciuto';
        acc[spaceName] = (acc[spaceName] || 0) + 1;
        return acc;
      }, {});
      const sortedParkingCounts = Object.entries(parkingCounts).sort(([, a], [, b]) => b - a);
      
      return { user, totalAssignments, parkingCounts: sortedParkingCounts, userAssignments }; 
    })
    // Ordina per priorità (successRate crescente = 0.0 prima = Alta priorità)
    .sort((a,b) => a.user.successRate - b.user.successRate);

    return userStats;
  }, [allData, filterType, startDate, endDate, spaceMap]);

  const handleOpenDetailsModal = (userData) => {
      setSelectedUserForModal(userData.user);
      setAssignmentsForModal(userData.userAssignments); 
      setIsDetailsModalOpen(true);
  };


  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;

  let filterText = 'totali';
  if (filterType === 'week') filterText = 'ultimi 7 giorni';
  if (filterType === 'month') filterText = 'ultimo mese';
  if (filterType === 'custom' && startDate && endDate) filterText = 'nel periodo';


  return (
    <>
      <div className="stats-container">
        <h1>Statistiche di Assegnazione</h1>
        <p>Visualizza le statistiche degli utenti. Le card sono ordinate per priorità di assegnazione (chi ha una probabilità più alta appare per primo).</p>

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
          {statsData.map((userData) => {
            // --- MODIFICA QUI: Calcolo della Probabilità Inversa ---
            // 1 - successRate ci dà la "sfortuna", che equivale alla priorità futura.
            // Esempio: Tasso storico 0.2 (20%) -> Priorità 0.8 (80%)
            const probabilityPercent = ((1 - userData.user.successRate) * 100).toFixed(0);
            // ------------------------------------------------------

            return (
              <div 
                key={userData.user.id} 
                className="user-stat-card" 
                onClick={() => handleOpenDetailsModal(userData)}
                style={{cursor: 'pointer'}} 
              >
                <div className="card-header">
                  <UserAvatar user={userData.user} />
                  <div className="user-info">
                    <span className="user-name">{userData.user.firstName} {userData.user.lastName}</span>
                    
                    {/* Visualizzazione aggiornata */}
                    <span className="user-priority-rate">
                      Probabilità di assegnazione: <strong>{probabilityPercent}%</strong>
                    </span>
                    
                    <span className="total-bookings">{userData.totalAssignments} assegnazioni ({filterText})</span>
                  </div>
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
            );
          })}
        </div>
      </div>

      <UserAssignmentsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        user={selectedUserForModal}
        userAssignments={assignmentsForModal}
        spaceMap={spaceMap}
      />
    </>
  );
};

export default StatsPage;