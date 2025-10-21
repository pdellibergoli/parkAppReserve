import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { callApi } from '../services/api';
import { format } from 'date-fns';
// Assicurati che il CSS importato sia corretto (potrebbe essere AddRequestModal.css o AddBookingModal.css)
import './AddRequestModal.css'; 
import { FaPlus, FaTrash } from 'react-icons/fa';

const AddRequestModal = ({ isOpen, onClose, onRquestCreated }) => {
  const [selectedDates, setSelectedDates] = useState(['']);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  
  const { user } = useAuth();
  const { setIsLoading } = useLoading();

  useEffect(() => {
    if (isOpen) {
      setSelectedDates([format(new Date(), 'yyyy-MM-dd')]);
      setError('');
      setMessage('');
      setSubmitLoading(false);
    }
  }, [isOpen]);

  const showLateRequestWarning = useMemo(() => {
    const now = new Date();
    if (now.getHours() < 19) {
      return false;
    }
    const todayString = format(now, 'yyyy-MM-dd');
    return selectedDates.some(date => date === todayString);
  }, [selectedDates]);

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
          <div className="form-group">
            <label>Seleziona una o più date</label>
            {/* ---- MODIFICA QUI: Aggiungi il contenitore ---- */}
            <div className="date-list-container"> 
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
            </div> {/* ---- FINE CONTENITORE ---- */}
            <button 
                type="button" 
                onClick={handleAddDate} 
                className="secondary-btn" 
                style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
                <FaPlus /> Aggiungi un'altra data
            </button>
          </div>

          {showLateRequestWarning && (
            <p className="warning-message" style={{ textAlign: 'center' }}>
              Attenzione: L'assegnazione principale per oggi è già avvenuta. La tua richiesta verrà messa in lista d'attesa e, se un posto è libero o si libererà, ti verrà assegnato automaticamente.
            </p>
          )}

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