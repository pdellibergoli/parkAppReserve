import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { callApi } from '../services/api';
import { format } from 'date-fns';
import './AddRequestModal.css';
import { FaPlus, FaTrash } from 'react-icons/fa';

const AddRequestModal = ({ isOpen, onClose, onRquestCreated }) => {
  // 1. Lo stato ora è un array di date
  const [selectedDates, setSelectedDates] = useState(['']);
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  
  const { user } = useAuth();
  const { setIsLoading } = useLoading();

  // Imposta lo stato iniziale all'apertura della modale
  useEffect(() => {
    if (isOpen) {
      setSelectedDates([format(new Date(), 'yyyy-MM-dd')]); // Inizia con la data di oggi
      setError('');
      setMessage('');
      setSubmitLoading(false);
    }
  }, [isOpen]);

  // 2. Funzioni per gestire la lista di date
  const handleDateChange = (index, date) => {
    const newDates = [...selectedDates];
    newDates[index] = date;
    setSelectedDates(newDates);
  };

  const handleAddDate = () => {
    setSelectedDates([...selectedDates, '']);
  };

  const handleRemoveDate = (index) => {
    const newDates = selectedDates.filter((_, i) => i !== index);
    setSelectedDates(newDates);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Filtra eventuali date vuote e rimuovi duplicati
    const validDates = [...new Set(selectedDates.filter(date => date))];

    if (validDates.length === 0) {
        setError("Devi selezionare almeno una data.");
        return;
    }
    
    setError('');
    setMessage('');
    setIsLoading(true);
    setSubmitLoading(true);

    try {
      // Chiama la nuova API `createBatchRequests` con l'array di date
      const response = await callApi('createBatchRequests', {
        userId: user.id,
        dates: validDates,
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
          {/* 3. UI aggiornata con la lista dinamica */}
          <div className="form-group">
            <label>Seleziona una o più date</label>
            {selectedDates.map((date, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <input 
                  type="date" 
                  value={date} 
                  onChange={(e) => handleDateChange(index, e.target.value)} 
                  min={format(new Date(), 'yyyy-MM-dd')}
                  required
                  style={{ flexGrow: 1 }}
                />
                {selectedDates.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => handleRemoveDate(index)} 
                    className="icon-btn delete-btn" 
                    style={{ marginLeft: '10px', width: '40px', height: '40px' }}
                    title="Rimuovi data"
                  >
                    <FaTrash />
                  </button>
                )}
              </div>
            ))}
            <button 
                type="button" 
                onClick={handleAddDate} 
                className="secondary-btn" 
                style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
                <FaPlus /> Aggiungi un'altra data
            </button>
          </div>

          {error && <p className="error-message">{error}</p>}
          
          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose} disabled={submitLoading}>Annulla</button>
            <button 
              type="submit" 
              className="submit-btn" 
              disabled={submitLoading}
            >
              {submitLoading ? <div className="spinner-small"></div> : 'Invia Richiesta/e'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default AddRequestModal;