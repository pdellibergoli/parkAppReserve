import React from 'react';
import Modal from './Modal';
import './UserAssignmentsModal.css';

const UserAssignmentsModal = ({ isOpen, onClose, user, userAssignments, spaceMap }) => {
  if (!user) return null;

  // Filtriamo le richieste degli ultimi 30 giorni e ordiniamo per data decrescente
  const last30DaysRequests = [...userAssignments]
    .filter(req => {
      const reqDate = new Date(req.requestedDate);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return reqDate >= thirtyDaysAgo && req.status !== 'cancelled_by_user';
    })
    .sort((a, b) => new Date(b.requestedDate) - new Date(a.requestedDate));

  // Conteggio effettivo dei parcheggi ottenuti (stato assigned) negli ultimi 30gg
  const countAssigned = last30DaysRequests.filter(r => r.status === 'assigned').length;

  const getStatusStyle = (status) => {
    switch (status) {
      case 'assigned': return { label: 'Assegnato', color: '#28a745' };
      case 'not_assigned': return { label: 'Non Assegnato', color: '#dc3545' };
      case 'pending': return { label: 'In attesa', color: '#6c757d' };
      default: return { label: status, color: '#333' };
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Storico: ${user.firstName} ${user.lastName}`}>
      <div className="user-assignments-container">
        <div className="user-summary">
           <p>Parcheggi ottenuti (ultimi 30 gg): <strong>{countAssigned}</strong></p>
        </div>
        
        {last30DaysRequests.length === 0 ? (
          <p className="no-data">Nessuna richiesta negli ultimi 30 giorni.</p>
        ) : (
          <ul className="assignments-list">
            {last30DaysRequests.map((req) => {
              const statusInfo = getStatusStyle(req.status);
              const dateObj = new Date(req.requestedDate);
              const formattedDate = dateObj.toLocaleDateString('it-IT', {
                weekday: 'short', day: '2-digit', month: '2-digit'
              });

              return (
                <li key={req.requestId} className="assignment-item">
                  <div className="req-main-info">
                    <span className="date">{formattedDate}</span>
                    <span className="status-badge" style={{ backgroundColor: statusInfo.color }}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <span className="space-info">
                    {req.status === 'assigned' 
                      ? `Posto: ${req.assignedParkingSpaceNumber || spaceMap.get(req.assignedParkingSpaceId) || 'N/D'}` 
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