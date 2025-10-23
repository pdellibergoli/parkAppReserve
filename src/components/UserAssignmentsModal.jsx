import React from 'react';
import Modal from './Modal';
import { format } from 'date-fns';
import './UserAssignmentsModal.css';
import { getTextColor } from '../utils/colors';

// Avatar simile a quello della StatsPage
const ModalAvatar = ({ user }) => {
  const getInitials = () => {
    if (!user) return '?';
    if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
    return user.firstName ? user.firstName[0] : 'U';
  };
  const backgroundColor = user.avatarColor || '#DE1F3C';
  const textColor = getTextColor(backgroundColor);
  return <div className="modal-avatar" style={{ backgroundColor, color: textColor }}>{getInitials()}</div>;
};

const UserAssignmentsModal = ({ isOpen, onClose, user, userAssignments, spaceMap }) => {
  if (!isOpen || !user || !userAssignments) {
    return null;
  }

  const sortedAssignments = [...userAssignments].sort((a, b) => new Date(b.assignmentDate) - new Date(a.assignmentDate));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dettaglio Assegnazioni">
      <div className="user-assignments-modal">
        {/* Header della Modale */}
        <div className="modal-user-header">
          <div className="user-info-left">
             <ModalAvatar user={user} />
             <span className="modal-user-name">{user.firstName} {user.lastName}</span>
          </div>
          <span className="modal-total-assignments">
            Totale: {userAssignments.length} assegnazioni
          </span>
        </div>

        {/* Lista delle Assegnazioni */}
        {/* ---- ASSICURATI CHE QUESTO DIV ABBIA LA CLASSE ---- */}
        <div className="assignments-list-container">
          {sortedAssignments.length > 0 ? (
            <ul className="assignments-list">
              {sortedAssignments.map((assignment, index) => (
                <li key={assignment.assignmentDate + index} className="assignment-item">
                  <span className="assignment-date">
                    {format(new Date(assignment.assignmentDate), 'dd/MM/yyyy')}
                  </span>
                  <span className="assignment-space">
                    {spaceMap.get(assignment.parkingSpaceId) || 'N/A'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-assignments-message">Nessuna assegnazione trovata per questo utente nel periodo selezionato.</p>
          )}
        </div>
        {/* ---- FINE CONTENITORE ---- */}

         <div className="modal-actions">
            <button className="submit-btn" onClick={onClose}>Chiudi</button>
          </div>
      </div>
    </Modal>
  );
};

export default UserAssignmentsModal;