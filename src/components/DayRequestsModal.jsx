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


const DayRequestsModal = ({ isOpen, onClose, requests, users, selectedDate, onEdit, onCancel, onRefreshData }) => { // Rimosso onCancelAssignment dalle props in quanto non usato qui
    const { user: loggedInUser } = useAuth();
    const { setIsLoading } = useLoading();
    
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [adminLoading, setAdminLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setIsAdminMode(false);
        }
    }, [isOpen]);

    const hasPendingRequests = useMemo(() => {
        if (!requests) return false;
        return requests.some(r => r.status === 'pending');
    }, [requests]);

    // --- ORDINAMENTO RICHIESTE (Più probabili in alto) ---
    const sortedRequests = useMemo(() => {
        if (!requests || !users) return [];
        
        return [...requests].sort((a, b) => {
            // 1. Assegnate sempre in cima
            if (a.status === 'assigned' && b.status !== 'assigned') return -1;
            if (a.status !== 'assigned' && b.status === 'assigned') return 1;

            // 2. Ordinamento per probabilità di assegnazione (inversa al tasso di successo storico)
            // Chi ha tasso basso (0.1) ha alta probabilità -> deve venire PRIMA
            const userA = users.find(u => u.id === a.userId);
            const userB = users.find(u => u.id === b.userId);
            
            const rateA = userA?.successRate ?? 1;
            const rateB = userB?.successRate ?? 1;

            return rateA - rateB; // Crescente: 0.0 (Alta Probabilità) -> 1.0 (Bassa Probabilità)
        });
    }, [requests, users]);

    // --- GESTIONE CANCELLAZIONE INTERNA ---
    const handleCancelClick = (request) => {
        const isAssigned = request.status === 'assigned';
        const confirmMsg = `Sei sicuro di voler ${isAssigned ? 'annullare questa assegnazione' : 'cancellare questa richiesta'}?`;
        
        if (window.confirm(confirmMsg)) {
            setIsLoading(true);
            
            const payload = { 
                requestIds: [request.requestId] 
            };
            
            if (isAdminMode && request.userId !== loggedInUser.id) {
                payload.actorId = loggedInUser.id;
            }

            callApi('cancelMultipleRequests', payload)
                .then(() => {
                    onRefreshData(); 
                })
                .catch(err => {
                    alert(`Errore: ${err.message}`);
                })
                .finally(() => {
                    setIsLoading(false);
                });
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
        let successMessage = '';
        
        if (actionType === 'cancel_requests') {
            apiAction = 'adminCancelAllRequestsForDate';
            successMessage = 'Tutte le richieste non assegnate sono state cancellate.';
        } else if (actionType === 'reset_assignments') {
            apiAction = 'adminResetAssignmentsForDate';
            successMessage = 'Tutte le assegnazioni sono state resettate.';
        } else if (actionType === 'assign_requests') {
            apiAction = 'adminManuallyAssignForDate';
        }
        
        try {
            const response = await callApi(apiAction, { date: format(date, 'yyyy-MM-dd') });
            alert(response.message || successMessage);
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
    const today = startOfToday();
    const requestDateObj = selectedDate || (requests && requests.length > 0 ? new Date(requests[0].requestedDate) : new Date());

    if (!requests || requests.length === 0) {
         return (
             <Modal isOpen={isOpen} onClose={onClose} title={`Richieste del ${dateTitle}`}>
                 <p style={{textAlign: 'center', margin: '1rem 0'}}>Nessuna richiesta trovata per questo giorno.</p>
                 
                 {loggedInUser.isAdmin === true && selectedDate && (
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
                                selectedDate={selectedDate}
                                onAdminAction={handleAdminAction}
                                isLoading={adminLoading}
                                hasPendingRequests={false} 
                            />
                        )}
                    </div>
                 )}
             </Modal>
         );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Richieste del ${dateTitle}`}>
            
            {loggedInUser.isAdmin === true && (
                <div className="admin-controls-wrapper">
                    {!isAdminMode ? (
                        <button 
                            className="admin-panel-toggle"
                            onClick={() => setIsAdminMode(true)}
                        >
                            <FaWrench /> Abilita Modifiche Admin
                        </button>
                    ) : (
                        <button 
                            className="admin-panel-toggle active"
                            onClick={() => setIsAdminMode(false)}
                        >
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
                {sortedRequests.map(request => {
                    const requestUser = users.find(u => u.id === request.userId);
                    const isMyRequest = requestUser && loggedInUser.id === requestUser.id;
                    const requestDate = new Date(request.requestedDate);
                    const isPast = isBefore(requestDate, today);
                    const status = request.status;

                    const canEdit = status === 'pending' && !isPast;
                    const canCancel = (status === 'pending' || status === 'not_assigned' || status === 'assigned') && !isPast;

                    const showEdit = (isMyRequest && canEdit) || (isAdminMode && canEdit);
                    const showCancel = (isMyRequest && canCancel) || (isAdminMode && canCancel);

                    const statusText = getStatusText(status);

                    // --- VISUALIZZAZIONE PROBABILITÀ ---
                    // Mostriamo la probabilità solo se è "domani" ed è "pending"
                    // Calcolo INVERSO: 100% - SuccessRate
                    const showProbability = isTomorrow(requestDate) && status === 'pending' && requestUser?.successRate !== undefined;
                    const probabilityPercent = requestUser?.successRate !== undefined ? ((1 - requestUser.successRate) * 100).toFixed(0) : 0;
                    // -----------------------------------

                    return (
                        <div key={request.requestId} className={`booking-card status-${status}`}>
                            <div className="card-main-info">
                                {requestUser && <Avatar user={requestUser} />}
                                <div className="card-details">
                                    <span className="user-name">{requestUser ? `${requestUser.firstName} ${requestUser.lastName}` : 'Utente non trovato'}</span>
                                    <span className="parking-spot">
                                        Stato: <strong>{statusText}</strong>
                                        {status === 'assigned' && ` - Posto: ${request.assignedParkingSpaceNumber}`}
                                    </span>
                                    
                                    {/* --- MODIFICA QUI --- */}
                                    {showProbability && (
                                        <span className="probability-text">
                                            Probabilità di assegnazione: <strong>{probabilityPercent}%</strong>
                                        </span>
                                    )}
                                    {/* --- FINE MODIFICA --- */}
                                </div>
                            </div>

                            <div className="card-actions">
                                {showEdit && (
                                    <button className="icon-btn edit-btn" onClick={() => handleEditClick(request)} title="Modifica richiesta">
                                        <FaPencilAlt />
                                    </button>
                                )}
                                
                                {showCancel && (
                                    <button className="icon-btn delete-btn" onClick={() => handleCancelClick(request)} title={status === 'assigned' ? 'Annulla assegnazione' : 'Cancella richiesta'}>
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