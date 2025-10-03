#!/usr/bin/env python3
"""
Cloudflare Workers Logging Module for FastAPI

This module provides a custom logging handler that sends logs to Cloudflare Workers D1 database.
Import this module into your FastAPI application to enable centralized logging.

Usage:
    from cloudflare_logger import setup_cloudflare_logging

    # In your FastAPI app startup
    await setup_cloudflare_logging()
"""

import httpx
import asyncio
import logging
import os
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
                    print(f"Successfully sent {len(batch)} log entries to Cloudflare Workers")
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

def get_worker_url() -> str:
    """
    Get the Cloudflare Workers URL from environment variables.

    Looks for WORKER_URL environment variable and constructs the logs endpoint URL.
    Strips any trailing slashes and ensures proper URL format.

    Returns:
        str: The complete logs endpoint URL

    Raises:
        ValueError: If WORKER_URL environment variable is not set
    """
    worker_url = os.getenv('WORKER_URL')
    if not worker_url:
        raise ValueError("WORKER_URL environment variable is required")

    # Strip trailing slashes and construct logs endpoint
    base_url = worker_url.rstrip('/')
    logs_url = f"{base_url}/logs"

    return logs_url

async def setup_cloudflare_logging(
    batch_size: int = 10,
    log_level: int = logging.INFO,
    include_console: bool = True
) -> CloudflareLogHandler:
    """
    Set up Cloudflare Workers logging for your FastAPI application.

    Args:
        batch_size (int): Number of logs to batch before sending (default: 10)
        log_level (int): Logging level (default: logging.INFO)
        include_console (bool): Whether to also log to console (default: True)

    Returns:
        CloudflareLogHandler: The configured logging handler

    Raises:
        ValueError: If WORKER_URL environment variable is not set
    """
    # Get the worker URL from environment
    worker_url = get_worker_url()

    # Create the custom handler
    cf_handler = CloudflareLogHandler(worker_url, batch_size)

    # Configure logging
    handlers = [cf_handler]
    if include_console:
        handlers.append(logging.StreamHandler())

    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=handlers,
        force=True  # Override any existing configuration
    )

    # Get the root logger and add our handler if not already added
    root_logger = logging.getLogger()
    if cf_handler not in root_logger.handlers:
        root_logger.addHandler(cf_handler)

    print(f"Cloudflare Workers logging configured with endpoint: {worker_url}")
    return cf_handler

async def send_custom_log(
    level: str,
    message: str,
    logger_name: str = "custom",
    extra_data: Optional[Dict[str, Any]] = None,
    module: Optional[str] = None,
    function_name: Optional[str] = None,
    line_number: Optional[int] = None,
    request_id: Optional[str] = None,
    correlation_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send a custom log entry directly to Cloudflare Workers.

    Args:
        level (str): Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        message (str): Log message
        logger_name (str): Logger name (default: "custom")
        extra_data (dict): Additional structured data
        module (str): Module name
        function_name (str): Function name
        line_number (int): Line number
        request_id (str): Request ID for correlation
        correlation_id (str): Correlation ID for tracing

    Returns:
        dict: Response from Cloudflare Workers

    Raises:
        ValueError: If WORKER_URL environment variable is not set
    """
    worker_url = get_worker_url()

    log_entry = {
        "level": level.upper(),
        "loggerName": logger_name,
        "message": message,
        "module": module,
        "functionName": function_name,
        "lineNumber": line_number,
        "extraData": extra_data or {},
        "requestId": request_id,
        "correlationId": correlation_id
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                worker_url,
                headers={
                    "Content-Type": "application/json"
                },
                json=log_entry
            )

            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "logId": result.get("logId"),
                    "message": result.get("message")
                }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text}"
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

# Convenience functions for common log levels
async def log_info(message: str, **kwargs) -> Dict[str, Any]:
    """Log an INFO message."""
    return await send_custom_log("INFO", message, **kwargs)

async def log_warning(message: str, **kwargs) -> Dict[str, Any]:
    """Log a WARNING message."""
    return await send_custom_log("WARNING", message, **kwargs)

async def log_error(message: str, **kwargs) -> Dict[str, Any]:
    """Log an ERROR message."""
    return await send_custom_log("ERROR", message, **kwargs)

async def log_critical(message: str, **kwargs) -> Dict[str, Any]:
    """Log a CRITICAL message."""
    return await send_custom_log("CRITICAL", message, **kwargs)

async def log_debug(message: str, **kwargs) -> Dict[str, Any]:
    """Log a DEBUG message."""
    return await send_custom_log("DEBUG", message, **kwargs)
