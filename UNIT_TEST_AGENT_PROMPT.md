# Unit Test Management System - Python AI Agent Implementation Guide

## Overview

You are tasked with implementing a comprehensive unit test management system that integrates with the UniFi Protect API Worker. The system allows for long-running unit tests to be tracked, monitored, and managed through a centralized database.

## API Endpoints Available

### Base URL

```
https://unifi-protect-api.hacolby.workers.dev
```

### Worker Self-Test Endpoints

**POST** `/worker/self-test`

```json
{
	"base_url": "https://unifi-protect-api.hacolby.workers.dev",
	"api_key": "optional-api-key",
	"timeout_ms": 30000
}
```

**GET** `/worker/self-test/status?session_id={session_id}`
Returns detailed status of worker self-test execution.

### 1. Create Test Session

**POST** `/unit-tests/sessions`

```json
{
	"session_id": "uuid-string",
	"total_tests": 10
}
```

### 2. Create Test Records

**POST** `/unit-tests/sessions/{session_id}/tests`

```json
{
	"test_name": "test_camera_endpoint",
	"test_category": "unit"
}
```

### 3. Update Test Results

**POST** `/unit-tests/sessions/{session_id}/update-test`

```json
{
	"test_name": "test_camera_endpoint",
	"status": "running|passed|failed|skipped|error",
	"test_results": { "assertions": 5, "coverage": 85.2 },
	"error_message": "Connection timeout",
	"duration_ms": 1250
}
```

### 4. Complete Session

**POST** `/unit-tests/sessions/{session_id}/complete`

```json
{
	"status": "completed|failed|cancelled",
	"completed_tests": 8,
	"failed_tests": 2
}
```

### 5. Get Session Details

**GET** `/unit-tests/sessions/{session_id}`
Returns session info, all test results, and statistics.

## Implementation Requirements

### 1. Session Management

- Generate a unique UUID for each test session
- Track total expected tests vs completed tests
- Monitor session status (running, completed, failed, cancelled)

### 2. Test Tracking

- Create test records upfront for all planned tests
- Update test status as they run (pending → running → passed/failed)
- Store detailed test results as JSON
- Track test duration and error messages

### 3. Error Handling

- Implement retry logic for API calls
- Handle network timeouts gracefully
- Log all API interactions for debugging

### 4. Monitoring

- Provide real-time status updates
- Generate summary reports
- Alert on test failures or timeouts

## Worker Self-Testing

The worker can test its own endpoints using the `/worker/self-test` endpoint. This is useful for:

1. **Health Monitoring**: Regular self-tests to ensure all endpoints are working
2. **Deployment Validation**: Run self-tests after deployments to verify functionality
3. **Debugging**: Isolate issues with specific endpoints
4. **Performance Monitoring**: Track endpoint response times

### Self-Test Usage Example

```python
# Trigger worker self-tests
response = requests.post(
    "https://unifi-protect-api.hacolby.workers.dev/worker/self-test",
    json={
        "base_url": "https://unifi-protect-api.hacolby.workers.dev",
        "timeout_ms": 30000
    }
)

result = response.json()
print(f"Self-test session: {result['session_id']}")
print(f"Tests passed: {result['summary']['passed']}")
print(f"Tests failed: {result['summary']['failed']}")

# Check detailed status
status_response = requests.get(
    f"https://unifi-protect-api.hacolby.workers.dev/worker/self-test/status",
    params={"session_id": result['session_id']}
)
status = status_response.json()
print(f"Session status: {status['session']['status']}")
```

## Python Implementation Template

