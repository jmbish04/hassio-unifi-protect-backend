-- Unit Test Management Tables
-- Migration: 0003_unit_test_tables.sql

/*
================================================================================
UNIT TEST MANAGEMENT SCHEMA
================================================================================

PURPOSE:
--------
This schema manages unit test execution tracking for a FastAPI server that
initiates long-running unit tests on worker nodes. The worker posts test
results back to the FastAPI server via POST endpoints.

WORKFLOW:
---------
1. FastAPI server creates a new test session in `unit_test_sessions`
2. FastAPI server initiates unit tests on the worker (passing session_id)
3. Worker executes tests and posts results back to FastAPI endpoints
4. FastAPI endpoints insert/update records in `unit_test_results`
5. Session status is updated as tests complete

WORKER SELF-TESTING:
-------------------
The worker CAN record its own unit test results into these tables by:
- Creating a new session via POST to the FastAPI endpoint (e.g., /test-sessions)
- Posting individual test results via POST endpoint (e.g., /test-results)
- The worker's self-tests (tests that verify worker endpoints) follow the same
  workflow as any other test execution - the worker acts as both test executor
  AND client posting results back to the FastAPI server

This allows the worker to:
- Test its own endpoints using the same infrastructure
- Record results in the centralized FastAPI database
- Track worker self-tests alongside other test executions

TABLES:
-------
- unit_test_sessions: Tracks overall test execution sessions
- unit_test_results: Stores individual test results within sessions

================================================================================
*/

-- Unit test sessions table
-- Represents a single test execution run (e.g., full test suite execution)
CREATE TABLE IF NOT EXISTS unit_test_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,           -- UUID for this test session
    timestamp_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    timestamp_completed DATETIME,               -- NULL until session completes
    status TEXT NOT NULL DEFAULT 'running',    -- 'running', 'completed', 'failed', 'cancelled'
    total_tests INTEGER DEFAULT 0,             -- Total number of tests in session
    completed_tests INTEGER DEFAULT 0,          -- Number of tests finished (any status)
    failed_tests INTEGER DEFAULT 0,             -- Number of tests with 'failed' or 'error' status
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Unit test results table
-- Stores individual test results within a session
CREATE TABLE IF NOT EXISTS unit_test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,                  -- Links to unit_test_sessions.session_id
    test_name TEXT NOT NULL,                   -- Unique test identifier (e.g., 'test_user_login')
    test_category TEXT,                        -- Optional: 'unit', 'integration', 'e2e', etc.
    timestamp_start DATETIME,                  -- When this specific test started
    timestamp_completed DATETIME,               -- When this specific test finished
    status TEXT NOT NULL DEFAULT 'pending',    -- 'pending', 'running', 'passed', 'failed', 'skipped', 'error'
    test_results TEXT,                         -- JSON string with detailed results/assertions
    error_message TEXT,                        -- Error details if status is 'failed' or 'error'
    duration_ms INTEGER,                       -- Test execution time in milliseconds
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES unit_test_sessions(session_id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_unit_test_sessions_session_id ON unit_test_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_unit_test_sessions_status ON unit_test_sessions(status);
CREATE INDEX IF NOT EXISTS idx_unit_test_results_session_id ON unit_test_results(session_id);
CREATE INDEX IF NOT EXISTS idx_unit_test_results_test_name ON unit_test_results(test_name);
CREATE INDEX IF NOT EXISTS idx_unit_test_results_status ON unit_test_results(status);
CREATE INDEX IF NOT EXISTS idx_unit_test_results_timestamp ON unit_test_results(timestamp_completed);
