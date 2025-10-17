import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { callApi } from '../services/api';
// MODIFICA: Rimuoviamo 'it' perché non serve più per il formato numerico
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
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMyRequests = async () => {
        setIsLoading(true);
        try {
            const requests = await callApi('getRequests', { userId: user.id });
            requests.sort((a, b) => new Date(b.requestedDate) - new Date(a.requestedDate));
            setMyRequests(requests);
        } catch (err) {
            setError('Impossibile caricare le tue richieste.');
        } finally {
            setIsLoading(false);
        }
    };
    fetchMyRequests();
  }, [user.id, setIsLoading, refreshKey]);


  const handleCancelRequest = async (requestId) => {
    if (window.confirm(`Sei sicuro di voler cancellare questa richiesta?`)) {
      setIsLoading(true);
      try {
        await callApi('cancelRequest', { requestId });
        forceDataRefresh();
      } catch (err) {
        alert(`Errore durante la cancellazione: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  const handleCancelAssignment = async (requestId) => {
    if (window.confirm(`Sei sicuro di voler annullare questa assegnazione e cedere il tuo posto?`)) {
        setIsLoading(true);
        try {
            await callApi('cancelAssignmentAndReassign', { requestId });
            forceDataRefresh();
        } catch (err) {
            alert(`Errore durante l'annullamento: ${err.message}`);
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
          case 'cancelled_by_user': return 'Annullato da te';
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
        </div>

        {myRequests.length === 0 ? (
          <p>Non hai nessuna richiesta attiva o passata.</p>
        ) : (
          <ul className="bookings-list">
            {myRequests.map(request => {
              const requestDate = new Date(request.requestedDate);
              const isPast = isBefore(requestDate, today);
              
              const canBeManaged = request.status === 'pending' && !isPast;
              const canBeCancelled = request.status === 'assigned' && !isPast;

              const statusText = getStatusText(request.status);

              return (
                <li key={request.requestId} className={`booking-card status-${request.status}`}>
                    <div className="card-main-info">
                        <div className="card-details">
                            {/* MODIFICA FORMATO DATA QUI */}
                            <span className="booking-date">{format(requestDate, 'dd/MM/yyyy')}</span>
                            <span className="booking-space">
                                Stato: <strong>{statusText}</strong>
                                {request.status === 'assigned' && ` - Parcheggio: ${request.assignedParkingSpaceNumber}`}
                            </span>
                        </div>
                    </div>
                    
                    <div className="card-actions">
                        {canBeManaged && (
                          <>
                            <button onClick={() => handleOpenEditModal(request)} className="icon-btn edit-btn" title="Modifica richiesta">
                                <FaPencilAlt />
                            </button>
                            <button onClick={() => handleCancelRequest(request.requestId)} className="icon-btn delete-btn" title="Cancella richiesta">
                                <FaTrashAlt />
                            </button>
                          </>
                        )}
                        {canBeCancelled && (
                            <button onClick={() => handleCancelAssignment(request.requestId)} className="icon-btn delete-btn" title="Annulla assegnazione">
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