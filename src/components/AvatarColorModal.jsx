// src/components/AvatarColorModal.jsx

import React, { useState } from 'react';
import Modal from './Modal';
import './AvatarColorModal.css'; 

/**
 * Determina il colore del testo (bianco o scuro) per un contrasto ottimale.
 * @param {string} hexColor - Codice colore HEX (#RRGGBB).
 * @returns {string} Il colore del testo da usare ('white' o '#213547').
 */
const getTextColor = (hexColor) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const cleanHex = hexColor.replace('#', '').replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanHex);
    if (!result) return 'white'; 

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    const rs = r / 255;
    const gs = g / 255;
    const bs = b / 255;

    // Calcolo della Luminanza
    const luminance = 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    
    // Soglia a 0.5: scuro per sfondi chiari, bianco per sfondi scuri
    return luminance > 0.5 ? '#213547' : 'white'; 
};

// Lista di colori predefiniti tra cui scegliere
const COLOR_OPTIONS = [
    '#DE1F3C', 
    '#4a4a4a', 
    '#007bff', 
    '#28a745', 
    '#ffc107', 
    '#6f42c1', 
    '#fd7e14', 
    '#20c997', 
    '#ffffff', 
    '#000000', 
];

const AvatarColorModal = ({ isOpen, onClose, currentColor, onColorSelected }) => {
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
                            style={{ 
                                backgroundColor: color,
                                color: getTextColor(color) 
                            }}
                            onClick={() => setSelectedColor(color)}
                        >
                            {selectedColor === color && <span className="check-mark">✓</span>}
                        </div>
                    ))}
                </div>
                
                <div className="modal-actions">
                    <button onClick={onClose} className="cancel-btn">Annulla</button>
                    <button onClick={handleSave} className="submit-btn" disabled={selectedColor === currentColor}>Salva Colore</button>
                </div>
            </div>
        </Modal>
    );
};

export default AvatarColorModal;