#!/usr/bin/env python3
"""
Example FastAPI application using Cloudflare Workers logging.

This example shows how to integrate the cloudflare_logger module
into your FastAPI application.

Environment Variables Required:
- WORKER_URL: Your Cloudflare Workers URL (e.g., https://your-worker.workers.dev)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from cloudflare_logger import setup_cloudflare_logging, log_info, log_error, log_warning

# Create FastAPI app
app = FastAPI(
    title="FastAPI with Cloudflare Workers Logging",
    description="Example FastAPI app with centralized logging",
    version="1.0.0"
)

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
    try:
        # Set up Cloudflare Workers logging
        await setup_cloudflare_logging(
            batch_size=5,  # Send logs in batches of 5
            log_level=logging.INFO,
            include_console=True  # Also log to console
        )

        # Log startup
        logger.info("FastAPI application started with Cloudflare Workers logging")
        await log_info("Application startup completed", logger_name="app.startup")

    except ValueError as e:
        print(f"Logging setup failed: {e}")
        print("Make sure WORKER_URL environment variable is set")
    except Exception as e:
        print(f"Unexpected error during startup: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("FastAPI application shutting down")
    await log_info("Application shutdown initiated", logger_name="app.shutdown")

@app.get("/")
async def root():
    """Root endpoint."""
    logger.info("Root endpoint accessed")
    await log_info("Root endpoint accessed", logger_name="app.api")
    return {"message": "FastAPI with Cloudflare Workers logging"}

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    logger.info("Health check endpoint accessed")
    await log_info("Health check performed", logger_name="app.health")
    return {"status": "healthy", "service": "fastapi-app"}

@app.get("/test-logs")
async def test_logs():
    """Test endpoint that generates various log levels."""
    logger.debug("This is a debug message")
    logger.info("This is an info message")
    logger.warning("This is a warning message")
    logger.error("This is an error message")
    logger.critical("This is a critical message")

    # Also send custom logs
    await log_info("Test logs generated", logger_name="app.test")
    await log_warning("This is a custom warning", logger_name="app.test")

    return {"message": "Test logs generated - check your Cloudflare Workers logs"}

@app.get("/error-test")
async def error_test():
    """Test endpoint that generates an error."""
    try:
        # This will cause an error
        result = 1 / 0
    except Exception as e:
        logger.error(f"Division by zero error: {e}", exc_info=True)
        await log_error(
            f"Division by zero error: {e}",
            logger_name="app.error",
            extra_data={"error_type": "ZeroDivisionError", "operation": "division"}
        )
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/custom-log")
async def custom_log(
    level: str = "INFO",
    message: str = "Custom log message",
    logger_name: str = "app.custom",
    extra_data: dict = None
):
    """Endpoint to create custom log entries."""
    from cloudflare_logger import send_custom_log

    result = await send_custom_log(
        level=level,
        message=message,
        logger_name=logger_name,
        extra_data=extra_data or {},
        module="main",
        function_name="custom_log"
    )

    return {
        "success": result.get("success", False),
        "logId": result.get("logId"),
        "message": result.get("message", "Log sent")
    }

@app.get("/user/{user_id}")
async def get_user(user_id: str):
    """Example endpoint with user-specific logging."""
    logger.info(f"Fetching user: {user_id}")

    await log_info(
        f"User fetch requested",
        logger_name="app.users",
        extra_data={"user_id": user_id, "action": "fetch"},
        request_id=f"req-{user_id}"
    )

    # Simulate some processing
    if user_id == "error":
        logger.error("Simulated user fetch error")
        await log_error(
            "Simulated user fetch error",
            logger_name="app.users",
            extra_data={"user_id": user_id, "error": "simulated"}
        )
        raise HTTPException(status_code=404, detail="User not found")

    return {"user_id": user_id, "name": f"User {user_id}", "status": "active"}

if __name__ == "__main__":
    import uvicorn

    # Check if WORKER_URL is set
    if not os.getenv('WORKER_URL'):
        print("Warning: WORKER_URL environment variable is not set")
        print("Set it with: export WORKER_URL=https://your-worker.workers.dev")

    uvicorn.run(app, host="0.0.0.0", port=8000)
