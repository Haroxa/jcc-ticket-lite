CREATE TABLE live_rank_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'countdown', 'frozen', 'pending_settlement', 'settled', 'cancelled')),
  countdown_seconds INTEGER NOT NULL DEFAULT 180,
  countdown_started_at TEXT,
  countdown_ends_at TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  frozen_at TEXT,
  settled_at TEXT,
  note TEXT,
  created_by TEXT NOT NULL,
  settled_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES accounts(id),
  FOREIGN KEY (settled_by) REFERENCES accounts(id)
);

CREATE INDEX idx_live_rank_sessions_status ON live_rank_sessions(status);
CREATE INDEX idx_live_rank_sessions_created_at ON live_rank_sessions(created_at);

CREATE TABLE live_rank_entries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  gift_diamonds INTEGER NOT NULL DEFAULT 0,
  ticket_used INTEGER NOT NULL DEFAULT 0,
  ticket_deposit INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES live_rank_sessions(id),
  FOREIGN KEY (person_id) REFERENCES ticket_people(id)
);

CREATE UNIQUE INDEX idx_live_rank_entries_session_person ON live_rank_entries(session_id, person_id);
CREATE INDEX idx_live_rank_entries_session_score ON live_rank_entries(session_id, gift_diamonds, ticket_used, ticket_deposit);

CREATE TABLE live_rank_freezes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  frozen_at TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES live_rank_sessions(id),
  FOREIGN KEY (created_by) REFERENCES accounts(id)
);

CREATE INDEX idx_live_rank_freezes_session ON live_rank_freezes(session_id, frozen_at);
