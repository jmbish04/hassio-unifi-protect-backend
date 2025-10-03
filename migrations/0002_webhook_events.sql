-- Webhook events table (stores raw webhook data before processing)
CREATE TABLE IF NOT EXISTS webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE NOT NULL,
    camera_enum_id TEXT NOT NULL, -- References cameras.enum_id
    event_type TEXT NOT NULL, -- 'motion', 'doorbell', 'person', etc.
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_payload TEXT NOT NULL, -- JSON payload from webhook
    thumbnail_r2_key TEXT, -- R2 key for thumbnail if present
    patrol_run_id TEXT, -- References patrol_runs.id when processed
    processed BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Face recognition table
CREATE TABLE IF NOT EXISTS faces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    face_uuid TEXT UNIQUE NOT NULL,
    person_name TEXT, -- NULL until identified
    embeddings TEXT NOT NULL, -- JSON array of embeddings
    r2_key TEXT NOT NULL, -- R2 path: faces/{face_uuid}/image.jpg
    tags TEXT, -- JSON object with AI-generated tags
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    confidence REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Webhook-specific security patrol configurations (extends existing patrol_job_configs)
CREATE TABLE IF NOT EXISTS webhook_patrol_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patrol_job_config_id INTEGER NOT NULL REFERENCES patrol_job_configs(id) ON DELETE CASCADE,
    camera_enum_id TEXT NOT NULL, -- References cameras.enum_id
    trigger_event TEXT NOT NULL, -- 'motion', 'doorbell', etc.
    ai_analysis_type TEXT NOT NULL, -- 'face_recognition', 'tesla_patrol', etc.
    config_json TEXT NOT NULL, -- JSON configuration
    enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tesla patrol sessions (extends patrol_runs for Tesla-specific data)
CREATE TABLE IF NOT EXISTS tesla_patrol_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patrol_run_id TEXT NOT NULL REFERENCES patrol_runs(id) ON DELETE CASCADE,
    session_uuid TEXT UNIQUE NOT NULL,
    camera_enum_id TEXT NOT NULL, -- References cameras.enum_id
    tesla_detected BOOLEAN DEFAULT FALSE,
    garage_door_status TEXT, -- 'open', 'closed', 'closing', 'opening'
    snapshots_taken INTEGER DEFAULT 0,
    max_snapshots INTEGER DEFAULT 12, -- 60 seconds / 5 seconds
    result TEXT, -- 'garage_closed_manually', 'garage_closed_automatically', 'garage_open_unable_to_close'
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tesla patrol snapshots (uses observations table for main data, this for Tesla-specific metadata)
CREATE TABLE IF NOT EXISTS tesla_patrol_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    observation_id INTEGER NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
    snapshot_number INTEGER NOT NULL,
    tesla_visible BOOLEAN DEFAULT FALSE,
    garage_door_visible BOOLEAN DEFAULT FALSE,
    vehicle_movement TEXT, -- 'backing_out', 'pulling_in', 'stationary', 'none'
    ai_analysis TEXT -- JSON with AI analysis results
);

-- Notifications log
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_type TEXT NOT NULL, -- 'garage_door_status', 'face_detected', etc.
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT, -- JSON with additional data
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    delivery_status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    retry_count INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_camera_enum_id ON webhook_events(camera_enum_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_timestamp ON webhook_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_patrol_run_id ON webhook_events(patrol_run_id);

CREATE INDEX IF NOT EXISTS idx_faces_face_uuid ON faces(face_uuid);
CREATE INDEX IF NOT EXISTS idx_faces_person_name ON faces(person_name);
CREATE INDEX IF NOT EXISTS idx_faces_last_seen ON faces(last_seen);

CREATE INDEX IF NOT EXISTS idx_tesla_patrol_sessions_patrol_run_id ON tesla_patrol_sessions(patrol_run_id);
CREATE INDEX IF NOT EXISTS idx_tesla_patrol_sessions_camera_enum_id ON tesla_patrol_sessions(camera_enum_id);
CREATE INDEX IF NOT EXISTS idx_tesla_patrol_sessions_session_uuid ON tesla_patrol_sessions(session_uuid);

CREATE INDEX IF NOT EXISTS idx_tesla_patrol_snapshots_observation_id ON tesla_patrol_snapshots(observation_id);

CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_notifications_delivery_status ON notifications(delivery_status);

-- Note: Webhook patrol configurations will be created via the existing patrol_job_configs system
-- This allows integration with the existing security patrol framework
