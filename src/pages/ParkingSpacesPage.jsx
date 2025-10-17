import React, { useState, useEffect, useCallback } from 'react';
import { callApi } from '../services/api';
import { FaTrashAlt, FaCalendarPlus } from 'react-icons/fa';
import AvailabilityModal from '../components/AvailabilityModal';
import './ParkingSpacesPage.css';

const ParkingSpacesPage = () => {
  const [parkingSpaces, setParkingSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newSpaceName, setNewSpaceName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState(null);

  const fetchParkingSpaces = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      let spaces = await callApi('getParkingSpaces');
      spaces = spaces.filter(space => space && space.id && space.number);
      spaces.sort((a, b) => 
        String(a.number).localeCompare(String(b.number), undefined, { numeric: true })
      );
      setParkingSpaces(spaces);
    } catch (err) {
      setError("Impossibile caricare l'elenco dei parcheggi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParkingSpaces();
  }, [fetchParkingSpaces]);

  const handleAddSpace = async (e) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;
    setIsAdding(true);
    try {
      await callApi('addParkingSpace', { number: newSpaceName.trim() });
      setNewSpaceName('');
      fetchParkingSpaces();
    } catch (err) {
      alert(`Errore: ${err.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteSpace = async (spaceId, spaceNumber) => {
    if (window.confirm(`Sei sicuro di voler eliminare il parcheggio "${spaceNumber}"?`)) {
      try {
        await callApi('deleteParkingSpace', { spaceId });
        fetchParkingSpaces();
      } catch (err) {
        alert(`Errore: ${err.message}`);
      }
    }
  };

  const handleFixedChange = async (spaceId, currentFixedStatus) => {
    const newFixedStatus = !currentFixedStatus;
    setParkingSpaces(currentSpaces =>
      currentSpaces.map(space =>
        space.id === spaceId ? { ...space, isFixed: newFixedStatus } : space
      )
    );
    try {
      await callApi('updateParkingSpaceFixedStatus', { spaceId, isFixed: newFixedStatus });
    } catch (err) {
      alert(`Errore nell'aggiornamento: ${err.message}`);
      setParkingSpaces(currentSpaces =>
        currentSpaces.map(space =>
          space.id === spaceId ? { ...space, isFixed: currentFixedStatus } : space
        )
      );
    }
  };
  
  const handleOpenAvailabilityModal = (space) => {
      setSelectedSpace(space);
      setIsAvailabilityModalOpen(true);
  }

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <>
      <div className="parking-spaces-container">
        <h1>Gestione Parcheggi</h1>
        
        <div className="add-space-form-container">
           <h2>Aggiungi un nuovo parcheggio</h2>
          <form onSubmit={handleAddSpace} className="add-space-form">
            <input 
              type="text" 
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              placeholder="Es. 'Posto 15'"
              className="space-input"
            />
            <button type="submit" className="primary-submit-btn" disabled={isAdding || !newSpaceName.trim()}>
              {isAdding ? <div className="spinner-small"></div> : 'Aggiungi'}
            </button>
          </form>
        </div>

        <div className="spaces-list-container">
          <h2>Parcheggi Esistenti ({parkingSpaces.length})</h2>
          <ul className="spaces-list">
            {parkingSpaces.map(space => (
              <li key={space.id} className="space-item">
                <span className="space-number">{space.number}</span>
                <div className="space-actions">
                  <div className="fixed-toggle">
                    <label htmlFor={`fixed-${space.id}`}>Fisso</label>
                    <input
                      type="checkbox"
                      id={`fixed-${space.id}`}
                      checked={space.isFixed === true}
                      onChange={() => handleFixedChange(space.id, space.isFixed)}
                    />
                  </div>
                  
                  {/* --- MODIFICA QUI --- */}
                  {/* Mostra il pulsante solo se il parcheggio NON è fisso */}
                  {space.isFixed !== true && (
                    <button 
                      className="icon-btn edit-btn"
                      onClick={() => handleOpenAvailabilityModal(space)}
                      title={`Gestisci disponibilità per ${space.number}`}
                    >
                      <FaCalendarPlus />
                    </button>
                  )}

                  <button 
                    className="delete-space-btn"
                    onClick={() => handleDeleteSpace(space.id, space.number)}
                    title={`Elimina parcheggio ${space.number}`}
                  >
                    <FaTrashAlt />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <AvailabilityModal
        isOpen={isAvailabilityModalOpen}
        onClose={() => setIsAvailabilityModalOpen(false)}
        space={selectedSpace}
      />
    </>
  );
};

export default ParkingSpacesPage;