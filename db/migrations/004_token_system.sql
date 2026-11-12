-- Tabella per le impostazioni globali dell'applicazione (es. data di partenza del sistema a gettoni)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Data di partenza predefinita per il sistema a gettoni (modificabile dagli amministratori)
INSERT INTO system_settings (key, value, updated_at)
VALUES ('token_system_start_date', '2026-01-01', now())
ON CONFLICT (key) DO NOTHING;
