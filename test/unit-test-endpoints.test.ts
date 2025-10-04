import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockEnv, createMockRequest } from './utils/test-helpers.js';

// Mock the UnitTestService
vi.mock('../src/services/unit-test-service.js', () => ({
	UnitTestService: vi.fn().mockImplementation(() => ({
		createSession: vi.fn().mockResolvedValue({
			session_id: 'test-session-123',
			timestamp_start: '2025-01-01T00:00:00Z',
			status: 'running',
			total_tests: 5,
			completed_tests: 0,
			failed_tests: 0,
		}),
		getSession: vi.fn().mockResolvedValue({
			session_id: 'test-session-123',
			timestamp_start: '2025-01-01T00:00:00Z',
			status: 'running',
			total_tests: 5,
			completed_tests: 0,
			failed_tests: 0,
		}),
		createTest: vi.fn().mockResolvedValue({
			session_id: 'test-session-123',
			test_name: 'test_camera_endpoint',
			test_category: 'unit',
			status: 'pending',
		}),
		updateTestResult: vi.fn().mockResolvedValue({
			session_id: 'test-session-123',
			test_name: 'test_camera_endpoint',
			status: 'passed',
			test_results: '{"assertions": 5}',
			duration_ms: 1250,
		}),
		updateSession: vi.fn().mockResolvedValue({
			session_id: 'test-session-123',
			status: 'completed',
			completed_tests: 5,
			failed_tests: 0,
		}),
		getTestResults: vi.fn().mockResolvedValue([
			{
				session_id: 'test-session-123',
				test_name: 'test_camera_endpoint',
				status: 'passed',
				duration_ms: 1250,
			},
		]),
		getSessionStats: vi.fn().mockResolvedValue({
			total: 5,
			completed: 5,
			failed: 0,
			running: 0,
			pending: 0,
		}),
		listSessions: vi.fn().mockResolvedValue([
			{
				session_id: 'test-session-123',
				status: 'completed',
				total_tests: 5,
			},
		]),
	})),
}));

describe('Unit Test Endpoints', () => {
	let env: any;

	beforeEach(() => {
		env = createMockEnv();
	});

	describe('POST /unit-tests/sessions', () => {
		it('should create a new test session', async () => {
			const request = createMockRequest('https://test-worker.example.com/unit-tests/sessions', {
				method: 'POST',
				body: JSON.stringify({
					session_id: 'test-session-123',
					total_tests: 5,
				}),
			});

			// Import the handler dynamically to avoid module loading issues
			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { success: boolean; session_id: string };

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.session_id).toBe('test-session-123');
		});

		it('should return 400 if session_id is missing', async () => {
			const request = createMockRequest('https://test-worker.example.com/unit-tests/sessions', {
				method: 'POST',
				body: JSON.stringify({
					total_tests: 5,
				}),
			});

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { error: string };

			expect(response.status).toBe(400);
			expect(data.error).toBe('session_id is required');
		});
	});

	describe('GET /unit-tests/sessions', () => {
		it('should list test sessions', async () => {
			const request = createMockRequest('https://test-worker.example.com/unit-tests/sessions');

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { success: boolean; sessions: any[]; pagination: any };

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(Array.isArray(data.sessions)).toBe(true);
			expect(data.pagination).toBeDefined();
		});
	});

	describe('POST /unit-tests/sessions/{session_id}/tests', () => {
		it('should create a test record', async () => {
			const request = createMockRequest('https://test-worker.example.com/unit-tests/sessions/test-session-123/tests', {
				method: 'POST',
				body: JSON.stringify({
					test_name: 'test_camera_endpoint',
					test_category: 'unit',
				}),
			});

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { success: boolean; test_name: string };

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.test_name).toBe('test_camera_endpoint');
		});

		it('should return 400 if test_name is missing', async () => {
			const request = createMockRequest('https://test-worker.example.com/unit-tests/sessions/test-session-123/tests', {
				method: 'POST',
				body: JSON.stringify({
					test_category: 'unit',
				}),
			});

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { error: string };

			expect(response.status).toBe(400);
			expect(data.error).toBe('test_name is required');
		});
	});

	describe('POST /unit-tests/sessions/{session_id}/update-test', () => {
		it('should update test result', async () => {
			const request = createMockRequest('https://test-worker.example.com/unit-tests/sessions/test-session-123/update-test', {
				method: 'POST',
				body: JSON.stringify({
					test_name: 'test_camera_endpoint',
					status: 'passed',
					test_results: { assertions: 5 },
					duration_ms: 1250,
				}),
			});

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { success: boolean; test_name: string; status: string };

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.test_name).toBe('test_camera_endpoint');
			expect(data.status).toBe('passed');
		});

		it('should return 400 if required fields are missing', async () => {
			const request = createMockRequest('https://test-worker.example.com/unit-tests/sessions/test-session-123/update-test', {
				method: 'POST',
				body: JSON.stringify({
					test_name: 'test_camera_endpoint',
				}),
			});

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { error: string };

			expect(response.status).toBe(400);
			expect(data.error).toBe('test_name and status are required');
		});
	});

	describe('POST /unit-tests/sessions/{session_id}/complete', () => {
		it('should complete a test session', async () => {
			const request = createMockRequest('https://test-worker.example.com/unit-tests/sessions/test-session-123/complete', {
				method: 'POST',
				body: JSON.stringify({
					status: 'completed',
					completed_tests: 5,
					failed_tests: 0,
				}),
			});

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { success: boolean; session_id: string; status: string };

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.session_id).toBe('test-session-123');
			expect(data.status).toBe('completed');
		});

		it('should return 400 if status is missing', async () => {
			const request = createMockRequest('https://test-worker.example.com/unit-tests/sessions/test-session-123/complete', {
				method: 'POST',
				body: JSON.stringify({
					completed_tests: 5,
				}),
			});

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { error: string };

			expect(response.status).toBe(400);
			expect(data.error).toBe('status is required');
		});
	});

	describe('GET /unit-tests/sessions/{session_id}', () => {
		it('should get session details', async () => {
			const request = createMockRequest('https://test-worker.example.com/unit-tests/sessions/test-session-123');

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { success: boolean; session: any; tests: any[]; stats: any };

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.session).toBeDefined();
			expect(data.tests).toBeDefined();
			expect(data.stats).toBeDefined();
		});
	});
});
