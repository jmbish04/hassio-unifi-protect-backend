-- RAW inbound events for audit / replay
CREATE TABLE IF NOT EXISTS inbound_events (
  id            TEXT PRIMARY KEY,                 -- UUID from Worker
  source        TEXT NOT NULL,                    -- 'protect','home_assistant', etc.
  event_type    TEXT NOT NULL,                    -- 'doorbell_chime','camera_motion_detected', ...
  received_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  event_time    INTEGER,                          -- if payload carries its own timestamp
  camera_enum   TEXT,                             -- as reported by source (string)
  camera_id     INTEGER REFERENCES cameras(id),   -- resolved FK if you can map it
  payload_json  TEXT NOT NULL,                    -- full raw payload
  processed     INTEGER NOT NULL DEFAULT 0,       -- 0=new,1=handled
  run_id        TEXT REFERENCES patrol_runs(id)   -- patrol run spawned by this event (if any)
);

CREATE INDEX IF NOT EXISTS idx_inbound_events_time ON inbound_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_events_cam ON inbound_events(camera_id, event_type, received_at DESC);
