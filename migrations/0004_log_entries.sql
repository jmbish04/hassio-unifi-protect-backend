-- Create log_entries table for FastAPI log storage
-- TTL: 30 days (2592000 seconds)
CREATE TABLE IF NOT EXISTS log_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_id TEXT NOT NULL UNIQUE,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    level TEXT NOT NULL, -- DEBUG, INFO, WARNING, ERROR, CRITICAL
    logger_name TEXT,
    message TEXT NOT NULL,
    module TEXT,
    function_name TEXT,
    line_number INTEGER,
    thread_id TEXT,
    process_id INTEGER,
    extra_data JSON, -- Additional structured data
    source_ip TEXT,
    user_agent TEXT,
    request_id TEXT,
    correlation_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME DEFAULT (datetime('now', '+30 days'))
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_log_entries_timestamp ON log_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_log_entries_level ON log_entries(level);
CREATE INDEX IF NOT EXISTS idx_log_entries_logger_name ON log_entries(logger_name);
CREATE INDEX IF NOT EXISTS idx_log_entries_expires_at ON log_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_log_entries_request_id ON log_entries(request_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_correlation_id ON log_entries(correlation_id);

-- Create a trigger to automatically clean up expired entries
-- This will run on every INSERT to check for expired records
CREATE TRIGGER IF NOT EXISTS cleanup_expired_logs
    AFTER INSERT ON log_entries
BEGIN
    DELETE FROM log_entries WHERE expires_at < datetime('now');
END;
