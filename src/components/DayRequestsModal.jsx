import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext'; // Import useLoading
import { callApi } from '../services/api'; // Import callApi
// Importa le funzioni date-fns necessarie
import { format, isBefore, startOfToday, isToday, isTomorrow } from 'date-fns';
import { getTextColor } from '../utils/colors';
import { FaPencilAlt, FaTrashAlt, FaLock, FaWrench } from 'react-icons/fa';
import './DayRequestsModal.css';

const Avatar = ({ user }) => {
    // ... (codice Avatar invariato)
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
    // ... (Componente AdminActions invariato)
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


const DayRequestsModal = ({ isOpen, onClose, requests, users, onEdit, onCancel, onCancelAssignment, onRefreshData }) => {
    
    // --- TUTTI GLI HOOK VANNO QUI, ALL'INIZIO ---
    const { user: loggedInUser } = useAuth();
    const { setIsLoading } = useLoading();
    
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [adminLoading, setAdminLoading] = useState(false);

    // Resetta lo stato admin quando la modale si chiude
    useEffect(() => {
        if (!isOpen) {
            setIsAdminMode(false);
        }
    }, [isOpen]);

    // Spostato prima dei return anticipati
    const hasPendingRequests = useMemo(() => {
        if (!requests) return false; // Aggiunto controllo di sicurezza
        return requests.some(r => r.status === 'pending');
    }, [requests]);
    // --- FINE BLOCCO HOOK ---


    // --- I RETURN ANTICIPATI VANNO DOPO GLI HOOK ---
    if (!isOpen || !requests) return null; 

    // Gestione caso modale aperta ma senza richieste
    if (requests.length === 0) {
         // NOTA: 'date' non è definito qui. Per risolverlo, HomePage dovrebbe passare
         // la 'selectedDate' (il giorno cliccato) come prop separata.
         // Per ora, usiamo un titolo generico.
         return (
             <Modal isOpen={isOpen} onClose={onClose} title={`Richieste`}>
                 <p>Nessuna richiesta trovata per questo giorno.</p>
                 {/* L'admin potrebbe voler assegnare anche se non ci sono richieste? Per ora no. */}
             </Modal>
         );
    }
    // --- FINE RETURN ANTICIPATI ---

    // Tutta la logica restante va qui, sicuri che 'requests' esista
    const requestDateObj = new Date(requests[0].requestedDate);
    const date = format(requestDateObj, 'dd/MM/yyyy');
    const today = startOfToday();
    
    // Funzione per chiamare le API Admin (invariata)
    const handleAdminAction = async (actionType, selectedDate) => {
        setAdminLoading(true);
        setIsLoading(true); 
        
        let apiAction = '';
        let successMessage = '';
        
        if (actionType === 'cancel_requests') {
            apiAction = 'adminCancelAllRequestsForDate';
            successMessage = 'Tutte le richieste non assegnate sono state cancellate.';
        } else if (actionType === 'reset_assignments') {
            apiAction = 'adminResetAssignmentsForDate';
            successMessage = 'Tutte le assegnazioni sono state resettate a "In attesa".';
        } else if (actionType === 'assign_requests') {
            apiAction = 'adminManuallyAssignForDate';
        }
        
        try {
            const response = await callApi(apiAction, { date: format(selectedDate, 'yyyy-MM-dd') });
            alert(response.message || successMessage);
            onRefreshData(); 
        } catch (err) {
            alert(`Errore: ${err.message}`);
        } finally {
            setAdminLoading(false);
            setIsLoading(false); 
        }
    };

    // getStatusText (invariata)
    const getStatusText = (status) => {
        switch (status) {
            case 'pending': return 'In attesa';
            case 'assigned': return 'Assegnato';
            case 'not_assigned': return 'Non assegnato';
            case 'cancelled_by_user': return 'Annullato dall\'utente';
            default: return status;
        }
    };

    // JSX return (invariato)
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Richieste del ${date}`}>
            
            {/* --- PANNELLO ADMIN --- */}
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
            {/* --- FINE PANNELLO ADMIN --- */}
            
            <div className="day-bookings-list">
                {requests.map(request => {
                    const requestUser = users.find(u => u.id === request.userId);
                    const isMyRequest = requestUser && loggedInUser.id === requestUser.id;
                    const requestDate = new Date(request.requestedDate);
                    const isPast = isBefore(requestDate, today);
                    const status = request.status;

                    const canEdit = status === 'pending' && !isPast;
                    const canCancelRequest = (status === 'pending' || status === 'not_assigned') && !isPast;
                    const canCancelAssignment = status === 'assigned' && !isPast;
                    
                    const statusText = getStatusText(status);

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
                                </div>
                            </div>

                            <div className="card-actions">
                                {((isMyRequest && canEdit) || (isAdminMode && canEdit)) && (
                                    <button className="icon-btn edit-btn" onClick={() => onEdit(request)} title="Modifica richiesta">
                                        <FaPencilAlt />
                                    </button>
                                )}
                                
                                {((isMyRequest && canCancelRequest) || (isAdminMode && canCancelRequest)) && (
                                    <button className="icon-btn delete-btn" onClick={() => onCancel(request.requestId)} title="Cancella richiesta">
                                        <FaTrashAlt />
                                    </button>
                                )}
                                
                                {((isMyRequest && canCancelAssignment) || (isAdminMode && canCancelAssignment)) && (
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