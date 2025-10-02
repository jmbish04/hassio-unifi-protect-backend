-- D1 / SQLite schema for Security Patrol
PRAGMA foreign_keys = ON;

-- =========================
-- 1) Reference: Cameras
-- =========================
CREATE TABLE IF NOT EXISTS cameras (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  enum_id         TEXT    NOT NULL UNIQUE,         -- stable programmatic key (e.g., 'FRONT', 'GARAGE')
  name            TEXT    NOT NULL,                -- human label
  location        TEXT,                            -- short loc string (e.g., "Front Porch")
  oversees        TEXT,                            -- what it sees (free text)
  rules_json      TEXT,                            -- JSON array of rule hints for this camera (optional)
  baseline_prompt TEXT,                            -- baseline prompt appended to AI requests for this camera
  is_active       INTEGER NOT NULL DEFAULT 1,      -- 1=true, 0=false
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_cameras_active ON cameras(is_active);

-- =========================
-- 2) Patrol Job Configs
-- =========================
CREATE TABLE IF NOT EXISTS patrol_job_configs (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  name                     TEXT    NOT NULL,
  description              TEXT,
  type                     TEXT    NOT NULL
                                CHECK (type IN ('SCHEDULED','EVENT_TRIGGER','WEBHOOK','API')),
  timezone                 TEXT    NOT NULL DEFAULT 'UTC',   -- e.g., 'America/Los_Angeles'
  overall_prompt           TEXT,                              -- global system/user prompt for the job
  deliverable_instructions TEXT,                              -- e.g., HTML template guidance, R2 policy
  priority                 INTEGER NOT NULL DEFAULT 0,        -- higher = sooner
  is_enabled               INTEGER NOT NULL DEFAULT 1,
  created_at               INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at               INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_job_configs_enabled ON patrol_job_configs(is_enabled, type);

-- Which cameras a job uses (and per-camera overrides)
CREATE TABLE IF NOT EXISTS patrol_job_cameras (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  config_id                INTEGER NOT NULL REFERENCES patrol_job_configs(id) ON DELETE CASCADE,
  camera_id                INTEGER NOT NULL REFERENCES cameras(id)            ON DELETE CASCADE,
  job_specific_prompt      TEXT,        -- appended after camera.baseline_prompt
  deliverable_instructions TEXT,        -- overrides/extends job-level deliverables for this camera
  weight                   INTEGER NOT NULL DEFAULT 1,  -- selection/ordering weight if you don’t process all
  is_enabled               INTEGER NOT NULL DEFAULT 1,
  UNIQUE (config_id, camera_id)
);

CREATE INDEX IF NOT EXISTS idx_job_cameras_enabled ON patrol_job_cameras(config_id, is_enabled);

-- =========================
-- 3) Triggers
-- =========================
-- Cron schedules (M:1 with job config; one row per frequency)
CREATE TABLE IF NOT EXISTS patrol_job_cron_schedules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  config_id   INTEGER NOT NULL REFERENCES patrol_job_configs(id) ON DELETE CASCADE,
  cron_string TEXT    NOT NULL,                 -- standard CF Workers cron format
  active_from INTEGER,                          -- unix ts (optional)
  active_to   INTEGER,                          -- unix ts (optional)
  UNIQUE (config_id, cron_string)
);

-- Event triggers (Protect/HA/etc.)
CREATE TABLE IF NOT EXISTS patrol_job_event_triggers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  config_id     INTEGER NOT NULL REFERENCES patrol_job_configs(id) ON DELETE CASCADE,
  event_trigger TEXT    NOT NULL,             -- e.g., 'doorbell_chime', 'camera_motion_detected'
  webhook_path  TEXT,                         -- path your Worker exposes, e.g., '/webhook/protect'
  api_endpoint  TEXT,                         -- optional: internal API endpoint you might poll/call
  secret_hmac   TEXT,                         -- optional shared secret for webhook verification
  UNIQUE (config_id, event_trigger)
);

-- For API-triggered jobs you don’t need extra rows, but this view helps discover callable endpoints
CREATE VIEW IF NOT EXISTS v_job_api_endpoints AS
SELECT
  c.id   AS config_id,
  c.name AS job_name,
  '/agent/security_sweep?config_id=' || c.id AS api_call
FROM patrol_job_configs c
WHERE c.type IN ('API','WEBHOOK');

-- =========================
-- 4) Execution Logging
-- =========================
CREATE TABLE IF NOT EXISTS patrol_runs (
  id             TEXT    PRIMARY KEY,                 -- UUID
  config_id      INTEGER REFERENCES patrol_job_configs(id) ON DELETE SET NULL,
  trigger_source TEXT    NOT NULL,                    -- 'cron', 'api', 'event:<name>', 'webhook:<path>'
  started_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at   INTEGER,                             -- set on finish
  status         TEXT    NOT NULL DEFAULT 'RUNNING'   -- RUNNING|SUCCESS|PARTIAL|ERROR
                       CHECK (status IN ('RUNNING','SUCCESS','PARTIAL','ERROR')),
  summary        TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_config_time ON patrol_runs(config_id, started_at DESC);

CREATE TABLE IF NOT EXISTS observations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id    TEXT    NOT NULL REFERENCES patrol_runs(id) ON DELETE CASCADE,
  camera_id INTEGER NOT NULL REFERENCES cameras(id)     ON DELETE CASCADE,
  rule      TEXT    NOT NULL,                           -- e.g., 'car_and_door_open'
  result    TEXT    NOT NULL CHECK (result IN ('pass','warn','fail')),
  details   TEXT,                                       -- JSON: vision output, HA states, etc.
  r2_key    TEXT,                                       -- where the snapshot/video was stored
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (run_id, camera_id, rule)
);

CREATE INDEX IF NOT EXISTS idx_obs_run ON observations(run_id);
CREATE INDEX IF NOT EXISTS idx_obs_camera ON observations(camera_id);

-- =========================
-- 5) Derived Outputs / Actuation
-- =========================
-- Booleans you set back in HA (persist for audit & dashboards)
CREATE TABLE IF NOT EXISTS output_booleans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id      TEXT    NOT NULL REFERENCES patrol_runs(id) ON DELETE CASCADE,
  entity_id   TEXT    NOT NULL,     -- e.g., 'input_boolean.car_and_door_open'
  value       INTEGER NOT NULL,     -- 0/1
  reason      TEXT,                 -- short note like 'rule:car_and_door_open'
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (run_id, entity_id)
);

-- =========================
-- 6) Maintain updated_at
-- =========================
-- (SQLite trigger style; D1 supports triggers)
CREATE TRIGGER IF NOT EXISTS trg_cameras_updated
AFTER UPDATE ON cameras
BEGIN
  UPDATE cameras SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_job_configs_updated
AFTER UPDATE ON patrol_job_configs
BEGIN
  UPDATE patrol_job_configs SET updated_at = unixepoch() WHERE id = NEW.id;
END;
