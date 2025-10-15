import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useLoading } from '../context/LoadingContext';
import { callApi } from '../services/api';
import { format } from 'date-fns';
import './AddRequestModal.css'; // Riusiamo lo stesso stile

const EditRequestModal = ({ isOpen, onClose, onRequestUpdated, requestData }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setIsLoading } = useLoading();

  useEffect(() => {
    if (isOpen && requestData) {
      setSelectedDate(format(new Date(requestData.requestedDate), 'yyyy-MM-dd'));
      setError('');
    }
  }, [isOpen, requestData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDate) {
      setError("Per favore, seleziona una data.");
      return;
    }

    // Non inviare la chiamata se la data non è cambiata
    if (format(new Date(requestData.requestedDate), 'yyyy-MM-dd') === selectedDate) {
        onClose(); // Chiudi semplicemente la modale
        return;
    }

    setError('');
    setIsLoading(true);
    setLoading(true);

    try {
      await callApi('updateRequestDate', {
        requestId: requestData.requestId,
        newDate: selectedDate,
      });
      onRequestUpdated(); // Questo ricaricherà i dati e chiuderà la modale
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  };

  if (!requestData) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Modifica Data Richiesta">
      <form onSubmit={handleSubmit} className="add-booking-form">
        <div className="form-group">
          <label htmlFor="edit-request-date">Seleziona la nuova data</label>
          <input 
            type="date" 
            id="edit-request-date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            min={format(new Date(), 'yyyy-MM-dd')} 
            required 
          />
        </div>
        
        {error && <p className="error-message">{error}</p>}
        
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onClose} disabled={loading}>Annulla</button>
          <button type="submit" className="submit-btn" disabled={!selectedDate || loading}>
            {loading ? <div className="spinner-small"></div> : 'Salva Modifiche'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EditRequestModal;