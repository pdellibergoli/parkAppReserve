import React, { useState, useMemo } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { getTextColor } from '../utils/colors';
import { fetchQuery, prioritiesQuery, referenceQuery, tokenConfigQuery, userHistoryQuery } from '../services/queries';
import { useQuery } from '../hooks/useQuery';
import { useAuth } from '../context/useAuth';
import { useLoading } from '../context/useLoading';
import { callApi } from '../services/api';
import UserAssignmentsModal from '../components/UserAssignmentsModal';
import Modal from '../components/Modal';
import { TokenIcon } from '../components/TokenIcon';
import { FaCog, FaCoins } from 'react-icons/fa';
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
  const { user: loggedInUser } = useAuth();
  const { setIsLoading } = useLoading();

  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const priorities = useQuery(prioritiesQuery(selectedDate));
  const reference = useQuery(referenceQuery());
  const tokenConfig = useQuery(tokenConfigQuery(selectedDate));

  const usersWithPriority = priorities.data ?? EMPTY_LIST;
  const spaces = reference.data?.parkingSpaces ?? EMPTY_LIST;
  const config = tokenConfig.data;
  const loading = priorities.isLoading;
  const error = priorities.error && !priorities.data ? 'Impossibile caricare i dati delle statistiche.' : '';

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedUserForModal, setSelectedUserForModal] = useState(null);
  const [assignmentsForModal, setAssignmentsForModal] = useState([]);

  // Modale admin configurazione data di partenza
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [startDateInput, setStartDateInput] = useState('');
  const [configSaving, setConfigSaving] = useState(false);

  const spaceMap = useMemo(() => new Map(spaces.map(s => [s.id, s.number])), [spaces]);

  const priorityWindowDays = useMemo(() => {
    return config?.totalWorkingDays || (usersWithPriority.length > 0 ? (usersWithPriority[0].totalTokens || 30) : 30);
  }, [config, usersWithPriority]);

  const totalSpaces = spaces.length || 5;

  const sortedUserStats = useMemo(() => {
    if (!usersWithPriority.length) return [];

    const stats = usersWithPriority.map(u => ({
      user: u,
      remainingTokens: u.remainingTokens ?? 0,
      totalTokens: u.totalTokens || priorityWindowDays,
      usedTokens: u.usedTokens ?? 0,
      totalAssignments: u.totalAssignments ?? u.recentAssignments ?? 0,
      totalRequests: u.totalRequests ?? u.recentRequests ?? 0,
      fullName: `${u.firstName} ${u.lastName || ''}`.trim()
    }));

    // Ordinamento: chi ha più gettoni ha la priorità più alta (in cima)
    const sorted = [...stats].sort((a, b) => b.remainingTokens - a.remainingTokens);

    // Previsione della probabilità di assegnazione basata su saldo gettoni e posizione concorrenziale
    return sorted.map((item, index) => {
      const remaining = item.remainingTokens;
      const total = item.totalTokens;
      const higherCount = sorted.filter(s => s.remainingTokens > remaining).length;
      const tokenRatio = total > 0 ? remaining / total : 0;

      let prob;
      if (remaining <= 0) {
        prob = 10;
      } else if (higherCount < totalSpaces) {
        prob = 85 + Math.round(14 * (1 - higherCount / totalSpaces));
      } else {
        const deficit = higherCount - totalSpaces + 1;
        const base = Math.max(15, 80 - (deficit * 8));
        prob = Math.round(base * 0.7 + (tokenRatio * 100) * 0.3);
      }

      const probability = Math.min(99, Math.max(5, prob));

      let levelLabel = 'Media';
      let levelClass = 'prob-medium';
      if (probability >= 80) {
        levelLabel = 'Molto Alta';
        levelClass = 'prob-very-high';
      } else if (probability >= 60) {
        levelLabel = 'Alta';
        levelClass = 'prob-high';
      } else if (probability < 35) {
        levelLabel = 'Bassa';
        levelClass = 'prob-low';
      }

      return {
        ...item,
        rank: index + 1,
        probability,
        levelLabel,
        levelClass,
      };
    });
  }, [usersWithPriority, priorityWindowDays, totalSpaces]);

  const handlePrevQuarter = () => {
    try {
      const cur = new Date(selectedDate);
      const prev = subMonths(cur, 3);
      setSelectedDate(format(prev, 'yyyy-MM-dd'));
    } catch {
      setSelectedDate(format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
    }
  };

  const handleNextQuarter = () => {
    try {
      const cur = new Date(selectedDate);
      const next = addMonths(cur, 3);
      setSelectedDate(format(next, 'yyyy-MM-dd'));
    } catch {
      setSelectedDate(format(addMonths(new Date(), 3), 'yyyy-MM-dd'));
    }
  };

  const handleCurrentQuarter = () => {
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleOpenConfigModal = () => {
    setStartDateInput(config?.configuredStartDate || config?.startDate || '2026-01-01');
    setIsConfigModalOpen(true);
  };

  const handleSaveStartDate = async (e) => {
    if (e) e.preventDefault();
    if (!startDateInput) return;
    setConfigSaving(true);
    try {
      const response = await callApi('setTokenStartDate', { 
        startDate: startDateInput, 
        actorId: loggedInUser?.id,
        userId: loggedInUser?.id
      });
      alert(response.message);
      setIsConfigModalOpen(false);
      setSelectedDate(startDateInput);
      window.location.reload();
    } catch (err) {
      alert(`Errore: ${err.message}`);
    } finally {
      setConfigSaving(false);
    }
  };

  const handleOpenDetailsModal = async (userData) => {
    const userId = userData.user.id;
    setSelectedUserForModal(userData.user);

    setIsLoading(true);
    try {
      const fromDate = config?.effectiveStart || '2026-01-01';
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

  const quarterNumber = config?.quarterNumber || 4;
  const quarterYear = config?.year || new Date().getFullYear();
  const quarterStartLabel = config?.quarterStart ? format(new Date(config.quarterStart), 'dd/MM/yyyy') : '';
  const quarterEndLabel = config?.quarterEnd ? format(new Date(config.quarterEnd), 'dd/MM/yyyy') : '';
  const configuredStartLabel = config?.configuredStartDate ? format(new Date(config.configuredStartDate), 'dd/MM/yyyy') : '';

  return (
    <>
      <div className="stats-container">
        <h1>Statistiche e Gettoni</h1>

        <div className="priority-info-banner token-banner">
          <div className="token-banner-main">
            <FaCoins className="token-banner-icon" />
            <div className="token-banner-content">
              <div className="token-banner-header-row">
                <p className="token-banner-title">
                  <strong>Sistema a Gettoni – Trimestre Q{quarterNumber} {quarterYear}</strong> ({quarterStartLabel} – {quarterEndLabel})
                </p>
                <div className="quarter-nav-controls">
                  <button
                    type="button"
                    className="quarter-nav-btn"
                    onClick={handlePrevQuarter}
                    title="Vai al trimestre precedente"
                  >
                    ◀ Prec
                  </button>
                  <button
                    type="button"
                    className="quarter-nav-btn"
                    onClick={handleNextQuarter}
                    title="Vai al trimestre successivo"
                  >
                    Succ ▶
                  </button>
                  <button
                    type="button"
                    className="quarter-nav-btn quarter-nav-today"
                    onClick={handleCurrentQuarter}
                    title="Torna al trimestre attuale"
                  >
                    Oggi
                  </button>
                </div>
              </div>
              <div className="quarter-date-selector">
                <label htmlFor="quarterDatePicker">Data / Periodo di riferimento:</label>
                <input
                  id="quarterDatePicker"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="quarter-date-input"
                />
              </div>
              <p className="token-banner-desc">
                Ogni utente riceve 1 gettone per giorno lavorativo nel Canton Ticino (esclusi sab/dom e 15 festività ufficiali). 
                Ad ogni parcheggio assegnato viene scalato 1 gettone. I gettoni si ricaricano ogni 3 mesi.
              </p>
              <p className="token-banner-dates">
                Data di partenza configurata: <strong>{configuredStartLabel || 'Inizio anno'}</strong> | Giorni lavorativi periodo: <strong>{priorityWindowDays} gettoni</strong>.
              </p>
            </div>
          </div>
          {loggedInUser?.isAdmin && (
            <div className="token-banner-actions">
              <button className="admin-token-config-btn" onClick={handleOpenConfigModal} title="Modifica data di partenza del sistema">
                <FaCog /> Modifica Data Partenza
              </button>
            </div>
          )}
        </div>

        <h2>Graduatoria Priorità (Gettoni Rimanenti)</h2>
        <p className="subtitle">Chi ha più gettoni rimanenti ottiene per primo il parcheggio.</p>
        
        <div className="stats-grid">
          {sortedUserStats.map((userData) => (
            <div key={userData.user.id} className="user-stat-card" onClick={() => handleOpenDetailsModal(userData)}>
              <div className="card-header">
                <UserAvatar user={userData.user} />
                <div className="user-info">
                  <div className="user-name-row">
                    <span className="user-rank-badge">#{userData.rank}</span>
                    <span className="user-name" title={userData.fullName}>{userData.fullName}</span>
                  </div>
                  <span className="user-tokens-badge">
                    <TokenIcon size={18} /> <strong>{userData.remainingTokens}</strong> <small>/ {userData.totalTokens} gettoni</small>
                  </span>
                </div>
              </div>

              <div className={`card-probability-card ${userData.levelClass}`} title={`Previsione probabilità di assegnazione per ${userData.fullName}: ${userData.probability}% (${userData.levelLabel})`}>
                <div className="prob-label-row">
                  <span className="prob-label-text">Probabilità:</span>
                  <span className="prob-pill">
                    <strong>{userData.probability}%</strong>
                    <span className="prob-pill-divider">•</span>
                    <span>{userData.levelLabel}</span>
                  </span>
                </div>
                <div className="prob-bar-track">
                  <div className="prob-bar-fill" style={{ width: `${Math.max(4, userData.probability)}%` }} />
                </div>
              </div>
              <div className="card-priority-details">
                <div className="priority-row">
                  <span>Richieste (trimestre):</span>
                  <strong>{userData.totalRequests}</strong>
                </div>
                <div className="priority-row">
                  <span>Assegnati (trimestre):</span>
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

      {isConfigModalOpen && (
        <Modal 
          isOpen={isConfigModalOpen} 
          onClose={() => setIsConfigModalOpen(false)} 
          title="Configura Data di Partenza Gettoni"
        >
          <form onSubmit={handleSaveStartDate} className="token-config-form">
            <p style={{ marginBottom: '1rem', color: 'var(--text-color)' }}>
              Seleziona la data ufficiale di partenza per il calcolo dei gettoni per tutti gli utenti:
            </p>
            <div className="token-config-field-group">
              <label htmlFor="tokenStartDateInput" className="token-config-label">
                Data di partenza:
              </label>
              <input 
                id="tokenStartDateInput"
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="token-config-date-input"
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="cancel-btn"
                onClick={() => setIsConfigModalOpen(false)}
                disabled={configSaving}
                style={{ padding: '0.6rem 1.2rem', cursor: 'pointer' }}
              >
                Annulla
              </button>
              <button 
                type="submit" 
                className="submit-btn"
                disabled={configSaving || !startDateInput}
                style={{ padding: '0.6rem 1.2rem', cursor: 'pointer' }}
              >
                {configSaving ? <div className="spinner-small"></div> : 'Salva Data'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

export default StatsPage;