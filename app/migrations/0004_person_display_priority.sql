ALTER TABLE ticket_people ADD COLUMN display_priority INTEGER NOT NULL DEFAULT 1 CHECK (display_priority BETWEEN 1 AND 20);

CREATE INDEX idx_ticket_people_display_priority ON ticket_people(display_priority);
