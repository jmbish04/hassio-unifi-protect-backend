# Log Endpoints Documentation

This document describes the log endpoints available for FastAPI integration with automatic TTL (30 days).

## Overview

The log system provides a centralized way to store application logs in Cloudflare D1 with automatic cleanup after 30 days. It supports both single log entries and batch operations.

**Authentication Model:**

- **Writing Logs**: No authentication required (open for FastAPI integration)
- **Reading Logs**: API key authentication required (secure access to log data)

## Database Schema

The `log_entries` table includes:

- **TTL**: 30 days (automatic cleanup)
- **Indexes**: Optimized for common queries
- **Triggers**: Automatic cleanup of expired entries

## API Endpoints

### 1. POST `/logs` - Store Log Entries

Store single or multiple log entries. **No authentication required** - FastAPI can send logs freely.

**Headers:**

```
Content-Type: application/json
```

**Single Log Entry:**

```json
{
	"level": "INFO",
	"loggerName": "myapp.module",
	"message": "User logged in successfully",
	"module": "auth",
	"functionName": "login",
	"lineNumber": 42,
	"threadId": "12345",
	"processId": 6789,
	"extraData": {
		"userId": "user123",
		"ip": "192.168.1.1"
	},
	"requestId": "req-abc123",
	"correlationId": "corr-xyz789"
}
```

**Batch Log Entries:**

```json
[
	{
		"level": "INFO",
		"message": "First log entry",
		"loggerName": "app"
	},
	{
		"level": "ERROR",
		"message": "Second log entry",
		"loggerName": "app"
	}
]
```

**Response:**

```json
{
	"success": true,
	"message": "Log entry stored successfully",
	"logId": "uuid-here"
}
```

### 2. GET `/logs` - Retrieve Log Entries

Query log entries with optional filters. **Authentication required**.

**Headers:**

```
x-api-key: your-api-key
```

**Query Parameters:**

- `limit` (default: 100): Number of entries to return
- `offset` (default: 0): Number of entries to skip
- `level`: Filter by log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- `logger_name`: Filter by logger name
- `start_date`: Filter by start date (ISO format)
- `end_date`: Filter by end date (ISO format)
- `request_id`: Filter by request ID
- `correlation_id`: Filter by correlation ID

**Example:**

```
GET /logs?level=ERROR&limit=50&start_date=2024-01-01T00:00:00Z
```

**Response:**

```json
{
	"success": true,
	"message": "Retrieved 25 log entries",
	"count": 25,
	"entries": [
		{
			"logId": "uuid-here",
			"timestamp": "2024-01-15T10:30:00Z",
			"level": "ERROR",
			"loggerName": "myapp.auth",
			"message": "Login failed",
			"module": "auth",
			"functionName": "login",
			"lineNumber": 42,
			"threadId": "12345",
			"processId": 6789,
			"extraData": { "userId": "user123" },
			"sourceIp": "192.168.1.1",
			"userAgent": "Mozilla/5.0...",
			"requestId": "req-abc123",
			"correlationId": "corr-xyz789"
		}
	]
}
```

### 3. GET `/logs/stats` - Get Log Statistics

Retrieve statistics about stored log entries. **Authentication required**.

**Headers:**

```
x-api-key: your-api-key
```

**Response:**

```json
{
	"success": true,
	"message": "Log statistics retrieved successfully",
	"statistics": {
		"totalEntries": 1500,
		"entriesByLevel": {
			"INFO": 800,
			"WARNING": 300,
			"ERROR": 200,
			"CRITICAL": 50,
			"DEBUG": 150
		},
		"entriesByLogger": {
			"myapp.auth": 400,
			"myapp.api": 300,
			"myapp.database": 200
		},
		"oldestEntry": "2024-01-01T00:00:00Z",
		"newestEntry": "2024-01-15T10:30:00Z"
	}
}
```

### 4. POST `/logs/cleanup` - Manual Cleanup

Manually trigger cleanup of expired log entries. **Authentication required**.

**Headers:**

```
x-api-key: your-api-key
```

**Response:**

```json
{
	"success": true,
	"message": "Cleaned up 150 expired log entries",
	"count": 150
}
```

## FastAPI Integration

### Python Example

```python
import httpx
import logging
from typing import Dict, Any

class CloudflareLogHandler(logging.Handler):
    def __init__(self, worker_url: str, api_key: str):
        super().__init__()
        self.worker_url = worker_url
        self.api_key = api_key
        self.client = httpx.AsyncClient()

    def emit(self, record: logging.LogRecord):
        log_entry = {
            "level": record.levelname,
            "loggerName": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "functionName": record.funcName,
            "lineNumber": record.lineno,
            "extraData": {
                "pathname": record.pathname,
                "created": record.created
            }
        }

        # Send to Cloudflare Workers
        asyncio.create_task(self._send_log(log_entry))

    async def _send_log(self, log_entry: Dict[str, Any]):
        try:
            response = await self.client.post(
                f"{self.worker_url}/logs",
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": self.api_key
                },
                json=log_entry
            )
            print(f"Log sent: {response.status_code}")
        except Exception as e:
            print(f"Failed to send log: {e}")

# Setup logging
handler = CloudflareLogHandler("https://your-worker.workers.dev", "your-api-key")
logging.basicConfig(handlers=[handler])
logger = logging.getLogger(__name__)

# Use logger
logger.info("Application started")
logger.error("Something went wrong", extra={"userId": "123"})
```

### cURL Examples

**Single Log Entry:**

```bash
curl -X POST "https://your-worker.workers.dev/logs" \
  -H "Content-Type: application/json" \
  -d '{
    "level": "INFO",
    "message": "User action completed",
    "loggerName": "myapp",
    "extraData": {"userId": "123", "action": "login"}
  }'
```

**Batch Log Entries:**

```bash
curl -X POST "https://your-worker.workers.dev/logs" \
  -H "Content-Type: application/json" \
  -d '[
    {"level": "INFO", "message": "First log"},
    {"level": "ERROR", "message": "Second log"}
  ]'
```

**Query Logs:**

```bash
curl -X GET "https://your-worker.workers.dev/logs?level=ERROR&limit=10" \
  -H "x-api-key: your-api-key"
```

## TTL and Cleanup

- **Automatic TTL**: Log entries expire after 30 days
- **Automatic Cleanup**: Triggered on every INSERT operation
- **Scheduled Cleanup**: Runs daily via cron job
- **Manual Cleanup**: Available via `/logs/cleanup` endpoint

## Error Handling

All endpoints return consistent error responses:

```json
{
	"success": false,
	"message": "Error description",
	"error": "Detailed error message"
}
```

Common HTTP status codes:

- `200`: Success
- `400`: Bad Request (invalid JSON, missing required fields)
- `401`: Unauthorized (missing or invalid API key)
- `500`: Internal Server Error

## Performance Considerations

- **Batch Operations**: Use batch endpoints for multiple log entries
- **Async Processing**: Log entries are processed asynchronously
- **Indexing**: Database is indexed for common query patterns
- **TTL**: Automatic cleanup prevents database bloat

## Security

- **Write Access**: No authentication required for writing logs (FastAPI integration)
- **Read Access**: API key authentication required for viewing logs and statistics
- **Input Validation**: All inputs are validated and sanitized
- **Rate Limiting**: Consider implementing rate limiting for production use
- **HTTPS Only**: All communication should use HTTPS
