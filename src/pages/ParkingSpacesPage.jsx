// src/pages/ParkingSpacesPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { callApi } from '../services/api';
import { FaTrashAlt } from 'react-icons/fa';
import './ParkingSpacesPage.css'; // Assicurati che il file CSS sia importato

const ParkingSpacesPage = () => {
  const [parkingSpaces, setParkingSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newSpaceName, setNewSpaceName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchParkingSpaces = useCallback(async () => {
    try {
      setLoading(true);
      const spaces = await callApi('getParkingSpaces');
      
      // --- CORREZIONE DELLA LOGICA DI ORDINAMENTO ---
      // Convertiamo esplicitamente i numeri in stringhe prima di confrontarli
      // per evitare errori se l'API restituisce un tipo numerico.
      spaces.sort((a, b) => {
        const numA = String(a.number || '');
        const numB = String(b.number || '');
        return numA.localeCompare(numB, undefined, { numeric: true });
      });

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
      setNewSpaceName(''); // Pulisce l'input
      fetchParkingSpaces(); // Ricarica la lista aggiornata
    } catch (err) {
      alert(`Errore: ${err.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteSpace = async (spaceId, spaceNumber) => {
    if (window.confirm(`Sei sicuro di voler eliminare il parcheggio "${spaceNumber}"? Questa azione potrebbe invalidare prenotazioni esistenti.`)) {
      try {
        await callApi('deleteParkingSpace', { spaceId });
        fetchParkingSpaces(); // Ricarica la lista
      } catch (err) {
        alert(`Errore: ${err.message}`);
      }
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <div className="parking-spaces-container">
      <h1>Gestione Parcheggi</h1>
      
      {/* Form per aggiungere un nuovo parcheggio */}
      <div className="add-space-form-container">
        <h2>Aggiungi un nuovo parcheggio</h2>
        <form onSubmit={handleAddSpace} className="add-space-form">
          <input 
            type="text" 
            value={newSpaceName}
            onChange={(e) => setNewSpaceName(e.target.value)}
            placeholder="Es. 'Posto 15' o 'Parcheggio Sud'"
            className="space-input"
          />
          <button type="submit" className="add-space-btn" disabled={isAdding || !newSpaceName.trim()}>
            {isAdding ? <div className="spinner-small"></div> : 'Aggiungi'}
          </button>
        </form>
      </div>

      {/* Elenco dei parcheggi esistenti */}
      <div className="spaces-list-container">
        <h2>Parcheggi Esistenti ({parkingSpaces.length})</h2>
        {parkingSpaces.length === 0 ? (
          <p>Nessun parcheggio configurato.</p>
        ) : (
          <ul className="spaces-list">
            {parkingSpaces.map(space => (
              <li key={space.id} className="space-item">
                <span className="space-number">{space.number}</span>
                <button 
                  className="delete-space-btn"
                  onClick={() => handleDeleteSpace(space.id, space.number)}
                  title={`Elimina parcheggio ${space.number}`}
                >
                  <FaTrashAlt />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ParkingSpacesPage;