CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE ticket_people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  alias TEXT,
  status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'disabled', 'blocked')),
  cached_balance INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_ticket_people_status ON ticket_people(status);
CREATE INDEX idx_ticket_people_name ON ticket_people(name);

CREATE TABLE ticket_records (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdraw')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  balance_delta INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'voided')),
  note TEXT,
  void_reason TEXT,
  voided_by TEXT,
  voided_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (person_id) REFERENCES ticket_people(id),
  FOREIGN KEY (created_by) REFERENCES accounts(id)
);

CREATE INDEX idx_ticket_records_person ON ticket_records(person_id);
CREATE INDEX idx_ticket_records_recorded_at ON ticket_records(recorded_at);
CREATE INDEX idx_ticket_records_status ON ticket_records(status);
CREATE INDEX idx_ticket_records_type ON ticket_records(type);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_account_id TEXT,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  summary TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (actor_account_id) REFERENCES accounts(id)
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_account_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
