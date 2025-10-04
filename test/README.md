# UniFi Protect API Test Suite

This test suite provides comprehensive testing for the UniFi Protect API Cloudflare Worker, supporting both local development and deployed environments.

## Test Configuration

The test suite can run against two environments:

- **Local Development**: `http://localhost:8787` (requires `pnpm dev` to be running)
- **Deployed Production**: `https://unifi-protect-api.hacolby.workers.dev` (default)

## Environment Variables

- `TEST_ENV`: Set to `local` to test against local development server, otherwise tests against deployed worker
- `WORKER_API_KEY`: API key for authentication (defaults to `6502241638`)

## Available Test Commands

### All Tests

```bash
# Test against deployed worker (default)
pnpm test:deployed

# Test against local worker
pnpm test:local

# Test with environment variable
TEST_ENV=local pnpm test:run
```

### Specific Test Suites

```bash
# Webhook tests only
pnpm test:webhook:deployed
pnpm test:webhook:local

# API endpoint tests only
pnpm test:api:deployed
pnpm test:api:local
```

### Interactive Testing

```bash
# Watch mode for development
pnpm test:watch

# UI mode for visual testing
pnpm test:ui

# Coverage report
pnpm test:coverage
```

## Test Suites

### 1. Webhook Tests (`test/webhook.test.ts`)

Tests the webhook functionality including:

- **Webhook Endpoint**: POST `/webhook` requests
- **Event Storage**: Verification that webhooks are saved to D1 database
- **Thumbnail Processing**: R2 storage of base64 encoded images
- **Event Retrieval**: GET `/webhook/events` endpoint
- **Authentication**: API key requirements
- **Data Validation**: Proper event structure and ordering

### 2. API Tests (`test/api.test.ts`)

Tests the core API functionality including:

- **Health Check**: `/agent/security_sweep` endpoint
- **UniFi Protect Integration**: Camera listing and stream access
- **Authentication**: API key validation across endpoints
- **Static Assets**: Favicon, HTML, and OpenAPI spec serving
- **Error Handling**: 404s, malformed requests, etc.

## Test Data

The tests use realistic test data:

- **Camera ID**: `65715e7900ce3103e414eb82` (Garage camera from your setup)
- **Event Types**: `motion`, `doorbell`, `person`
- **Thumbnails**: Base64 encoded 1x1 pixel PNG for testing
- **Timestamps**: Current ISO timestamps

## Running Tests

### Prerequisites

1. **For Local Testing**:

   ```bash
   # Start the development server
   pnpm dev
   ```

2. **For Deployed Testing**:
   - Ensure the worker is deployed and accessible
   - Verify API key is correct

### Quick Start

```bash
# Test against deployed worker (recommended)
pnpm test:deployed

# Test against local worker
pnpm test:local
```

### Debugging

To see detailed test output and debug information:

```bash
# Verbose output
TEST_ENV=local pnpm test:run --reporter=verbose

# Watch mode for development
pnpm test:watch
```

## Test Structure

```
test/
├── webhook.test.ts      # Webhook functionality tests
├── api.test.ts          # API endpoint tests
├── test-config.ts       # Test configuration and utilities
├── run-tests.ts         # Test runner script
└── README.md           # This documentation
```

## Continuous Integration

The test suite is designed to work in CI/CD environments:

```bash
# In CI, test against deployed worker
TEST_ENV=deployed pnpm test:run
```

## Troubleshooting

### Common Issues

1. **Worker Not Accessible**: Ensure the worker is running (local) or deployed (remote)
2. **Authentication Errors**: Verify `WORKER_API_KEY` is correct
3. **Database Errors**: Ensure migrations are applied (`pnpm migrate:local` or `pnpm migrate:remote`)
4. **Timeout Issues**: Some tests may take time due to async processing

### Debug Commands

```bash
# Check worker health
curl -H "x-api-key: 6502241638" https://unifi-protect-api.hacolby.workers.dev/agent/security_sweep

# Check webhook events
curl -H "x-api-key: 6502241638" https://unifi-protect-api.hacolby.workers.dev/webhook/events

# Test webhook manually
curl -X POST https://unifi-protect-api.hacolby.workers.dev/webhook \
  -H "Content-Type: application/json" \
  -d '{"eventId": "test", "cameraId": "65715e7900ce3103e414eb82", "eventType": "motion", "timestamp": "2025-01-02T23:00:00Z", "rawPayload": {"test": "data"}}'
```

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Use the `getTestConfig()` utility for environment configuration
3. Include both positive and negative test cases
4. Add appropriate error handling and cleanup
5. Update this README if adding new test categories
