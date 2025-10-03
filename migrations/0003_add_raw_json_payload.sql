-- Add column to store the original raw JSON payload from UniFi Protect
ALTER TABLE webhook_events ADD COLUMN original_json_payload TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_original_payload ON webhook_events(original_json_payload);

-- Add column to track content type for debugging
ALTER TABLE webhook_events ADD COLUMN content_type TEXT DEFAULT 'application/json';

-- Add index for content type queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_content_type ON webhook_events(content_type);
