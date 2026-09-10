import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { callApi } from '../services/api';
import { getTextColor } from '../utils/colors';
import UserAssignmentsModal from '../components/UserAssignmentsModal';
import { FaInfoCircle } from 'react-icons/fa';
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
  const context = useOutletContext() || {};
  const { sharedUsers = [], sharedSpaces = [], sharedRequests = [] } = context;

  // Stato per i dati caricati via API solo in caso di fallback (es. F5)
  const [fetchedData, setFetchedData] = useState({ users: [], spaces: [], requests: [] });
  const [loading, setLoading] = useState(sharedUsers.length === 0);
  const [error, setError] = useState('');

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedUserForModal, setSelectedUserForModal] = useState(null);
  const [assignmentsForModal, setAssignmentsForModal] = useState([]);

  // Se i dati sono in memoria usa quelli, altrimenti usa quelli scaricati via API
  const allData = useMemo(() => {
    if (sharedUsers.length > 0) {
      return {
        users: sharedUsers,
        spaces: sharedSpaces,
        requests: sharedRequests
      };
    }
    return fetchedData;
  }, [sharedUsers, sharedSpaces, sharedRequests, fetchedData]);

  const hasMemoryData = sharedUsers.length > 0;

  useEffect(() => {
    // Se i dati sono già presenti nel contesto, non fare nulla
    if (hasMemoryData) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [users, spaces, requests] = await Promise.all([
          callApi('getUsersWithPriority'), 
          callApi('getParkingSpaces'),
          callApi('getRequests', {})
        ]);
        if (isMounted) {
          setFetchedData({ users, spaces, requests });
        }
      } catch (err) {
        if (isMounted) {
          setError("Impossibile caricare i dati delle statistiche.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchInitialData();

    return () => {
      isMounted = false;
    };
  }, [hasMemoryData]);

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

  const { userStats, startDateLabel } = useMemo(() => {
    const { users } = allData;
    if (!users.length) return { userStats: [], startDateLabel: '' };

    const startDate = calculateStartDate(priorityWindowDays);

    const stats = users.map(user => ({
      user,
      totalAssignments: user.recentAssignments || 0,
      totalRequests: user.recentRequests || 0,
      successRate: user.successRate || 0,
      fullName: `${user.firstName} ${user.lastName || ''}`.trim()
    }));

    const sortedForCards = [...stats].sort((a, b) => a.successRate - b.successRate);

    return {
        userStats: sortedForCards,
        startDateLabel: startDate.toLocaleDateString('it-IT')
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