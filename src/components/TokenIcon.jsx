import React from 'react';

/**
 * Gettone dorato vettoriale per il sistema di parcheggi.
 * Rappresenta una moneta/gettone d'oro brillante con sfumature metalliche e la "P" di Parcheggio in rilievo.
 */
export function TokenIcon({ size = 18, className = '', style = {}, title = 'Gettoni' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`token-icon ${className}`}
      style={{
        display: 'inline-block',
        verticalAlign: '-0.18em',
        flexShrink: 0,
        ...style,
      }}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        {/* Gradiente bordo esterno moneta */}
        <linearGradient id="token-gold-outer" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF085" />
          <stop offset="25%" stopColor="#F59E0B" />
          <stop offset="60%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>

        {/* Gradiente disco interno */}
        <radialGradient id="token-gold-inner" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="35%" stopColor="#FBBF24" />
          <stop offset="75%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </radialGradient>

        {/* Gradiente per la lettera P in rilievo */}
        <linearGradient id="token-p-emboss" x1="9" y1="6" x2="15" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#78350F" />
          <stop offset="100%" stopColor="#451A03" />
        </linearGradient>
      </defs>

      {/* Ombra di base / bordo più esterno */}
      <circle cx="12" cy="12" r="10.5" fill="url(#token-gold-outer)" stroke="#78350F" strokeWidth="0.75" />

      {/* Corona / scanalatura zigrinata */}
      <circle
        cx="12"
        cy="12"
        r="8.8"
        stroke="#FEF08A"
        strokeWidth="0.8"
        strokeDasharray="1.2 0.8"
        opacity="0.85"
      />

      {/* Faccia interna della moneta */}
      <circle cx="12" cy="12" r="7.8" fill="url(#token-gold-inner)" stroke="#B45309" strokeWidth="0.6" />

      {/* Riflesso luce superiore (highlight lucido ad arco) */}
      <path
        d="M 6.5 11 A 6.5 6.5 0 0 1 17.5 7.5 A 7.5 7.5 0 0 0 5 12 A 6.5 6.5 0 0 1 6.5 11 Z"
        fill="#FFFFFF"
        opacity="0.45"
      />

      {/* Ombra rilievo della 'P' */}
      <path
        d="M 9.5 7.2 H 13.5 C 15.3 7.2 16.5 8.2 16.5 9.8 C 16.5 11.4 15.3 12.4 13.5 12.4 H 11.5 V 17.5 H 9.5 V 7.2 Z M 11.5 8.9 V 10.7 H 13.3 C 14.2 10.7 14.7 10.3 14.7 9.8 C 14.7 9.3 14.2 8.9 13.3 8.9 H 11.5 Z"
        fill="#FEF08A"
        opacity="0.6"
        transform="translate(0, 0.4)"
      />

      {/* Lettera 'P' (Parcheggio) */}
      <path
        d="M 9.5 6.8 H 13.5 C 15.3 6.8 16.5 7.8 16.5 9.4 C 16.5 11 15.3 12 13.5 12 H 11.5 V 17.2 H 9.5 V 6.8 Z M 11.5 8.5 V 10.3 H 13.3 C 14.2 10.3 14.7 9.9 14.7 9.4 C 14.7 8.9 14.2 8.5 13.3 8.5 H 11.5 Z"
        fill="url(#token-p-emboss)"
      />
    </svg>
  );
}

export default TokenIcon;
