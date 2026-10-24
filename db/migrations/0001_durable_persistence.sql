CREATE TABLE admin_owner_credentials (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  schema_version SMALLINT NOT NULL CHECK (schema_version = 1),
  algorithm TEXT NOT NULL CHECK (algorithm = 'scrypt'),
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  scrypt_cost INTEGER NOT NULL CHECK (scrypt_cost = 32768),
  scrypt_block_size INTEGER NOT NULL CHECK (scrypt_block_size = 8),
  scrypt_parallelization INTEGER NOT NULL CHECK (scrypt_parallelization = 3),
  scrypt_key_length INTEGER NOT NULL CHECK (scrypt_key_length = 64),
  session_signing_key TEXT NOT NULL,
  session_version UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE operator_availability (
  availability_date DATE PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('available', 'unavailable')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reservation_requests (
  sequence_id BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('farm_stay', 'wedding', 'retreat', 'other')
  ),
  guest_email TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  request_notes TEXT NOT NULL,
  requested_dates TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  status_updated_at TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (
    payment_status IN ('unpaid', 'paid')
  )
);

CREATE UNIQUE INDEX reservation_requests_one_accepted_exact_slot
  ON reservation_requests (requested_dates)
  WHERE status = 'accepted';

CREATE TABLE homepage_content (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
