import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { callApi } from '../services/api';
import { format, isBefore, startOfToday, isToday, isTomorrow } from 'date-fns';
import { getTextColor } from '../utils/colors';
import { FaPencilAlt, FaTrashAlt, FaLock, FaWrench } from 'react-icons/fa';
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

const AdminActions = ({ selectedDate, onAdminAction, isLoading, hasPendingRequests }) => {
    const now = new Date();
    const isTodaySelected = isToday(selectedDate);
    const isTomorrowSelected = isTomorrow(selectedDate);
    
    const showAssignButton = (isTomorrowSelected || (isTodaySelected && now.getHours() < 9)) && hasPendingRequests;

    const handleAction = async (actionType) => {
        let confirmMessage = "";
        switch (actionType) {
            case 'cancel_requests':
                confirmMessage = "Sei sicuro di voler CANCELLARE tutte le richieste 'In attesa' e 'Non assegnate' per questo giorno? (Le assegnazioni rimarranno)";
                break;
            case 'reset_assignments':
                confirmMessage = "Sei sicuro di voler RESETTARE tutte le assegnazioni per questo giorno? (Tutti torneranno 'In attesa' e lo storico del giorno sarà pulito)";
                break;
            case 'assign_requests':
                confirmMessage = "Sei sicuro di voler AVVIARE l'assegnazione manuale per questo giorno? (Questo processerà solo le richieste 'In attesa')";
                break;
            default:
                return;
        }
        
        if (window.confirm(confirmMessage)) {
            onAdminAction(actionType, selectedDate);
        }
    };

    return (
        <div className="admin-panel">
            <button 
                className="admin-action-btn cancel"
                onClick={() => handleAction('cancel_requests')}
                disabled={isLoading}
            >
                {isLoading ? <div className="spinner-small"></div> : 'Cancella Richieste'}
            </button>
            <button 
                className="admin-action-btn reset"
                onClick={() => handleAction('reset_assignments')}
                disabled={isLoading}
            >
                {isLoading ? <div className="spinner-small"></div> : 'Resetta Assegnazioni'}
            </button>
            {showAssignButton && (
                <button 
                    className="admin-action-btn assign"
                    onClick={() => handleAction('assign_requests')}
                    disabled={isLoading}
                >
                    {isLoading ? <div className="spinner-small"></div> : 'Assegna Richieste'}
                </button>
            )}
        </div>
    );
};

