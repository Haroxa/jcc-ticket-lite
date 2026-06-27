ALTER TABLE live_rank_entries
ADD COLUMN rank_status TEXT NOT NULL DEFAULT 'normal'
CHECK (rank_status IN ('normal', 'pending', 'away'));

CREATE INDEX idx_live_rank_entries_session_status_score
  ON live_rank_entries(session_id, rank_status, gift_diamonds, ticket_used, ticket_deposit);
