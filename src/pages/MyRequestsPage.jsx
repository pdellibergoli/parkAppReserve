import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { callApi } from '../services/api';
import { format, isBefore, startOfToday } from 'date-fns';
import { FaPencilAlt, FaTrashAlt } from 'react-icons/fa';
import './MyRequestsPage.css';

const capitalizeFirstLetter = (string) => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const MyRequestsPage = () => {
  const { handleOpenAddModal, handleOpenEditModal, refreshKey, forceDataRefresh } = useOutletContext();
  const { user } = useAuth();
  const { setIsLoading, isLoading } = useLoading();

  const [myRequests, setMyRequests] = useState([]);
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMyRequests = async () => {
        setIsLoading(true);
        try {
            const requests = await callApi('getRequests', { userId: user.id });
            requests.sort((a, b) => new Date(b.requestedDate) - new Date(a.requestedDate));
            setMyRequests(requests);
            setSelectedRequests([]);
        } catch (err) {
            setError('Impossibile caricare le tue richieste.');
        } finally {
            setIsLoading(false);
        }
    };
    fetchMyRequests();
  }, [user.id, setIsLoading, refreshKey]);
  
  const handleSelectionChange = (requestId) => {
      setSelectedRequests(prev => 
          prev.includes(requestId)
              ? prev.filter(id => id !== requestId)
              : [...prev, requestId]
      );
  };
  
  // Funzione UNIFICATA per gestire tutte le cancellazioni
  const handleCancellations = async (requestIds, confirmationMessage) => {
    if (requestIds.length === 0) return;

    if (window.confirm(confirmationMessage)) {
      setIsLoading(true);
      try {
        await callApi('cancelMultipleRequests', { requestIds });
        forceDataRefresh(); // Ricarica i dati dopo la cancellazione
      } catch (err) {
        alert(`Errore: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getStatusText = (status) => {
      switch(status) {
          case 'pending': return 'In attesa';
          case 'assigned': return 'Assegnato';
          case 'not_assigned': return 'Non assegnato';
          case 'cancelled_by_user': return 'Annullato dall\'utente';
          default: return capitalizeFirstLetter(status);
      }
  }

  if (isLoading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;

  const today = startOfToday();

  return (
    <>
      <button className="add-booking-btn" onClick={handleOpenAddModal}>+ Invia richiesta</button>
      <div className="my-bookings-container">
        <div className="page-header">
          <h1>Le mie richieste</h1>
          <button 
            className="delete-selected-btn"
            onClick={() => handleCancellations(selectedRequests, `Sei sicuro di voler ${selectedRequests.length === 1 ? 'elaborare la richiesta selezionata' : `elaborare le ${selectedRequests.length} richieste selezionate`} (cancellare o annullare assegnazione)?`)} // Messaggio generico per selezione multipla
            disabled={selectedRequests.length === 0}
          >
            Elabora Selezionati ({selectedRequests.length}) {/* Cambiato testo bottone */}
          </button>
        </div>

        {myRequests.length === 0 ? (
          <p>Non hai nessuna richiesta attiva o passata.</p>
        ) : (
          <ul className="bookings-list">
            {myRequests.map(request => {
              const requestDate = new Date(request.requestedDate);
              const isPast = isBefore(requestDate, today);
              const status = request.status; // Usiamo variabile per leggibilità
              
              const isPending = status === 'pending' && !isPast;
              const isAssigned = status === 'assigned' && !isPast;
              const isNotAssignedFuture = status === 'not_assigned' && !isPast;
              const canBeCancelledOrSelected = isPending || isAssigned || isNotAssignedFuture;

              const statusText = getStatusText(status);

              return (
                <li key={request.requestId} className={`booking-card status-${status} ${selectedRequests.includes(request.requestId) ? 'selected' : ''}`}>
                    <div className="card-main-info">
                        {/* Mostra checkbox se non è passato e non è già cancellato dall'utente */}
                        { !isPast && status !== 'cancelled_by_user' && (
                            <div className="checkbox-container">
                                <input 
                                    type="checkbox" 
                                    id={`cb-${request.requestId}`} 
                                    checked={selectedRequests.includes(request.requestId)}
                                    onChange={() => handleSelectionChange(request.requestId)}
                                />
                                <label htmlFor={`cb-${request.requestId}`}></label>
                            </div>
                        )}
                        {/* Sposta a sinistra se non c'è checkbox */}
                        <div className="card-details" style={{ marginLeft: (!isPast && status !== 'cancelled_by_user') ? '0' : '50px' }}>
                            <span className="booking-date">{format(requestDate, 'dd/MM/yyyy')}</span>
                            <span className="booking-space">
                                Stato: <strong>{statusText}</strong>
                                {status === 'assigned' && ` - Parcheggio: ${request.assignedParkingSpaceNumber}`}
                            </span>
                        </div>
                    </div>
                    
                    <div className="card-actions">
                        {isPending && ( // Modifica solo se pending
                          <button onClick={() => handleOpenEditModal(request)} className="icon-btn edit-btn" title="Modifica richiesta">
                              <FaPencilAlt />
                          </button>
                        )}
                        {/* ICONA CESTINO VISIBILE PER PENDING, ASSIGNED e NOT_ASSIGNED (futuri) */}
                        {canBeCancelledOrSelected && (
                            <button 
                                onClick={() => handleCancellations(
                                    [request.requestId], 
                                    // Messaggio di conferma dinamico
                                    `Sei sicuro di voler ${status === 'assigned' ? 'annullare questa assegnazione' : 'cancellare questa richiesta'}?`
                                )} 
                                className="icon-btn delete-btn" 
                                // Titolo dinamico
                                title={status === 'assigned' ? 'Annulla assegnazione' : 'Cancella richiesta'}
                            >
                                <FaTrashAlt />
                            </button>
                        )}
                    </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
};

export default MyRequestsPage;