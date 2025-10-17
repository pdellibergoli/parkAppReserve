import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { callApi } from '../services/api';
import { format } from 'date-fns';
import { FaPlus, FaTrash } from 'react-icons/fa';
import './AddRequestModal.css'; // Riusiamo stili simili

const AvailabilityModal = ({ isOpen, onClose, space }) => {
  const [availabilities, setAvailabilities] = useState([]);
  const [newDate, setNewDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false); // 1. NUOVO STATO PER LO SPINNER
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && space) {
      setNewDate(format(new Date(), 'yyyy-MM-dd'));
      fetchAvailabilities();
    }
  }, [isOpen, space]);

  const fetchAvailabilities = async () => {
    setLoading(true);
    try {
      const data = await callApi('getTemporaryAvailabilities', { spaceId: space.id });
      setAvailabilities(data);
    } catch (err) {
      setError("Impossibile caricare le disponibilità.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setIsAdding(true); // 2. ATTIVA LO SPINNER
    try {
      await callApi('addTemporaryAvailability', { spaceId: space.id, date: newDate });
      fetchAvailabilities(); // Ricarica la lista
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAdding(false); // 3. DISATTIVA LO SPINNER
    }
  };

  const handleDelete = async (availabilityId) => {
    if (window.confirm("Sei sicuro di voler rimuovere questa data di disponibilità?")) {
      setError('');
      try {
        await callApi('removeTemporaryAvailability', { availabilityId });
        fetchAvailabilities();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  if (!space) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Disponibilità per ${space.number}`}>
      <div className="add-booking-form">
        <form onSubmit={handleAdd} style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e0e0e0' }}>
          <div className="form-group">
            <label htmlFor="avail-date">Aggiungi data di disponibilità</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="date" 
                id="avail-date" 
                value={newDate} 
                onChange={(e) => setNewDate(e.target.value)} 
                min={format(new Date(), 'yyyy-MM-dd')}
                style={{ flexGrow: 1 }}
                required
              />
              {/* 4. LOGICA CONDIZIONALE PER MOSTRARE SPINNER O ICONA */}
              <button type="submit" className="submit-btn" style={{ padding: '0 1rem', width: '50px' }} disabled={isAdding}>
                {isAdding ? <div className="spinner-small"></div> : <FaPlus />}
              </button>
            </div>
          </div>
        </form>

        <div className="form-group">
          <label>Date di disponibilità future</label>
          {loading ? (
            <p>Caricamento...</p>
          ) : availabilities.length === 0 ? (
            <p>Nessuna disponibilità futura impostata per questo parcheggio.</p>
          ) : (
            <ul className="bookings-list" style={{ gap: '0.5rem' }}>
              {availabilities.map(avail => (
                <li key={avail.availabilityId} className="booking-card" style={{ padding: '0.8rem 1rem' }}>
                  <span style={{ flexGrow: 1 }}>{format(new Date(avail.availableDate), 'dd/MM/yyyy')}</span>
                  <button onClick={() => handleDelete(avail.availabilityId)} className="icon-btn delete-btn" title="Rimuovi data">
                    <FaTrash />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {error && <p className="error-message">{error}</p>}
      </div>
    </Modal>
  );
};

export default AvailabilityModal;