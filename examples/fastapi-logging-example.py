#!/usr/bin/env python3
"""
⚠️  DEPRECATED - Use fastapi_example/ directory instead

This is the legacy FastAPI example. For the latest, modular approach,
please use the files in the fastapi_example/ directory:

- fastapi_example/cloudflare_logger.py - Modular logging handler
- fastapi_example/main.py - Complete FastAPI example
- fastapi_example/README.md - Detailed documentation

This file is kept for reference only.
"""

import httpx
import asyncio
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
import json

class CloudflareLogHandler(logging.Handler):
    """Custom logging handler that sends logs to Cloudflare Workers."""

    def __init__(self, worker_url: str, batch_size: int = 10):
        super().__init__()
        self.worker_url = worker_url.rstrip('/')
        self.batch_size = batch_size
        self.log_buffer: List[Dict[str, Any]] = []
        self.client = httpx.AsyncClient(timeout=30.0)

    def emit(self, record: logging.LogRecord):
        """Emit a log record to Cloudflare Workers."""
        try:
            # Convert log record to our format
            log_entry = {
                "level": record.levelname,
                "loggerName": record.name,
                "message": record.getMessage(),
                "module": record.module,
                "functionName": record.funcName,
                "lineNumber": record.lineno,
                "threadId": str(record.thread),
                "processId": record.process,
                "extraData": {
                    "pathname": record.pathname,
                    "filename": record.filename,
                    "created": record.created,
                    "msecs": record.msecs,
                    "relativeCreated": record.relativeCreated,
                    "threadName": record.threadName,
                    "processName": record.processName,
                    "args": str(record.args) if record.args else None,
                    "exc_info": str(record.exc_info) if record.exc_info else None,
                    "exc_text": record.exc_text,
                    "stack_info": record.stack_info
                }
            }

            # Add to buffer
            self.log_buffer.append(log_entry)

            # Send batch if buffer is full
            if len(self.log_buffer) >= self.batch_size:
                asyncio.create_task(self._send_batch())

        except Exception as e:
            print(f"Error in CloudflareLogHandler: {e}")

    async def _send_batch(self):
        """Send a batch of log entries to Cloudflare Workers."""
        if not self.log_buffer:
            return

        try:
            batch = self.log_buffer.copy()
            self.log_buffer.clear()

            response = await self.client.post(
                f"{self.worker_url}/logs",
                headers={
                    "Content-Type": "application/json"
                },
                json=batch
            )

            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    print(f"Successfully sent {len(batch)} log entries")
                else:
                    print(f"Failed to send logs: {result.get('message')}")
            else:
                print(f"HTTP error {response.status_code}: {response.text}")

        except Exception as e:
            print(f"Error sending log batch: {e}")
            # Re-add logs to buffer for retry
            self.log_buffer.extend(batch)

    async def flush(self):
        """Flush any remaining logs in the buffer."""
        if self.log_buffer:
            await self._send_batch()

    async def close(self):
        """Close the handler and flush remaining logs."""
        await self.flush()
        await self.client.aclose()

# Example usage
async def setup_logging(worker_url: str):
    """Set up logging with Cloudflare Workers integration."""

    # Create the custom handler
    cf_handler = CloudflareLogHandler(worker_url)

    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),  # Also log to console
            cf_handler  # Send to Cloudflare Workers
        ]
    )

    return cf_handler

# Example FastAPI application
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FastAPI Logging Example")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global logger
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    """Initialize logging on startup."""
    # Replace with your actual Cloudflare Workers URL
    worker_url = "https://your-worker.your-subdomain.workers.dev"

    # Set up logging
    await setup_logging(worker_url)
    logger.info("FastAPI application started with Cloudflare Workers logging")

@app.get("/")
async def root():
    """Root endpoint."""
    logger.info("Root endpoint accessed")
    return {"message": "FastAPI with Cloudflare Workers logging"}

@app.get("/test-logs")
async def test_logs():
    """Test endpoint that generates various log levels."""
    logger.debug("This is a debug message")
    logger.info("This is an info message")
    logger.warning("This is a warning message")
    logger.error("This is an error message")
    logger.critical("This is a critical message")

    return {"message": "Test logs generated"}

@app.get("/error-test")
async def error_test():
    """Test endpoint that generates an error."""
    try:
        # This will cause an error
        result = 1 / 0
    except Exception as e:
        logger.error(f"Division by zero error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/custom-log")
async def custom_log(level: str, message: str, extra_data: Optional[Dict[str, Any]] = None):
    """Endpoint to create custom log entries."""
    log_entry = {
        "level": level.upper(),
        "message": message,
        "extraData": extra_data or {}
    }

    # Send directly to Cloudflare Workers
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://your-worker.your-subdomain.workers.dev/logs",
                headers={
                    "Content-Type": "application/json"
                },
                json=log_entry
            )

            if response.status_code == 200:
                result = response.json()
                return {"success": True, "logId": result.get("logId")}
            else:
                return {"success": False, "error": response.text}

        except Exception as e:
            logger.error(f"Failed to send custom log: {e}")
            return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
