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

const DayRequestsModal = ({ isOpen, onClose, requests, users, selectedDate, onEdit, totalParkingSpaces, onCancel, onRefreshData, onOptimisticUpdate, onOptimisticDelete }) => {
    const { user: loggedInUser } = useAuth();
    const { setIsLoading } = useLoading();
    
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [adminLoading, setAdminLoading] = useState(false);

    const [confirmModal, setConfirmModal] = useState({ isOpen: false, requestId: null, newStatus: null, currentStatus: null });

    const today = startOfToday();
    const requestDateObj = selectedDate || (requests && requests.length > 0 ? new Date(requests[0].requestedDate) : new Date());
    const dateTitle = format(requestDateObj, 'dd/MM/yyyy');
    const isPastDate = isBefore(requestDateObj, today);

    // RESET STATO LOCALE SENZA EFFETTUARE NESSUNA CHIAMATA DI RETE
    useEffect(() => {
        if (!isOpen) {
            setIsAdminMode(false);
            setConfirmModal({ isOpen: false, requestId: null, newStatus: null, currentStatus: null });
        }
    }, [isOpen]);

    const filteredRequests = useMemo(() => {
        return (requests || []).filter(r => r.status !== 'cancelled_by_user');
    }, [requests]);

    const hasPendingRequests = useMemo(() => {
        return filteredRequests.some(r => r.status === 'pending');
    }, [filteredRequests]);

    const sortedRequests = useMemo(() => {
        if (!users) return [];
        return [...filteredRequests].sort((a, b) => {
            if (a.status === 'assigned' && b.status !== 'assigned') return -1;
            if (a.status !== 'assigned' && b.status === 'assigned') return 1;
            
            const userA = users.find(u => u.id === a.userId);
            const userB = users.find(u => u.id === b.userId);
            const rateA = userA?.successRate ?? 1;
            const rateB = userB?.successRate ?? 1;
            return rateA - rateB; 
        });
    }, [filteredRequests, users]);

    const handleCancelClick = async (request) => {
        const isAssigned = request.status === 'assigned';
        const confirmMsg = `Sei sicuro di voler ${isAssigned ? 'annullare questa assegnazione' : 'cancellare questa richiesta'}?`;
        
        if (window.confirm(confirmMsg)) {
            setIsLoading(true);
            
            // Rimozione immediata dalla UI
            if (typeof onOptimisticDelete === 'function') {
                onOptimisticDelete(request.requestId);
            }

            try {
                const payload = { 
                    requestIds: [request.requestId],
                    actorId: loggedInUser.id 
                };
                await callApi('cancelMultipleRequests', payload);
            } catch (err) {
                alert(`Errore durante l'eliminazione: ${err.message}`);
                if (typeof onRefreshData === 'function') {
                    onRefreshData();
                }
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleStatusChange = (requestId, currentStatus, newStatus) => {
        if (currentStatus === newStatus) return;

        if ((currentStatus === 'assigned' && newStatus !== 'assigned') || 
            (currentStatus !== 'assigned' && newStatus === 'assigned')) {
            setConfirmModal({ isOpen: true, requestId, newStatus, currentStatus });
        } else {
            if (window.confirm(`Cambiare lo stato in "${getStatusText(newStatus)}"?`)) {
                executeStatusChange(requestId, newStatus, false);
            }
        }
    };

    const executeStatusChange = async (requestId, newStatus, preventAutoLogic) => {
        try {
            setIsLoading(true);
            setConfirmModal({ isOpen: false, requestId: null, newStatus: null, currentStatus: null });
            
            if (typeof onOptimisticUpdate === 'function') {
                onOptimisticUpdate({ 
                    requestId, 
                    status: newStatus,
                    assignedParkingSpaceNumber: newStatus === 'assigned' ? 'Forzato' : ''
                });
            }
            await callApi('adminUpdateUserRequestStatus', { 
                requestId, 
                newStatus, 
                actorId: loggedInUser.id,
                preventAutoLogic: preventAutoLogic 
            });

        } catch (error) {
            alert("Errore durante l'aggiornamento: " + error.message);
            if (typeof onRefreshData === 'function') {
                onRefreshData();
            }
        } finally {
            setIsLoading(false);
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
            default: return status;
        }
    };

    if (!isOpen) return null; 

    const customTitle = (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <span style={{ fontSize: '1.1rem' }}>Richieste del {dateTitle}</span>
            {!isPastDate && (
                <div className="status-item" style={{ flexDirection: 'row', gap: '5px', alignItems: 'center' }}>
                    <span className="label" style={{ marginBottom: 0 }}>Totale parcheggi disponibili:</span>
                    <span className="value" style={{ fontSize: '1rem' }}>{totalParkingSpaces}</span>
                </div>
            )}
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={customTitle}>
            <div className="day-requests-wrapper" style={{ position: 'relative' }}>
                
                {confirmModal.isOpen && (
                    <div className="custom-confirm-overlay">
                        <div className="custom-confirm-box">
                            <h3>Conferma Modifica Stato</h3>
                            <p>Stai cambiando lo stato della richiesta in: <strong>{getStatusText(confirmModal.newStatus)}</strong>.</p>
                            <p className="confirm-prompt-text">Scegli la modalità di gestione per questa azione:</p>
                            
                            <div className="confirm-actions-col">
                                <button 
                                    className="confirm-btn logic" 
                                    onClick={() => executeStatusChange(confirmModal.requestId, confirmModal.newStatus, false)}
                                >
                                    Applica Logica Automatica
                                    <small>
                                        {confirmModal.newStatus === 'assigned' 
                                            ? "(Prende automaticamente il primo posto libero)" 
                                            : "(Riassegna subito il posto liberato all'utente successivo in lista)"}
                                    </small>
                                </button>
                                
                                <button 
                                    className="confirm-btn force" 
                                    onClick={() => executeStatusChange(confirmModal.requestId, confirmModal.newStatus, true)}
                                >
                                    Forza solo cambio stato
                                    <small>(Nessun automatismo a cascata / Permette Overbooking manuale)</small>
                                </button>
                            </div>
                            
                            <button 
                                className="cancel-btn block-btn" 
                                style={{ marginTop: '1.2rem', width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', cursor: 'pointer' }} 
                                onClick={() => setConfirmModal({ isOpen: false, requestId: null, newStatus: null, currentStatus: null })}
                            >
                                Annulla e mantieni stato precedente
                            </button>
                        </div>
                    </div>
                )}

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
                    {sortedRequests.length === 0 ? (
                        <p style={{textAlign: 'center', color: '#666'}}>Nessuna richiesta attiva per questo giorno.</p>
                    ) : (
                        sortedRequests.map(request => {
                            const requestUser = users?.find(u => u.id === request.userId);
                            const isMyRequest = requestUser && loggedInUser.id === requestUser.id;
                            const requestDate = new Date(request.requestedDate);
                            const isPastRequest = isBefore(requestDate, today);
                            const status = request.status;

                            const canEdit = status === 'pending' && !isPastRequest;
                            const canCancel = (status === 'pending' || status === 'not_assigned' || status === 'assigned') && !isPastRequest;
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
                                            <div className="parking-spot">
                                                <span>Stato: </span>
                                                {isAdminMode ? (
                                                    <select 
                                                        className="admin-status-select"
                                                        value={status}
                                                        onChange={(e) => handleStatusChange(request.requestId, status, e.target.value)}
                                                    >
                                                      <option value="pending">In attesa</option>
                                                      <option value="assigned">Assegnato</option>
                                                      <option value="not_assigned">Non assegnato</option>
                                                    </select>
                                                ) : (
                                                    <strong>{getStatusText(status)}</strong>
                                                )}
                                                {status === 'assigned' && ` - Posto: ${request.assignedParkingSpaceNumber || 'Forzato'}`}
                                            </div>
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
            </div>
        </Modal>
    );
};

export default DayRequestsModal;