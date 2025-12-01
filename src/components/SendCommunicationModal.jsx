import React, { useState } from 'react';
import Modal from './Modal';
import { callApi } from '../services/api';
import './SendCommunicationModal.css';

const SendCommunicationModal = ({ isOpen, onClose }) => {
  const [message, setMessage] = useState('');
  const [isPersistent, setIsPersistent] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Inserisci un messaggio.");
      return;
    }
    if (isPersistent && (!startDate || !endDate)) {
        setError("Seleziona date di inizio e fine.");
        return;
    }

    setLoading(true);
    setError('');
    setStatusMsg('Invio in corso (potrebbe richiedere qualche secondo)...');

    try {
      const response = await callApi('sendAdminCommunication', {
        message,
        isPersistent,
        startDate,
        endDate
      });
      setStatusMsg(response.message);
      // Reset form dopo 2 secondi e chiudi
      setTimeout(() => {
          onClose();
          setMessage('');
          setIsPersistent(false);
          setStatusMsg('');
      }, 2000);
    } catch (err) {
      setError(err.message);
      setStatusMsg('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invia Comunicazione a Tutti">
      <form onSubmit={handleSubmit} className="comm-form">
        <div className="form-group">
          <label>Messaggio</label>
          <textarea 
            rows="5"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Scrivi qui il messaggio che verrà inviato via email..."
            className="comm-textarea"
          />
        </div>

        <div className="form-group checkbox-group">
          <input 
            type="checkbox" 
            id="persistCheck" 
            checked={isPersistent} 
            onChange={(e) => setIsPersistent(e.target.checked)} 
          />
          <label htmlFor="persistCheck">Messaggio Persistente (Banner in Home)</label>
        </div>

        {isPersistent && (
          <div className="dates-row">
            <div className="form-group">
              <label>Da:</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>A:</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
        {statusMsg && <p className="success-text">{statusMsg}</p>}

        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onClose} disabled={loading}>Annulla</button>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Invio...' : 'Invia Comunicazione'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default SendCommunicationModal;