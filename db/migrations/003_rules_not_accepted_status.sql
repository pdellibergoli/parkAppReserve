-- Consente il nuovo stato 'rules_not_accepted' per le richieste di parcheggio
-- Utilizzato quando un utente non ha ancora accettato l'ultima versione del regolamento aziendale,
-- evitando di influire negativamente o incrementare artificialmente le statistiche di priorità.
ALTER TABLE parking_requests DROP CONSTRAINT IF EXISTS parking_requests_status_check;
ALTER TABLE parking_requests ADD CONSTRAINT parking_requests_status_check
  CHECK (status IN ('pending', 'assigned', 'not_assigned', 'cancelled_by_user', 'rules_not_accepted'));
