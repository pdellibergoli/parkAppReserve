import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { getTextColor } from '../utils/colors';
import { fetchQuery, prioritiesQuery, referenceQuery, userHistoryQuery } from '../services/queries';
import { useQuery } from '../hooks/useQuery';
import UserAssignmentsModal from '../components/UserAssignmentsModal';
import { useLoading } from '../context/LoadingContext';
import { FaInfoCircle } from 'react-icons/fa';
import './StatsPage.css';

const EMPTY_LIST = [];

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
  const { setIsLoading } = useLoading();

  const priorities = useQuery(prioritiesQuery());
  const reference = useQuery(referenceQuery());

  const usersWithPriority = priorities.data ?? EMPTY_LIST;
  const spaces = reference.data?.parkingSpaces ?? EMPTY_LIST;
  const loading = priorities.isLoading;
  const error = priorities.error && !priorities.data ? 'Impossibile caricare i dati delle statistiche.' : '';

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedUserForModal, setSelectedUserForModal] = useState(null);
  const [assignmentsForModal, setAssignmentsForModal] = useState([]);

  const spaceMap = useMemo(() => new Map(spaces.map(s => [s.id, s.number])), [spaces]);

  const priorityWindowDays = useMemo(() => {
      return usersWithPriority.length > 0 ? (usersWithPriority[0].windowDays || 30) : 30;
  }, [usersWithPriority]);

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
    if (!usersWithPriority.length) return { userStats: [], startDateLabel: '' };

    const startDate = calculateStartDate(priorityWindowDays);

    const stats = usersWithPriority.map(user => ({
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
  }, [usersWithPriority, priorityWindowDays]);

  const handleOpenDetailsModal = async (userData) => {
      const userId = userData.user.id;
      setSelectedUserForModal(userData.user);

      setIsLoading(true);
      try {
        // La modale mostra solo la finestra di priorità: il resto dello storico non serve
        const fromDate = format(calculateStartDate(priorityWindowDays), 'yyyy-MM-dd');
        const requests = await fetchQuery(userHistoryQuery(userId, fromDate));
        setAssignmentsForModal(requests.filter(r => r.status !== 'cancelled_by_user'));
        setIsDetailsModalOpen(true);
      } catch (err) {
        alert("Errore nel recupero dello storico utente: " + err.message);
      } finally {
        setIsLoading(false);
      }
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