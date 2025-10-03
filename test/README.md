# Testing Guide

This directory contains comprehensive unit tests for the UniFi Protect API Cloudflare Worker.

## Test Structure

```
test/
├── setup.ts                 # Test environment setup and mocks
├── utils/
│   ├── test-helpers.ts      # Test utilities and mock data
│   └── response.test.ts     # Tests for utility functions
├── services/
│   ├── protect-api.test.ts  # Tests for ProtectApiService
│   └── security-sweep.test.ts # Tests for SecuritySweepService
├── index.test.ts            # Tests for main Worker endpoints
└── README.md               # This file
```

## Running Tests

### Available Scripts

- `npm test` - Run tests in watch mode
- `npm run test:run` - Run tests once and exit
- `npm run test:watch` - Run tests in watch mode (same as `npm test`)
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:ui` - Run tests with UI interface

### Examples

```bash
# Run all tests
npm run test:run

# Run tests in watch mode
npm test

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui

# Run specific test file
npm run test:run test/services/protect-api.test.ts
```

## Test Configuration

Tests are configured using Vitest with the Cloudflare Workers pool. The configuration includes:

- **Environment**: Miniflare (Cloudflare Workers runtime)
- **Coverage**: V8 provider with HTML, JSON, and text reports
- **Setup**: Automatic mocking of Cloudflare Workers APIs
- **Timeout**: 10 seconds for tests and hooks

## Writing Tests

### Test Utilities

Use the utilities in `test/utils/test-helpers.ts`:

```typescript
import { createMockEnv, createMockRequest, mockCameraData } from '../utils/test-helpers.js';

// Create mock environment
const mockEnv = createMockEnv({
  PROTECT_API_KEY: 'custom-key'
});

// Create mock request
const request = createMockRequest('https://test.com/api', {
  method: 'POST',
  body: JSON.stringify({ data: 'test' })
});

// Use mock data
const cameras = [mockCameraData];
```

### Mocking Services

Services are automatically mocked in test files. To customize mocks:

```typescript
import { vi } from 'vitest';

// Mock a service method
vi.mocked(SomeService.prototype.someMethod).mockResolvedValue(mockData);

// Mock a service constructor
vi.mocked(SomeService).mockImplementation(() => ({
  someMethod: vi.fn().mockResolvedValue(mockData)
}));
```

### Testing Worker Endpoints

```typescript
describe('API Endpoints', () => {
  it('should handle GET request', async () => {
    const request = createMockRequest('https://test.com/api/endpoint');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expectedData);
  });
});
```

### Testing Services

```typescript
describe('ProtectApiService', () => {
  let service: ProtectApiService;

  beforeEach(() => {
    service = new ProtectApiService(mockEnv);
  });

  it('should login successfully', async () => {
    const result = await service.login();
    expect(result.status).toBe('success');
  });
});
```

## Coverage

Coverage reports are generated in multiple formats:

- **Text**: Console output
- **JSON**: `coverage/coverage-final.json`
- **HTML**: `coverage/index.html` (open in browser)

Coverage excludes:
- Node modules
- Test files
- Type definitions
- Configuration files
- Migrations
- Public assets

## Best Practices

1. **Use descriptive test names** that explain what is being tested
2. **Mock external dependencies** to ensure tests are isolated
3. **Test both success and error cases**
4. **Use beforeEach/afterEach** for setup and cleanup
5. **Group related tests** using describe blocks
6. **Use meaningful assertions** with specific expectations
7. **Keep tests simple and focused** on single functionality

## Debugging Tests

### Running Individual Tests

```bash
# Run specific test file
npm run test:run test/services/protect-api.test.ts

# Run specific test by name
npm run test:run -- --grep "should login successfully"
```

### Debug Mode

```bash
# Run tests with debug output
DEBUG=* npm run test:run
```

### Test UI

The test UI provides a visual interface for running and debugging tests:

```bash
npm run test:ui
```

This opens a web interface where you can:
- See all tests and their status
- Run individual tests
- View test output and errors
- Debug failing tests

## Continuous Integration

Tests are designed to run in CI environments. The `test:run` script is recommended for CI as it:

- Runs tests once and exits
- Provides clear pass/fail status
- Generates coverage reports
- Works in headless environments
