import React, { useState, useEffect, useCallback } from 'react';
import { callApi } from '../services/api';
import { FaTrashAlt, FaCalendarPlus, FaPencilAlt, FaCheck, FaTimes } from 'react-icons/fa';
import AvailabilityModal from '../components/AvailabilityModal';
import './ParkingSpacesPage.css';

const ParkingSpacesPage = () => {
  const [parkingSpaces, setParkingSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newSpaceName, setNewSpaceName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  const [deletingSpaceId, setDeletingSpaceId] = useState(null);

  // STATI PER LA MODIFICA IN-LINE DEL NOME
  const [editingSpaceId, setEditingSpaceId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

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
    if (!String(newSpaceName).trim()) return;
    setIsAdding(true);
    try {
      const response = await callApi('addParkingSpace', { number: String(newSpaceName).trim() });
      setNewSpaceName('');
      if (response?.space) {
        setParkingSpaces(prevSpaces => {
          const nextSpaces = [...prevSpaces, response.space];
          return nextSpaces.sort((a, b) => 
            String(a.number).localeCompare(String(b.number), undefined, { numeric: true })
          );
        });
      } else {
        fetchParkingSpaces();
      }
    } catch (err) {
      alert(`Errore: ${err.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (space) => {
    setEditingSpaceId(space.id);
    setEditingName(String(space.number ?? '')); // <--- CONVERTITO IN STRINGA
  };

  const handleCancelEdit = () => {
    setEditingSpaceId(null);
    setEditingName('');
  };

  const handleSaveName = async (spaceId) => {
    const cleanName = String(editingName).trim(); // <--- CONVERTITO IN STRINGA PRIMA DI .trim()
    if (!cleanName) return;

    setIsSavingName(true);
    try {
      await callApi('updateParkingSpaceName', { spaceId, number: cleanName });
      setParkingSpaces(prev =>
        prev.map(s => s.id === spaceId ? { ...s, number: cleanName } : s)
      );
      setEditingSpaceId(null);
    } catch (err) {
      alert(`Errore durante il salvataggio: ${err.message}`);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleDeleteSpace = async (spaceId, spaceNumber) => {
    if (window.confirm(`Sei sicuro di voler eliminare il parcheggio "${spaceNumber}"? Questa azione annullerà anche eventuali assegnazioni future per questo posto.`)) {
      setDeletingSpaceId(spaceId);
      try {
        await callApi('deleteParkingSpace', { spaceId });
        setParkingSpaces(prev => prev.filter(s => s.id !== spaceId));
      } catch (err) {
        alert(`Errore: ${err.message}`);
      } finally {
        setDeletingSpaceId(null);
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
  };

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
            <button type="submit" className="primary-submit-btn" disabled={isAdding || !String(newSpaceName).trim()}>
              {isAdding ? <div className="spinner-small"></div> : 'Aggiungi'}
            </button>
          </form>
        </div>

        <div className="spaces-list-container">
          <h2>Parcheggi Esistenti ({parkingSpaces.length})</h2>
          <ul className="spaces-list">
            {parkingSpaces.map(space => {
              const isDeleting = deletingSpaceId === space.id;
              const isEditing = editingSpaceId === space.id;

              return (
                <li key={space.id} className="space-item">
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <input 
                        type="text" 
                        value={editingName} 
                        onChange={(e) => setEditingName(e.target.value)}
                        className="space-input"
                        style={{ padding: '4px 8px', fontSize: '0.9rem' }}
                        autoFocus
                      />
                      <button 
                        className="icon-btn" 
                        onClick={() => handleSaveName(space.id)}
                        disabled={isSavingName || !String(editingName).trim()}
                        title="Salva nome"
                        style={{ color: '#28a745' }}
                      >
                        {isSavingName ? <div className="spinner-small"></div> : <FaCheck />}
                      </button>
                      <button 
                        className="icon-btn" 
                        onClick={handleCancelEdit}
                        disabled={isSavingName}
                        title="Annulla"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  ) : (
                    <span className="space-number">{space.number}</span>
                  )}

                  <div className="space-actions">

                    <div className="fixed-toggle">
                      <label htmlFor={`fixed-${space.id}`}>Fisso</label>
                      <input
                        type="checkbox"
                        id={`fixed-${space.id}`}
                        checked={space.isFixed === true}
                        onChange={() => handleFixedChange(space.id, space.isFixed)}
                        disabled={isDeleting || isEditing}
                      />
                    </div>
                    
                    {space.isFixed !== true && (
                      <button 
                        className="icon-btn edit-btn"
                        onClick={() => handleOpenAvailabilityModal(space)}
                        title={`Gestisci disponibilità per ${space.number}`}
                        disabled={isDeleting || isEditing}
                      >
                        <FaCalendarPlus />
                      </button>
                    )}

                    {!isEditing && (
                      <button 
                        className="modify-space-btn" 
                        onClick={() => handleStartEdit(space)}
                        title="Rinomina parcheggio"
                        disabled={isDeleting}
                      >
                        <FaPencilAlt />
                      </button>
                    )}

                    <button 
                      className="delete-space-btn"
                      onClick={() => handleDeleteSpace(space.id, space.number)}
                      title={`Elimina parcheggio ${space.number}`}
                      disabled={isDeleting || isEditing}
                    >
                      {isDeleting ? <div className="spinner-small" style={{borderColor: 'rgba(0,0,0,0.2)', borderTopColor: '#DE1F3C'}}></div> : <FaTrashAlt />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      
      <AvailabilityModal
        isOpen={isAvailabilityModalOpen}
        onClose={() => setIsAvailabilityModalOpen(false)}
        space={selectedSpace}
        onSave={fetchParkingSpaces}
      />
    </>
  );
};

export default ParkingSpacesPage;