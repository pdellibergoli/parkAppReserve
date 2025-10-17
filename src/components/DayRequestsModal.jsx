import React from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
// MODIFICA: Rimuoviamo 'it'
import { format, isBefore, startOfToday } from 'date-fns';
import { getTextColor } from '../utils/colors';
import { FaPencilAlt, FaTrashAlt } from 'react-icons/fa';
import './DayRequestsModal.css';

const Avatar = ({ user }) => {
    const getInitials = () => {
        if (!user) return '...';
        if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
        return user.firstName ? user.firstName[0] : 'U';
    };
    const backgroundColor = user.avatarColor || '#DE1F3C';
    const textColor = getTextColor(backgroundColor);
    return <div className="day-booking-avatar" style={{ backgroundColor, color: textColor }}>{getInitials()}</div>;
};

const DayRequestsModal = ({ isOpen, onClose, requests, users, onEdit, onCancel, onCancelAssignment }) => {
    const { user: loggedInUser } = useAuth();

    if (!isOpen || !requests || requests.length === 0) return null;

    // MODIFICA FORMATO DATA QUI
    const date = format(new Date(requests[0].requestedDate), 'dd/MM/yyyy');

    const getStatusText = (status) => {
        switch (status) {
            case 'pending': return 'In attesa';
            case 'assigned': return 'Assegnato';
            case 'not_assigned': return 'Non assegnato';
            case 'cancelled_by_user': return 'Annullato da te';
            default: return status;
        }
    };

    const today = startOfToday();

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Richieste del ${date}`}>
            <div className="day-bookings-list">
                {requests.map(request => {
                    const requestUser = users.find(u => u.id === request.userId);
                    const isMyRequest = requestUser && loggedInUser.id === requestUser.id;
                    const requestDate = new Date(request.requestedDate);
                    const isPast = isBefore(requestDate, today);

                    const canBeManaged = isMyRequest && request.status === 'pending' && !isPast;
                    const canBeCancelled = isMyRequest && request.status === 'assigned' && !isPast;
                    
                    const statusText = getStatusText(request.status);

                    return (
                        <div key={request.requestId} className="booking-card">
                            <div className="card-main-info">
                                {requestUser && <Avatar user={requestUser} />}
                                <div className="card-details">
                                    <span className="user-name">{requestUser ? `${requestUser.firstName} ${requestUser.lastName}` : 'Utente non trovato'}</span>
                                    <span className="parking-spot">
                                        Stato: <strong>{statusText}</strong>
                                        {request.status === 'assigned' && ` - Posto: ${request.assignedParkingSpaceNumber}`}
                                    </span>
                                </div>
                            </div>

                            <div className="card-actions">
                                {canBeManaged && (
                                    <>
                                        <button className="icon-btn edit-btn" onClick={() => onEdit(request)} title="Modifica richiesta">
                                            <FaPencilAlt />
                                        </button>
                                        <button className="icon-btn delete-btn" onClick={() => onCancel(request.requestId)} title="Cancella richiesta">
                                            <FaTrashAlt />
                                        </button>
                                    </>
                                )}
                                {canBeCancelled && (
                                    <button className="icon-btn delete-btn" onClick={() => onCancelAssignment(request.requestId)} title="Annulla assegnazione">
                                        <FaTrashAlt />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
};

export default DayRequestsModal;