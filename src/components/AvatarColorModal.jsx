// src/components/AvatarColorModal.jsx

import React, { useState } from 'react';
import Modal from './Modal';
import './AvatarColorModal.css';

// Lista di colori predefiniti tra cui scegliere
const COLOR_OPTIONS = [
    '#DE1F3C', // Rosso tema principale
    '#4a4a4a', // Grigio scuro
    '#007bff', // Blu
    '#28a745', // Verde
    '#ffc107', // Giallo
    '#6f42c1', // Viola
    '#fd7e14', // Arancione
    '#20c997', // Ciano
];

const AvatarColorModal = ({ isOpen, onClose, currentColor, onColorSelected }) => {
    // Usa useState per lo stato del colore selezionato nella modale
    const [selectedColor, setSelectedColor] = useState(currentColor);

    const handleSave = () => {
        onColorSelected(selectedColor);
        onClose();
    };
    
    // Resetta lo stato del colore selezionato ogni volta che la modale si apre
    React.useEffect(() => {
        if (isOpen) {
            setSelectedColor(currentColor);
        }
    }, [isOpen, currentColor]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Scegli il Colore Avatar">
            <div className="avatar-color-selection">
                <p>Seleziona un colore per il tuo avatar:</p>
                <div className="color-grid">
                    {COLOR_OPTIONS.map(color => (
                        <div
                            key={color}
                            className={`color-option ${selectedColor === color ? 'selected' : ''}`}
                            style={{ backgroundColor: color }}
                            onClick={() => setSelectedColor(color)}
                        >
                            {selectedColor === color && <span className="check-mark">✓</span>}
                        </div>
                    ))}
                </div>
                
                <div className="modal-actions">
                    {/* Pulsante Annulla a sinistra, Salva a destra, secondo gli stili Modale */}
                    <button onClick={onClose} className="cancel-btn">Annulla</button>
                    <button onClick={handleSave} className="submit-btn" disabled={selectedColor === currentColor}>Salva Colore</button>
                </div>
            </div>
        </Modal>
    );
};

export default AvatarColorModal;