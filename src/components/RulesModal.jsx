import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/useAuth';
import { 
  FaFileContract, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaCheck, 
  FaTimes, 
  FaEdit, 
  FaSave, 
  FaInfoCircle 
} from 'react-icons/fa';
import './RulesModal.css';

const RulesModal = ({ isOpen, onClose, onAcceptSuccess, isReadOnly = false }) => {
  const { 
    user, 
    hasAcceptedRules, 
    acceptRules, 
    activeRegulation, 
    updateCompanyRegulation 
  } = useAuth();

  const [isAgreed, setIsAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Stato modalità admin per modifica regolamento
  const [isAdminEditing, setIsAdminEditing] = useState(false);
  const [editVersion, setEditVersion] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  useEffect(() => {
    if (activeRegulation) {
      setEditVersion(activeRegulation.version || '1.0');
      setEditTitle(activeRegulation.title || 'Regolamento per l’Utilizzo dei Parcheggi Aziendali – Sede di Chiasso');
      setEditContent(activeRegulation.content || '');
    }
  }, [activeRegulation]);

  if (!isOpen) return null;

  const currentVersion = activeRegulation?.version || '1.0';
  const userVersion = user?.acceptedRulesVersion ? String(user.acceptedRulesVersion) : null;
  const isOutdatedAcceptance = Boolean(userVersion && userVersion !== String(currentVersion));
  const alreadyAccepted = hasAcceptedRules;

  const handleAccept = async () => {
    if (!isAgreed || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await acceptRules();
      if (onAcceptSuccess) onAcceptSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Errore durante il salvataggio dell\'accettazione del regolamento.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAdminRegulation = async (e) => {
    e.preventDefault();
    if (!editVersion.trim() || !editTitle.trim() || !editContent.trim()) {
      setError('Versione, titolo e contenuto sono obbligatori.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSaveSuccessMsg('');
    try {
      await updateCompanyRegulation({
        version: editVersion.trim(),
        title: editTitle.trim(),
        content: editContent.trim(),
        isActive: true
      });
      setSaveSuccessMsg('Regolamento salvato e pubblicato con successo sul database!');
      setIsAdminEditing(false);
    } catch (err) {
      setError(err.message || 'Errore durante il salvataggio del regolamento.');
    } finally {
      setSubmitting(false);
    }
  };

  const formattedAcceptedDate = user?.rulesAcceptedAt
    ? new Date(user.rulesAcceptedAt).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  const renderContentBlocks = (rawContent) => {
    if (!rawContent) return null;

    const paragraphs = rawContent.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

    return paragraphs.map((paragraph, pIdx) => {
      // Se il blocco inizia con un numero di sezione es. "1. " o "1.⁠ "
      const sectionMatch = paragraph.match(/^(\d+[.\s\u2060]+[^\n]+)/);
      if (sectionMatch) {
        const sectionTitle = sectionMatch[1];
        const rest = paragraph.slice(sectionTitle.length).trim();
        const items = rest.split('\n').map(l => l.trim()).filter(Boolean);

        return (
          <div key={pIdx} className="rules-section">
            <h4 className="rules-section-title">{sectionTitle}</h4>
            {items.map((item, itemIdx) => {
              const colonIdx = item.indexOf(':');
              if (colonIdx !== -1 && colonIdx < 50) {
                const label = item.slice(0, colonIdx + 1);
                const body = item.slice(colonIdx + 1);
                return (
                  <div key={itemIdx} className="rules-item">
                    <strong>{label}</strong>{body}
                  </div>
                );
              }
              return (
                <div key={itemIdx} className="rules-item">
                  {item}
                </div>
              );
            })}
          </div>
        );
      }

      // Paragrafo conclusivo
      if (
        paragraph.toLowerCase().includes('risorsa condivisa') || 
        paragraph.toLowerCase().includes('parità di trattamento')
      ) {
        return (
          <div key={pIdx} className="rules-conclusion">
            <p>{paragraph}</p>
          </div>
        );
      }

      // Testo introduttivo o generico
      return (
        <p key={pIdx} className="rules-plain-paragraph">
          {paragraph}
        </p>
      );
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isAdminEditing ? "Modifica Regolamento Aziendale (Admin)" : "Regolamento Parcheggi Aziendali"}
      maxWidth="780px"
      className="rules-modal"
    >
      <div className="rules-modal-container">
        {/* Banner di stato */}
        {!isAdminEditing && (
          alreadyAccepted ? (
            <div className="rules-status-banner success">
              <FaCheckCircle className="banner-icon" />
              <div>
                <strong>Regolamento accettato (v{currentVersion})</strong>
                {formattedAcceptedDate && (
                  <span className="banner-date"> — Sottoscritto il {formattedAcceptedDate}</span>
                )}
                <p className="banner-subtext">
                  Hai sottoscritto l'attuale versione valida per l’utilizzo dei parcheggi aziendali.
                </p>
              </div>
            </div>
          ) : isOutdatedAcceptance ? (
            <div className="rules-status-banner warning">
              <FaExclamationTriangle className="banner-icon" />
              <div>
                <strong>Nuova Versione Rilasciata (v{currentVersion})</strong>
                <p className="banner-subtext">
                  Avevi precedentemente accettato la versione <strong>v{userVersion}</strong>. È necessario leggere e accettare la nuova versione aggiornata per poter continuare a inviare richieste di parcheggio.
                </p>
              </div>
            </div>
          ) : (
            <div className="rules-status-banner warning">
              <FaExclamationTriangle className="banner-icon" />
              <div>
                <strong>Attenzione: Accettazione Obbligatoria (v{currentVersion})</strong>
                <p className="banner-subtext">
                  Per poter inviare richieste di prenotazione parcheggio è necessario prendere visione e accettare il regolamento aziendale.
                </p>
              </div>
            </div>
          )
        )}

        {saveSuccessMsg && <div className="rules-status-banner success">{saveSuccessMsg}</div>}
        {error && <div className="rules-error-msg">{error}</div>}

        {/* Modalità Modifica per Admin */}
        {isAdminEditing ? (
          <form onSubmit={handleSaveAdminRegulation} className="rules-edit-form">
            <div className="rules-edit-info">
              <FaInfoCircle />
              <span>
                Se modifichi e incrementi la <strong>Versione</strong> (es. da 1.0 a 2.0), tutti gli utenti (inclusi quelli precedentemente registrati) dovranno accettare la nuova versione prima di poter inviare richieste.
              </span>
            </div>

            <div className="rules-edit-row">
              <div className="rules-edit-group version-group">
                <label htmlFor="reg-version">Versione *</label>
                <input
                  id="reg-version"
                  type="text"
                  value={editVersion}
                  onChange={(e) => setEditVersion(e.target.value)}
                  placeholder="es. 1.1 o 2.0"
                  required
                />
              </div>
              <div className="rules-edit-group title-group">
                <label htmlFor="reg-title">Titolo Regolamento *</label>
                <input
                  id="reg-title"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Titolo del regolamento..."
                  required
                />
              </div>
            </div>

            <div className="rules-edit-group">
              <label htmlFor="reg-content">Testo del Regolamento (salvato su DB) *</label>
              <textarea
                id="reg-content"
                rows="14"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Inserisci il testo del regolamento..."
                className="rules-edit-textarea"
                required
              />
            </div>

            <div className="rules-actions">
              <button
                type="button"
                className="rules-btn secondary"
                onClick={() => { setIsAdminEditing(false); setError(''); }}
                disabled={submitting}
              >
                <FaTimes /> Annulla
              </button>
              <button
                type="submit"
                className="rules-btn primary"
                disabled={submitting}
              >
                {submitting ? 'Salvataggio in corso...' : <><FaSave /> Salva e Pubblica su DB</>}
              </button>
            </div>
          </form>
        ) : (
          /* Visualizzazione Regolamento */
          <>
            <div className="rules-content-scrollable">
              <header className="rules-doc-header">
                <div className="rules-doc-icon">
                  <FaFileContract />
                </div>
                <div className="rules-doc-meta">
                  <div className="rules-header-top">
                    <h3 className="rules-doc-title">
                      {activeRegulation?.title || "Regolamento per l’Utilizzo dei Parcheggi Aziendali – Sede di Chiasso"}
                    </h3>
                    <span className="rules-version-pill">v{currentVersion}</span>
                  </div>
                </div>
              </header>

              <div className="rules-doc-body">
                {renderContentBlocks(activeRegulation?.content)}
              </div>
            </div>

            {/* Checkbox di accettazione (se non ancora accettata questa versione e non sola lettura) */}
            {!alreadyAccepted && !isReadOnly && (
              <div className="rules-agreement-box">
                <label className="rules-checkbox-label">
                  <input
                    type="checkbox"
                    checked={isAgreed}
                    onChange={(e) => setIsAgreed(e.target.checked)}
                    disabled={submitting}
                  />
                  <span>
                    Dichiaro di aver letto, compreso e accettato integralmente il Regolamento per l’Utilizzo dei Parcheggi Aziendali (versione {currentVersion}).
                  </span>
                </label>
              </div>
            )}

            <div className="rules-actions">
              {user?.isAdmin && (
                <button
                  type="button"
                  className="rules-btn admin-btn"
                  onClick={() => setIsAdminEditing(true)}
                  title="Modifica il testo o pubblica una nuova versione"
                >
                  <FaEdit /> Modifica Regolamento (Admin)
                </button>
              )}

              {alreadyAccepted || isReadOnly ? (
                <button type="button" className="rules-btn primary" onClick={onClose}>
                  <FaCheck /> Chiudi
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="rules-btn secondary"
                    onClick={onClose}
                    disabled={submitting}
                  >
                    <FaTimes /> Non accetto
                  </button>
                  <button
                    type="button"
                    className="rules-btn primary"
                    onClick={handleAccept}
                    disabled={!isAgreed || submitting}
                  >
                    {submitting ? (
                      <>Salvataggio in corso...</>
                    ) : (
                      <><FaCheck /> Accetto il Regolamento</>
                    )}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default RulesModal;
