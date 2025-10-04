# FastAPI Cloudflare Workers Logging Example

This directory contains a complete example for integrating Cloudflare Workers logging with FastAPI applications.

## Files

- **`cloudflare_logger.py`** - The main logging module to import into your FastAPI app
- **`main.py`** - Example FastAPI application using the logging module
- **`requirements.txt`** - Python dependencies for the examples

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Environment Variable

```bash
export WORKER_URL=https://your-worker.workers.dev
```

### 3. Run the Example

```bash
python main.py
```

## Usage in Your FastAPI App

### Basic Integration

```python
from cloudflare_logger import setup_cloudflare_logging
import logging

# In your FastAPI startup event
@app.on_event("startup")
async def startup():
    await setup_cloudflare_logging()
    logger = logging.getLogger(__name__)
    logger.info("App started with Cloudflare logging")
```

### Advanced Configuration

```python
from cloudflare_logger import setup_cloudflare_logging

# Custom configuration
await setup_cloudflare_logging(
    batch_size=20,           # Send logs in batches of 20
    log_level=logging.DEBUG, # Set log level
    include_console=True     # Also log to console
)
```

### Custom Log Functions

```python
from cloudflare_logger import log_info, log_error, log_warning

# Send custom logs
await log_info("User logged in", extra_data={"user_id": "123"})
await log_error("Database connection failed", logger_name="db")
await log_warning("High memory usage", extra_data={"usage": "85%"})
```

### Direct Log Sending

```python
from cloudflare_logger import send_custom_log

# Send a custom log with full control
result = await send_custom_log(
    level="INFO",
    message="Custom log message",
    logger_name="myapp.module",
    extra_data={"key": "value"},
    request_id="req-123",
    correlation_id="corr-456"
)
```

## Environment Variables

| Variable     | Description                 | Required |
| ------------ | --------------------------- | -------- |
| `WORKER_URL` | Your Cloudflare Workers URL | Yes      |

## Features

- **Automatic Batching**: Logs are batched and sent efficiently
- **Error Handling**: Robust error handling with retry logic
- **Async Support**: Fully async for FastAPI compatibility
- **Custom Fields**: Support for extra data, request IDs, correlation IDs
- **Multiple Log Levels**: DEBUG, INFO, WARNING, ERROR, CRITICAL
- **Console Logging**: Optional console output alongside Cloudflare logging

## Configuration Options

### `setup_cloudflare_logging()`

| Parameter         | Type | Default      | Description                            |
| ----------------- | ---- | ------------ | -------------------------------------- |
| `batch_size`      | int  | 10           | Number of logs to batch before sending |
| `log_level`       | int  | logging.INFO | Minimum log level to capture           |
| `include_console` | bool | True         | Whether to also log to console         |

### `send_custom_log()`

| Parameter        | Type | Required | Description                                       |
| ---------------- | ---- | -------- | ------------------------------------------------- |
| `level`          | str  | Yes      | Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL) |
| `message`        | str  | Yes      | Log message                                       |
| `logger_name`    | str  | No       | Logger name (default: "custom")                   |
| `extra_data`     | dict | No       | Additional structured data                        |
| `module`         | str  | No       | Module name                                       |
| `function_name`  | str  | No       | Function name                                     |
| `line_number`    | int  | No       | Line number                                       |
| `request_id`     | str  | No       | Request ID for correlation                        |
| `correlation_id` | str  | No       | Correlation ID for tracing                        |

## Error Handling

The logging module includes comprehensive error handling:

- **Network Errors**: Automatic retry for failed requests
- **Invalid URLs**: Clear error messages for missing WORKER_URL
- **Batch Failures**: Failed logs are re-added to the buffer for retry
- **Connection Timeouts**: Configurable timeout settings

## Performance Tips

1. **Batch Size**: Increase `batch_size` for high-volume applications
2. **Log Level**: Use appropriate log levels to reduce noise
3. **Async Usage**: Always use `await` when calling log functions
4. **Error Handling**: Monitor log sending failures in production

## Production Considerations

- **Rate Limiting**: Consider implementing rate limiting for very high-volume apps
- **Monitoring**: Monitor log sending success/failure rates
- **Fallback**: Consider fallback logging for critical applications
- **Security**: Ensure your Cloudflare Workers URL is secure

## Troubleshooting

### Common Issues

1. **"WORKER_URL environment variable is required"**
   - Set the WORKER_URL environment variable
   - Ensure it points to your Cloudflare Workers deployment

2. **"Failed to send logs"**
   - Check your Cloudflare Workers URL is correct
   - Verify your worker is deployed and running
   - Check network connectivity

3. **Logs not appearing**
   - Check the log level configuration
   - Verify the worker endpoint is working
   - Check Cloudflare Workers logs for errors

### Debug Mode

Enable debug logging to see detailed information:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```
