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
    return user.firstName && user.lastName ? `${user.firstName[0]}${user.lastName[0]}` : (user.firstName ? user.firstName[0] : 'U');
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
      return allData.users.length > 0 ? allData.users[0].windowDays : 30;
  }, [allData.users]);

  const calculateStartDate = (days) => {
    let date = new Date();
    date.setHours(0, 0, 0, 0);
    let count = 0;
    while (count < days) {
      date.setDate(date.getDate() - 1);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    }
    return date;
  };

  const { userStats, kpiData, chartData, startDateLabel } = useMemo(() => {
    const { users, requests, history } = allData;
    if (!users.length) return { userStats: [], kpiData: {}, chartData: [], startDateLabel: '' };

    const startDate = calculateStartDate(priorityWindowDays);

    const stats = users.map(user => ({
      user,
      totalAssignments: user.recentAssignments || 0,
      totalRequests: user.recentRequests || 0,
      successRate: user.successRate || 0,
      fullName: `${user.firstName} ${user.lastName || ''}`.trim()
    }));

    const sortedForCards = [...stats].sort((a,b) => a.successRate - b.successRate);
    const sortedForChart = [...stats].sort((a, b) => b.totalAssignments - a.totalAssignments).slice(0, 5);

    const busiestDateEntry = Object.entries(
      requests.reduce((acc, curr) => {
        if (curr.status !== 'cancelled_by_user') {
            const dateStr = new Date(curr.requestedDate).toLocaleDateString();
            acc[dateStr] = (acc[dateStr] || 0) + 1;
        }
        return acc;
      }, {})
    ).reduce((a, b) => a[1] > b[1] ? a : b, ["N/D", 0]);

    return {
        userStats: sortedForCards,
        chartData: sortedForChart,
        startDateLabel: startDate.toLocaleDateString('it-IT'),
        kpiData: {
            total: history.length,
            topUser: sortedForChart[0]?.fullName || 'Nessuno',
            topUserCount: sortedForChart[0]?.totalAssignments || 0,
            busiestDay: busiestDateEntry[0],
            busiestDayCount: busiestDateEntry[1]
        }
    };
  }, [allData, priorityWindowDays]);

  const handleOpenDetailsModal = (userData) => {
      setSelectedUserForModal(userData.user);
      const userReqs = allData.requests.filter(r => r.userId === userData.user.id && r.status !== 'cancelled_by_user');
      setAssignmentsForModal(userReqs); 
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
                    <span>con {kpiData.topUserCount} parcheggi ({priorityWindowDays}gg)</span>
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
            <h2>Top 5 Utenti (Ultimi {priorityWindowDays}gg)</h2>
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
             <p>Calcolo basato dal <strong>{startDateLabel}</strong> ad oggi ({priorityWindowDays} gg lavorativi).</p>
        </div>
        
        <div className="stats-grid">
          {userStats.map((userData) => (
              <div key={userData.user.id} className="user-stat-card" onClick={() => handleOpenDetailsModal(userData)}>
                <div className="card-header">
                  <UserAvatar user={userData.user} />
                  <div className="user-info">
                    <span className="user-name">{userData.fullName}</span>
                    <span className="user-priority-rate">Priorità: <strong>{((1 - userData.successRate) * 100).toFixed(0)}%</strong></span>
                  </div>
                </div>
                <div className="card-priority-details">
                    <div className="priority-row">
                        <span>Richieste (periodo):</span>
                        <strong>{userData.totalRequests}</strong>
                    </div>
                    <div className="priority-row">
                        <span>Assegnati (periodo):</span>
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
        windowDays={priorityWindowDays}
      />
    </>
  );
};

export default StatsPage;