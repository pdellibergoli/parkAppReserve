import React from 'react';
import Modal from './Modal';
import './UserAssignmentsModal.css';

const UserAssignmentsModal = ({ isOpen, onClose, user, userAssignments, spaceMap, windowDays = 30 }) => {
  if (!user) return null;

  // Funzione per calcolare la data di inizio (N giorni lavorativi fa)
  const getStartDate = (days) => {
    let date = new Date();
    date.setHours(0, 0, 0, 0);
    let count = 0;
    while (count < days) {
      date.setDate(date.getDate() - 1);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Esclude Domenica (0) e Sabato (6)
        count++;
      }
    }
    return date;
  };

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const startDate = getStartDate(windowDays);

  // Filtriamo le richieste nel periodo lavorativo e ordiniamo per data decrescente
  const filteredRequests = [...userAssignments]
    .filter(req => {
      const reqDate = new Date(req.requestedDate);
      // Solo richieste tra startDate e oggi, escludendo le cancellate
      return reqDate >= startDate && reqDate <= today && req.status !== 'cancelled_by_user';
    })
    .sort((a, b) => new Date(b.requestedDate) - new Date(a.requestedDate));

  // Conteggio effettivo dei parcheggi ottenuti (stato assigned) nel periodo
  const countAssigned = filteredRequests.filter(r => r.status === 'assigned').length;

  const getStatusStyle = (status) => {
    switch (status) {
      case 'assigned': return { label: 'Assegnato', color: '#28a745' };
      case 'not_assigned': return { label: 'Non Assegnato', color: '#dc3545' };
      case 'pending': return { label: 'In attesa', color: '#6c757d' };
      default: return { label: status, color: '#333' };
    }
  };

  const formatDate = (date) => date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Storico: ${user.firstName} ${user.lastName}`}>
      <div className="user-assignments-container">
        <div className="user-summary">
           <p className="period-info">
             Periodo: <strong>{formatDate(startDate)}</strong> - <strong>{formatDate(today)}</strong>
           </p>
           <p>Parcheggi ottenuti: <strong>{countAssigned}</strong></p>
        </div>
        
        {filteredRequests.length === 0 ? (
          <p className="no-data">Nessuna richiesta nel periodo considerato.</p>
        ) : (
          <ul className="assignments-list">
            {filteredRequests.map((req) => {
              const statusInfo = getStatusStyle(req.status);
              const dateObj = new Date(req.requestedDate);
              const formattedDate = dateObj.toLocaleDateString('it-IT', {
                weekday: 'short', day: '2-digit', month: '2-digit'
              });

              return (
                <li key={req.requestId || req.id} className="assignment-item">
                  <div className="req-main-info">
                    <span className="date">{formattedDate}</span>
                    <span className="status-badge" style={{ backgroundColor: statusInfo.color }}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <span className="space-info">
                    {req.status === 'assigned' 
                      ? `Posto: ${req.assignedParkingSpaceNumber || (spaceMap && spaceMap.get(req.assignedParkingSpaceId)) || 'N/D'}` 
                      : '-'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
};

export default UserAssignmentsModal;