import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { callApi } from '../services/api';
import { MY_REQUESTS_PAGE_SIZE, myRequestsQuery, prefetch } from '../services/queries';
import { useQuery } from '../hooks/useQuery';
import { format, isBefore, startOfToday } from 'date-fns';
import { FaPencilAlt, FaTrashAlt } from 'react-icons/fa';
import './MyRequestsPage.css';

const NO_REQUESTS = [];

const capitalizeFirstLetter = (string) => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const MyRequestsPage = () => {
  const { handleOpenAddModal, handleOpenEditModal } = useOutletContext();
  const { user } = useAuth();
  const { setIsLoading } = useLoading();

  const [page, setPage] = useState(1);
  const { data: pageData, error, isLoading: isPageLoading } = useQuery(myRequestsQuery(user.id, page));
  const [selection, setSelection] = useState([]);

  // Mentre arriva una nuova pagina resta visibile la precedente: niente lista che lampeggia
  const lastDataRef = useRef(null);
  if (pageData) lastDataRef.current = pageData;
  const data = pageData ?? lastDataRef.current;

  const myRequests = data?.requests ?? NO_REQUESTS;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / MY_REQUESTS_PAGE_SIZE));
  const isLoading = isPageLoading && !data;

  const goToPage = (nextPage) => {
    setPage(nextPage);
    setSelection([]);
    window.scrollTo({ top: 0 });
  };

  // Dopo una cancellazione l'ultima pagina può sparire
  useEffect(() => {
    if (pageData && page > totalPages) setPage(totalPages);
  }, [pageData, page, totalPages]);

  // La pagina successiva è la più probabile: quando l'utente ci arriva è già pronta
  const userId = user.id;
  const hasNextPage = page < totalPages;
  useEffect(() => {
    if (pageData && hasNextPage) prefetch(myRequestsQuery(userId, page + 1));
  }, [pageData, hasNextPage, userId, page]);

  // Una richiesta sparita dopo un aggiornamento non resta selezionata
  const selectedRequests = useMemo(() => (
    selection.filter((id) => myRequests.some((r) => r.requestId === id))
  ), [selection, myRequests]);

  const handleSelectionChange = (requestId) => {
      setSelection(prev => 
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
        setSelection([]);
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
  if (error && !data) return <p className="error-message">Impossibile caricare le tue richieste.</p>;

  const today = startOfToday();

  return (
    <>
      <button className="add-booking-btn" onClick={handleOpenAddModal}>+ Invia richiesta</button>
      <div className="my-bookings-container">
        <div className="page-header">
          <h1>Le mie richieste</h1>
          <button 
            className="delete-selected-btn"
            onClick={() => handleCancellations(selectedRequests, `Sei sicuro di voler ${selectedRequests.length === 1 ? 'cancellare la/le richiesta/e selezionata/e' : `elaborare le ${selectedRequests.length} richieste selezionate`} (cancellare o annullare assegnazione)?`)} // Messaggio generico per selezione multipla
            disabled={selectedRequests.length === 0}
          >
            Cancella Selezionati ({selectedRequests.length}) {/* Cambiato testo bottone */}
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

        {totalPages > 1 && (
          <nav className="pagination" aria-label="Pagine delle richieste">
            <button onClick={() => goToPage(page - 1)} disabled={page === 1}>Precedente</button>
            <span>Pagina {page} di {totalPages} ({total} richieste)</span>
            <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>Successiva</button>
          </nav>
        )}
      </div>
    </>
  );
};

export default MyRequestsPage;