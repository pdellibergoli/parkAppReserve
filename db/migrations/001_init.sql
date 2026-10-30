-- Le colonne con l'id del posto non hanno foreign key di proposito:
-- lo storico sopravvive all'eliminazione del posto e 'forced' indica un overbooking.

CREATE TABLE users (
  id                 TEXT PRIMARY KEY,
  first_name         TEXT NOT NULL,
  last_name          TEXT,
  mail               TEXT NOT NULL UNIQUE,
  password           TEXT NOT NULL,
  salt               TEXT NOT NULL,
  avatar_color       TEXT,
  is_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token TEXT,
  reset_token        TEXT,
  reset_token_expiry TIMESTAMPTZ,
  is_admin           BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_theme    TEXT,
  primary_color      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX users_verification_token_idx ON users (verification_token);
CREATE INDEX users_reset_token_idx ON users (reset_token);

CREATE TABLE parking_spaces (
  id       TEXT PRIMARY KEY,
  number   TEXT NOT NULL,
  is_fixed BOOLEAN NOT NULL DEFAULT FALSE,
  seq      BIGSERIAL NOT NULL
);

CREATE TABLE parking_requests (
  request_id                    TEXT PRIMARY KEY,
  user_id                       TEXT NOT NULL REFERENCES users (id),
  requested_date                DATE NOT NULL,
  status                        TEXT NOT NULL
    CHECK (status IN ('pending', 'assigned', 'not_assigned', 'cancelled_by_user')),
  assigned_parking_space_id     TEXT,
  assigned_parking_space_number TEXT
);
CREATE INDEX parking_requests_date_idx ON parking_requests (requested_date, status);
CREATE INDEX parking_requests_user_idx ON parking_requests (user_id, requested_date);

CREATE TABLE assignment_history (
  id               BIGSERIAL PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users (id),
  assignment_date  DATE NOT NULL,
  parking_space_id TEXT
);
CREATE INDEX assignment_history_date_idx ON assignment_history (assignment_date, user_id);

CREATE TABLE temporary_availability (
  availability_id  TEXT PRIMARY KEY,
  parking_space_id TEXT NOT NULL,
  available_date   DATE NOT NULL
);
CREATE INDEX temporary_availability_date_idx ON temporary_availability (available_date, parking_space_id);

CREATE TABLE temporary_unavailability (
  unavailability_id TEXT PRIMARY KEY,
  parking_space_id  TEXT NOT NULL,
  unavailable_date  DATE NOT NULL
);
CREATE INDEX temporary_unavailability_date_idx ON temporary_unavailability (unavailable_date, parking_space_id);

CREATE TABLE communications (
  id            TEXT PRIMARY KEY,
  message       TEXT NOT NULL,
  is_persistent BOOLEAN NOT NULL DEFAULT FALSE,
  start_date    DATE,
  end_date      DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