```python
import uuid
import requests
import time
import json
from typing import List, Dict, Any
from dataclasses import dataclass
from enum import Enum

class TestStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    ERROR = "error"

class SessionStatus(Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class TestDefinition:
    name: str
    category: str
    function: callable
    timeout: int = 300  # 5 minutes default

class UnitTestManager:
    def __init__(self, base_url: str, api_key: str = None):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session_id = None
        self.tests: List[TestDefinition] = []

    def create_session(self, total_tests: int = None) -> str:
        """Create a new test session"""
        self.session_id = str(uuid.uuid4())

        payload = {
            "session_id": self.session_id,
            "total_tests": total_tests or len(self.tests)
        }

        response = requests.post(
            f"{self.base_url}/unit-tests/sessions",
            json=payload,
            headers=self._get_headers()
        )
        response.raise_for_status()

        return self.session_id

    def add_test(self, test: TestDefinition):
        """Add a test to the session"""
        self.tests.append(test)

    def register_tests(self):
        """Register all tests with the session"""
        if not self.session_id:
            raise ValueError("Session not created. Call create_session() first.")

        for test in self.tests:
            self._create_test_record(test)

    def run_tests(self) -> Dict[str, Any]:
        """Run all registered tests"""
        if not self.session_id:
            raise ValueError("Session not created. Call create_session() first.")

        results = {
            "total": len(self.tests),
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "errors": 0
        }

        for test in self.tests:
            try:
                # Mark test as running
                self._update_test_status(test.name, TestStatus.RUNNING)

                # Run the test
                start_time = time.time()
                test_result = self._run_single_test(test)
                duration = int((time.time() - start_time) * 1000)

                # Update test result
                self._update_test_result(
                    test.name,
                    test_result["status"],
                    test_result.get("data"),
                    test_result.get("error"),
                    duration
                )

                # Update counters
                if test_result["status"] == TestStatus.PASSED:
                    results["passed"] += 1
                elif test_result["status"] == TestStatus.FAILED:
                    results["failed"] += 1
                elif test_result["status"] == TestStatus.SKIPPED:
                    results["skipped"] += 1
                else:
                    results["errors"] += 1

            except Exception as e:
                # Mark test as error
                self._update_test_result(
                    test.name,
                    TestStatus.ERROR,
                    error=str(e),
                    duration=int((time.time() - start_time) * 1000)
                )
                results["errors"] += 1

        # Complete the session
        self._complete_session(results)
        return results

    def _run_single_test(self, test: TestDefinition) -> Dict[str, Any]:
        """Run a single test with timeout"""
        try:
            # Implement timeout logic here
            result = test.function()
            return {
                "status": TestStatus.PASSED,
                "data": result
            }
        except AssertionError as e:
            return {
                "status": TestStatus.FAILED,
                "error": str(e)
            }
        except Exception as e:
            return {
                "status": TestStatus.ERROR,
                "error": str(e)
            }

    def _create_test_record(self, test: TestDefinition):
        """Create a test record in the database"""
        payload = {
            "test_name": test.name,
            "test_category": test.category
        }

        response = requests.post(
            f"{self.base_url}/unit-tests/sessions/{self.session_id}/tests",
            json=payload,
            headers=self._get_headers()
        )
        response.raise_for_status()

    def _update_test_status(self, test_name: str, status: TestStatus):
        """Update test status"""
        self._update_test_result(test_name, status)

    def _update_test_result(self, test_name: str, status: TestStatus,
                           data: Any = None, error: str = None, duration: int = None):
        """Update test result"""
        payload = {
            "test_name": test_name,
            "status": status.value
        }

        if data is not None:
            payload["test_results"] = data
        if error is not None:
            payload["error_message"] = error
        if duration is not None:
            payload["duration_ms"] = duration

        response = requests.post(
            f"{self.base_url}/unit-tests/sessions/{self.session_id}/update-test",
            json=payload,
            headers=self._get_headers()
        )
        response.raise_for_status()

    def _complete_session(self, results: Dict[str, Any]):
        """Mark session as completed"""
        status = SessionStatus.COMPLETED
        if results["failed"] > 0 or results["errors"] > 0:
            status = SessionStatus.FAILED

        payload = {
            "status": status.value,
            "completed_tests": results["passed"] + results["failed"] + results["skipped"],
            "failed_tests": results["failed"] + results["errors"]
        }

        response = requests.post(
            f"{self.base_url}/unit-tests/sessions/{self.session_id}/complete",
            json=payload,
            headers=self._get_headers()
        )
        response.raise_for_status()

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers"""
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["x-api-key"] = self.api_key
        return headers

# Example Usage
def test_camera_endpoint():
    """Example test function"""
    response = requests.get("https://unifi-cameras.hacolby.app/protect/cameras")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    return {"status_code": response.status_code, "items_count": len(data.get("items", []))}

def test_health_endpoint():
    """Example test function"""
    response = requests.get("https://unifi-cameras.hacolby.app/health")
    assert response.status_code == 200
    return {"status_code": response.status_code}

if __name__ == "__main__":
    # Initialize test manager
    manager = UnitTestManager("https://unifi-protect-api.hacolby.workers.dev")

    # Create session
    session_id = manager.create_session()
    print(f"Created session: {session_id}")

    # Add tests
    manager.add_test(TestDefinition("test_camera_endpoint", "integration", test_camera_endpoint))
    manager.add_test(TestDefinition("test_health_endpoint", "integration", test_health_endpoint))

    # Register tests
    manager.register_tests()
    print("Registered all tests")

    # Run tests
    results = manager.run_tests()
    print(f"Test results: {results}")
```

## Key Features to Implement

1. **Concurrent Test Execution**: Run multiple tests in parallel where possible
2. **Timeout Management**: Implement proper timeout handling for long-running tests
3. **Retry Logic**: Retry failed API calls with exponential backoff
4. **Progress Reporting**: Provide real-time progress updates
5. **Result Aggregation**: Collect and summarize test results
6. **Error Recovery**: Handle partial failures gracefully
7. **Logging**: Comprehensive logging for debugging and monitoring

## Database Schema

The system uses two main tables:

### unit_test_sessions

- `id`: Auto-incrementing primary key
- `session_id`: Unique UUID identifier
- `timestamp_start`: Session start time
- `timestamp_completed`: Session completion time
- `status`: running, completed, failed, cancelled
- `total_tests`: Expected number of tests
- `completed_tests`: Number of completed tests
- `failed_tests`: Number of failed tests

### unit_test_results

- `id`: Auto-incrementing primary key
- `session_id`: Foreign key to sessions table
- `test_name`: Name of the test
- `test_category`: Type of test (unit, integration, e2e)
- `timestamp_start`: Test start time
- `timestamp_completed`: Test completion time
- `status`: pending, running, passed, failed, skipped, error
- `test_results`: JSON string with detailed results
- `error_message`: Error details if test failed
- `duration_ms`: Test execution time in milliseconds

## Monitoring and Alerting

Implement monitoring for:

- Test execution timeouts
- API connectivity issues
- High failure rates
- Session completion status
- Database connectivity

This system provides a robust foundation for managing long-running unit tests with full traceability and monitoring capabilities.
