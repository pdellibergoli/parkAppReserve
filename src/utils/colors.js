/**
 * Determina il colore del testo (bianco o scuro) per un contrasto ottimale.
 * @param {string} hexColor - Codice colore HEX (#RRGGBB).
 * @returns {string} Il colore del testo da usare ('white' o '#213547').
 */
export const getTextColor = (hexColor) => {
    if (!hexColor) return 'white'; // Default a bianco se non c'è colore

    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const cleanHex = hexColor.replace('#', '').replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanHex);
    if (!result) return 'white'; 

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    // Formula per calcolare la luminanza
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Se la luminanza è alta (colore chiaro), usa il testo scuro. Altrimenti, usa il testo bianco.
    return luminance > 0.5 ? '#213547' : 'white'; 
};