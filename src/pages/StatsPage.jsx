import React, { useState, useEffect, useMemo } from 'react';
import { callApi } from '../services/api';
import { getTextColor } from '../utils/colors';
import UserAssignmentsModal from '../components/UserAssignmentsModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FaTrophy, FaCalendarCheck, FaChartLine, FaInfoCircle } from 'react-icons/fa';
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
  const [allData, setAllData] = useState({ history: [], users: [], spaces: [], requests: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedUserForModal, setSelectedUserForModal] = useState(null);
  const [assignmentsForModal, setAssignmentsForModal] = useState([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [history, users, spaces, requests] = await Promise.all([
          callApi('getAssignmentHistory'),
          callApi('getUsersWithPriority'), 
          callApi('getParkingSpaces'),
          callApi('getRequests', {})
        ]);
        setAllData({ history, users, spaces, requests });
      } catch (err) {
        setError("Impossibile caricare i dati delle statistiche.");
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const spaceMap = useMemo(() => new Map(allData.spaces.map(s => [s.id, s.number])), [allData.spaces]);

  const priorityWindowDays = useMemo(() => {
      if (allData.users && allData.users.length > 0) {
          return allData.users[0].windowDays || 30;
      }
      return 30;
  }, [allData.users]);

  const { userStats, kpiData, chartData } = useMemo(() => {
    const { users, requests } = allData;
    if (!users.length) return { userStats: [], kpiData: {}, chartData: [] };

    const stats = users.map(user => {
      // Usiamo il dato calcolato dal backend per la coerenza dei 30gg
      const totalAssignments = user.recentAssignments || 0;
      
      // Filtriamo le richieste per questo utente per passarle al modale
      const userRequests = requests.filter(r => r.userId === user.id);
      
      return { 
        user, 
        totalAssignments, 
        userAssignments: userRequests,
        fullName: `${user.firstName} ${user.lastName || ''}`.trim()
      }; 
    });

    const sortedForCards = [...stats].sort((a,b) => a.user.successRate - b.user.successRate);
    const sortedForChart = [...stats].sort((a, b) => b.totalAssignments - a.totalAssignments).slice(0, 5);

    const totalAssignmentsOverall = allData.history.length;
    const topUser = sortedForChart.length > 0 ? sortedForChart[0] : null;
    
    const dayCounts = requests.reduce((acc, curr) => {
        if (curr.status !== 'cancelled_by_user') {
            const dateStr = new Date(curr.requestedDate).toLocaleDateString();
            acc[dateStr] = (acc[dateStr] || 0) + 1;
        }
        return acc;
    }, {});
    
    const busiestDateEntry = Object.entries(dayCounts).reduce((a, b) => a[1] > b[1] ? a : b, ["N/D", 0]);

    return {
        userStats: sortedForCards,
        chartData: sortedForChart,
        kpiData: {
            total: totalAssignmentsOverall,
            topUser: topUser ? topUser.fullName : 'Nessuno',
            topUserCount: topUser ? topUser.totalAssignments : 0,
            busiestDay: busiestDateEntry[0],
            busiestDayCount: busiestDateEntry[1]
        }
    };
  }, [allData]);

  const handleOpenDetailsModal = (userData) => {
      setSelectedUserForModal(userData.user);
      setAssignmentsForModal(userData.userAssignments); 
      setIsDetailsModalOpen(true);
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <>
      <div className="stats-container">
        <h1>Statistiche Generali</h1>
        <div className="kpi-grid">
            <div className="kpi-card">
                <div className="kpi-icon blue"><FaChartLine /></div>
                <div className="kpi-content">
                    <h3>Totale Assegnazioni</h3>
                    <p>{kpiData.total}</p>
                    <span>storico assoluto</span>
                </div>
            </div>
            <div className="kpi-card">
                <div className="kpi-icon gold"><FaTrophy /></div>
                <div className="kpi-content">
                    <h3>Utente più Attivo</h3>
                    <p className="small-text">{kpiData.topUser}</p>
                    <span>con {kpiData.topUserCount} parcheggi (30gg)</span>
                </div>
            </div>
            <div className="kpi-card">
                <div className="kpi-icon green"><FaCalendarCheck /></div>
                <div className="kpi-content">
                    <h3>Giorno Record</h3>
                    <p className="small-text">{kpiData.busiestDay}</p>
                    <span>{kpiData.busiestDayCount} richieste</span>
                </div>
            </div>
        </div>

        <div className="chart-section">
            <h2>Top 5 Utenti (Ultimi 30gg)</h2>
            <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="fullName" type="category" width={120} tick={{fontSize: 12}} />
                        <Tooltip cursor={{fill: 'transparent'}} />
                        <Bar dataKey="totalAssignments" name="Assegnazioni" barSize={20} radius={[0, 10, 10, 0]}>
                             {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#DE1F3C' : '#555'} />
                             ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        <h2>Dettaglio Priorità</h2>
        <div className="priority-info-banner">
             <FaInfoCircle />
             <p>Calcolo basato sugli ultimi <strong>{priorityWindowDays} giorni lavorativi</strong>.</p>
        </div>
        
        <div className="stats-grid">
          {userStats.map((userData) => (
              <div key={userData.user.id} className="user-stat-card" onClick={() => handleOpenDetailsModal(userData)}>
                <div className="card-header">
                  <UserAvatar user={userData.user} />
                  <div className="user-info">
                    <span className="user-name">{userData.user.firstName} {userData.user.lastName}</span>
                    <span className="user-priority-rate">Probabilità: <strong>{((1 - userData.user.successRate) * 100).toFixed(0)}%</strong></span>
                  </div>
                </div>
                <div className="card-priority-details">
                    <div className="priority-row">
                        <span>Assegnati (30gg):</span>
                        <strong>{userData.totalAssignments}</strong>
                    </div>
                </div>
                <div className="card-body">
                  <p className="click-details-text">Clicca per storico completo</p>
                </div>
              </div>
          ))}
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