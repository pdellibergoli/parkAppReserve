import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { callApi } from '../services/api';
import { format } from 'date-fns';
import './AddRequestModal.css';

// Funzione di supporto per confrontare le date ignorando l'orario
const areDatesOnSameDay = (first, second) => {
  if (!first || !second) return false;
  return format(new Date(first), 'yyyy-MM-dd') === format(new Date(second), 'yyyy-MM-dd');
};

const AddRequestModal = ({ isOpen, onClose, onRquestCreated }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState(''); // Stato specifico per l'avviso
  const [submitLoading, setSubmitLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const { user } = useAuth();
  const { setIsLoading } = useLoading();
  const [userRequests, setUserRequests] = useState([]);

  // Carica le richieste dell'utente solo quando la modale si apre
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
      setError('');
      setMessage('');
      setWarningMessage('');
      setSubmitLoading(false);
      
      const fetchUserRequests = async () => {
        setInitialLoading(true);
        try {
            const requests = await callApi('getRequests', { userId: user.id });
            setUserRequests(requests);
        } catch (err) {
            setError("Impossibile verificare le richieste esistenti.");
        } finally {
            setInitialLoading(false);
        }
      };
      
      fetchUserRequests();
    }
  }, [isOpen, user.id]);

  // Controlla la data ogni volta che cambia e imposta/resetta l'avviso
  useEffect(() => {
    if (!selectedDate || userRequests.length === 0) {
        setWarningMessage('');
        return;
    }

    const hasExistingRequest = userRequests.some(req => areDatesOnSameDay(req.requestedDate, selectedDate));
    
    if (hasExistingRequest) {
        setWarningMessage("Hai già una richiesta per il giorno selezionato.");
    } else {
        setWarningMessage(''); // Pulisce l'avviso se la data è valida
    }
  }, [selectedDate, userRequests]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (warningMessage) { // Controlliamo se c'è un avviso attivo
        setError(warningMessage);
        return;
    }
    
    setError('');
    setMessage('');
    setIsLoading(true);
    setSubmitLoading(true);

    try {
      const response = await callApi('createNewRequest', {
        date: selectedDate,
        userId: user.id,
      });
      setMessage(response.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setSubmitLoading(false);
    }
  };

  const handleCloseAndRefresh = () => {
      onRquestCreated();
      onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invia Richiesta Parcheggio">
      {message ? (
        <div className="success-container">
          <p className="success-message" style={{textAlign: 'center'}}>{message}</p>
          <div className="modal-actions">
            <button className="submit-btn" onClick={handleCloseAndRefresh}>Chiudi</button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="add-booking-form">
          {initialLoading ? (
            <div className="loading-container" style={{height: '100px'}}><div className="spinner"></div></div>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="request-date">Seleziona una data per la richiesta</label>
                <input 
                  type="date" 
                  id="request-date" 
                  value={selectedDate} 
                  onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setError(''); // Pulisce l'errore generico al cambio data
                  }} 
                  min={format(new Date(), 'yyyy-MM-dd')} 
                  required 
                />
              </div>

              {warningMessage && (
                <p className="warning-message">
                  {warningMessage}
                </p>
              )}
            </>
          )}

          {error && <p className="error-message">{error}</p>}
          
          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose} disabled={submitLoading}>Annulla</button>
            <button 
              type="submit" 
              className="submit-btn" 
              disabled={!selectedDate || submitLoading || initialLoading || !!warningMessage} // Disabilita se c'è un avviso
            >
              {submitLoading ? <div className="spinner-small"></div> : 'Invia Richiesta'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default AddRequestModal;