const DayRequestsModal = ({ isOpen, onClose, requests, users, selectedDate, onEdit, onCancel, onRefreshData }) => {
    const { user: loggedInUser } = useAuth();
    const { setIsLoading } = useLoading();
    
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [adminLoading, setAdminLoading] = useState(false);
    const [parkingStatus, setParkingStatus] = useState(null);

    useEffect(() => {
        if (!isOpen) {
            setIsAdminMode(false);
            setParkingStatus(null);
        } else if (selectedDate) {
            const fetchStatus = async () => {
                try {
                    const status = await callApi('getParkingStatusForDate', { date: format(selectedDate, 'yyyy-MM-dd') });
                    setParkingStatus(status);
                } catch (error) {
                    console.error("Errore status parcheggi", error);
                }
            };
            fetchStatus();
        }
    }, [isOpen, selectedDate]);

    const hasPendingRequests = useMemo(() => {
        if (!requests) return false;
        return requests.some(r => r.status === 'pending');
    }, [requests]);

    const sortedRequests = useMemo(() => {
        if (!requests || !users) return [];
        return [...requests].sort((a, b) => {
            if (a.status === 'assigned' && b.status !== 'assigned') return -1;
            if (a.status !== 'assigned' && b.status === 'assigned') return 1;
            
            const userA = users.find(u => u.id === a.userId);
            const userB = users.find(u => u.id === b.userId);
            const rateA = userA?.successRate ?? 1;
            const rateB = userB?.successRate ?? 1;
            return rateA - rateB; 
        });
    }, [requests, users]);

    const handleCancelClick = (request) => {
        const isAssigned = request.status === 'assigned';
        const confirmMsg = `Sei sicuro di voler ${isAssigned ? 'annullare questa assegnazione' : 'cancellare questa richiesta'}?`;
        
        if (window.confirm(confirmMsg)) {
            setIsLoading(true);
            const payload = { requestIds: [request.requestId] };
            if (isAdminMode && request.userId !== loggedInUser.id) {
                payload.actorId = loggedInUser.id;
            }

            callApi('cancelMultipleRequests', payload)
                .then(() => onRefreshData())
                .catch(err => alert(`Errore: ${err.message}`))
                .finally(() => setIsLoading(false));
        }
    };

    const handleEditClick = (request) => {
        const actorId = isAdminMode && request.userId !== loggedInUser.id ? loggedInUser.id : null;
        onEdit(request, actorId);
    };

    const handleAdminAction = async (actionType, date) => {
        setAdminLoading(true);
        setIsLoading(true);
        let apiAction = '';
        
        if (actionType === 'cancel_requests') apiAction = 'adminCancelAllRequestsForDate';
        else if (actionType === 'reset_assignments') apiAction = 'adminResetAssignmentsForDate';
        else if (actionType === 'assign_requests') apiAction = 'adminManuallyAssignForDate';
        
        try {
            const response = await callApi(apiAction, { date: format(date, 'yyyy-MM-dd') });
            alert(response.message);
            onRefreshData();
        } catch (err) {
            alert(`Errore: ${err.message}`);
        } finally {
            setAdminLoading(false);
            setIsLoading(false);
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'pending': return 'In attesa';
            case 'assigned': return 'Assegnato';
            case 'not_assigned': return 'Non assegnato';
            case 'cancelled_by_user': return 'Annullato dall\'utente';
            default: return status;
        }
    };

    if (!isOpen) return null; 

    const dateTitle = selectedDate ? format(selectedDate, 'dd/MM/yyyy') : "Richieste";
    
    // --- MODIFICA QUI: Titolo Custom con logica di caricamento ---
    const customTitle = (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <span style={{ fontSize: '1.1rem' }}>Richieste del {dateTitle}</span>
            
            <div className="status-item" style={{ flexDirection: 'row', gap: '5px', alignItems: 'center' }}>
                <span className="label" style={{ marginBottom: 0 }}>Totale parcheggi disponibili:</span>
                
                {/* Se parkingStatus esiste mostra il numero, altrimenti spinner */}
                {parkingStatus ? (
                    <span className="value" style={{ fontSize: '1rem' }}>{parkingStatus.total}</span>
                ) : (
                    <div className="spinner-small" style={{ 
                        width: '14px', 
                        height: '14px', 
                        borderColor: '#666', 
                        borderTopColor: 'transparent', 
                        borderWidth: '2px' 
                    }}></div>
                )}
            </div>
        </div>
    );
    // --- FINE MODIFICA ---

    const today = startOfToday();
    const requestDateObj = selectedDate || new Date();

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={customTitle}>

            {loggedInUser.isAdmin === true && (
                <div className="admin-controls-wrapper">
                    {!isAdminMode ? (
                        <button className="admin-panel-toggle" onClick={() => setIsAdminMode(true)}>
                            <FaWrench /> Abilita Modifiche Admin
                        </button>
                    ) : (
                        <button className="admin-panel-toggle active" onClick={() => setIsAdminMode(false)}>
                            <FaLock /> Disabilita Modifiche Admin
                        </button>
                    )}
                    
                    {isAdminMode && (
                        <AdminActions 
                            selectedDate={requestDateObj}
                            onAdminAction={handleAdminAction}
                            isLoading={adminLoading}
                            hasPendingRequests={hasPendingRequests}
                        />
                    )}
                </div>
            )}
            
            <div className="day-bookings-list">
                {(!requests || requests.length === 0) ? (
                    <p style={{textAlign: 'center', color: '#666'}}>Nessuna richiesta per questo giorno.</p>
                ) : (
                    sortedRequests.map(request => {
                        const requestUser = users.find(u => u.id === request.userId);
                        const isMyRequest = requestUser && loggedInUser.id === requestUser.id;
                        const requestDate = new Date(request.requestedDate);
                        const isPast = isBefore(requestDate, today);
                        const status = request.status;

                        const canEdit = status === 'pending' && !isPast;
                        const canCancel = (status === 'pending' || status === 'not_assigned' || status === 'assigned') && !isPast;
                        const showEdit = (isMyRequest && canEdit) || (isAdminMode && canEdit);
                        const showCancel = (isMyRequest && canCancel) || (isAdminMode && canCancel);
                        
                        const showProbability = isTomorrow(requestDate) && status === 'pending' && requestUser?.successRate !== undefined;
                        const probabilityPercent = requestUser?.successRate !== undefined ? ((1 - requestUser.successRate) * 100).toFixed(0) : 0;

                        return (
                            <div key={request.requestId} className={`booking-card status-${status}`}>
                                <div className="card-main-info">
                                    {requestUser && <Avatar user={requestUser} />}
                                    <div className="card-details">
                                        <span className="user-name">{requestUser ? `${requestUser.firstName} ${requestUser.lastName}` : 'Utente non trovato'}</span>
                                        <span className="parking-spot">
                                            Stato: <strong>{getStatusText(status)}</strong>
                                            {status === 'assigned' && ` - Posto: ${request.assignedParkingSpaceNumber}`}
                                        </span>
                                        {showProbability && (
                                            <span className="probability-text">
                                                Probabilità di assegnazione: <strong>{probabilityPercent}%</strong>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="card-actions">
                                    {showEdit && (
                                        <button className="icon-btn edit-btn" onClick={() => handleEditClick(request)} title="Modifica">
                                            <FaPencilAlt />
                                        </button>
                                    )}
                                    {showCancel && (
                                        <button className="icon-btn delete-btn" onClick={() => handleCancelClick(request)} title="Cancella">
                                            <FaTrashAlt />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </Modal>
    );
};

export default DayRequestsModal;