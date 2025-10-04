import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockEnv, createMockRequest } from './utils/test-helpers.js';

// Mock the WorkerSelfTestService
vi.mock('../src/services/worker-self-test.js', () => ({
	WorkerSelfTestService: vi.fn().mockImplementation(() => ({
		runSelfTests: vi.fn().mockResolvedValue({
			session_id: 'worker-self-test-1234567890',
			results: [
				{
					test_name: 'test_health_endpoint',
					status: 'passed',
					duration_ms: 150,
					test_results: { status_code: 200, endpoint: 'health' },
				},
				{
					test_name: 'test_protect_cameras',
					status: 'passed',
					duration_ms: 200,
					test_results: { status_code: 200, endpoint: 'protect_cameras' },
				},
				{
					test_name: 'test_invalid_endpoint',
					status: 'failed',
					duration_ms: 100,
					error_message: 'Expected 200, got 404',
				},
			],
		}),
		getTestResults: vi.fn().mockResolvedValue([
			{
				session_id: 'worker-self-test-1234567890',
				test_name: 'test_health_endpoint',
				status: 'passed',
				duration_ms: 150,
			},
		]),
		getTestSessionStats: vi.fn().mockResolvedValue({
			total: 3,
			completed: 3,
			failed: 1,
			running: 0,
			pending: 0,
		}),
		unitTestService: {
			getSession: vi.fn().mockResolvedValue({
				session_id: 'worker-self-test-1234567890',
				status: 'completed',
				total_tests: 3,
				completed_tests: 3,
				failed_tests: 1,
			}),
		},
	})),
}));

describe('Worker Self-Test Endpoints', () => {
	let env: any;

	beforeEach(() => {
		env = createMockEnv();
	});

	describe('POST /worker/self-test', () => {
		it('should run worker self-tests successfully', async () => {
			const request = createMockRequest('https://test-worker.example.com/worker/self-test', {
				method: 'POST',
				body: JSON.stringify({
					base_url: 'https://test-worker.example.com',
					timeout_ms: 30000,
				}),
			});

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as {
				success: boolean;
				session_id: string;
				message: string;
				summary: {
					total_tests: number;
					passed: number;
					failed: number;
					errors: number;
				};
				results: any[];
			};

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.session_id).toBe('worker-self-test-1234567890');
			expect(data.message).toBe('Worker self-tests completed');
			expect(data.summary).toEqual({
				total_tests: 3,
				passed: 2,
				failed: 1,
				errors: 0,
			});
			expect(Array.isArray(data.results)).toBe(true);
			expect(data.results).toHaveLength(3);
		});

		it('should run self-tests with default configuration', async () => {
			const request = createMockRequest('https://test-worker.example.com/worker/self-test', {
				method: 'POST',
				body: JSON.stringify({}),
			});

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { success: boolean; session_id: string };

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.session_id).toBeDefined();
		});

		it('should handle self-test errors gracefully', async () => {
			// Mock the service to throw an error
			const { WorkerSelfTestService } = await import('../src/services/worker-self-test.js');
			(WorkerSelfTestService as any).mockImplementation(() => ({
				runSelfTests: vi.fn().mockRejectedValue(new Error('Self-test execution failed')),
			}));

			const request = createMockRequest('https://test-worker.example.com/worker/self-test', {
				method: 'POST',
				body: JSON.stringify({}),
			});

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { error: string; details: string };

			expect(response.status).toBe(500);
			expect(data.error).toBe('Failed to run worker self-tests');
			expect(data.details).toBe('Self-test execution failed');
		});
	});

	describe('GET /worker/self-test/status', () => {
		it('should get self-test status successfully', async () => {
			const request = createMockRequest('https://test-worker.example.com/worker/self-test/status?session_id=worker-self-test-1234567890');

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as {
				success: boolean;
				session: { session_id: string };
				tests: any[];
				stats: { total: number };
			};

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.session).toBeDefined();
			expect(data.session.session_id).toBe('worker-self-test-1234567890');
			expect(Array.isArray(data.tests)).toBe(true);
			expect(data.stats).toBeDefined();
			expect(data.stats.total).toBe(3);
		});

		it('should return 400 if session_id is missing', async () => {
			const request = createMockRequest('https://test-worker.example.com/worker/self-test/status');

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { error: string };

			expect(response.status).toBe(400);
			expect(data.error).toBe('session_id parameter is required');
		});

		it('should return 404 if session not found', async () => {
			// Mock the service to return null for session
			const { WorkerSelfTestService } = await import('../src/services/worker-self-test.js');
			(WorkerSelfTestService as any).mockImplementation(() => ({
				unitTestService: {
					getSession: vi.fn().mockResolvedValue(null),
				},
			}));

			const request = createMockRequest('https://test-worker.example.com/worker/self-test/status?session_id=nonexistent');

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { error: string };

			expect(response.status).toBe(404);
			expect(data.error).toBe('Session not found');
		});

		it('should handle status check errors gracefully', async () => {
			// Mock the service to throw an error
			const { WorkerSelfTestService } = await import('../src/services/worker-self-test.js');
			(WorkerSelfTestService as any).mockImplementation(() => ({
				unitTestService: {
					getSession: vi.fn().mockRejectedValue(new Error('Database error')),
				},
			}));

			const request = createMockRequest('https://test-worker.example.com/worker/self-test/status?session_id=test-session');

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { error: string; details: string };

			expect(response.status).toBe(500);
			expect(data.error).toBe('Failed to get self-test status');
			expect(data.details).toBe('Database error');
		});
	});

	describe('GET /unit-test-agent-prompt', () => {
		it('should serve the unit test agent prompt file', async () => {
			// Mock the ASSETS.fetch to return the prompt file
			const mockPromptContent = '# Unit Test Management System\n\nThis is a test prompt file.';
			const mockResponse = new Response(mockPromptContent, { status: 200 });

			// Mock env.ASSETS.fetch
			env.ASSETS = {
				fetch: vi.fn().mockResolvedValue(mockResponse),
			};

			const request = createMockRequest('https://test-worker.example.com/unit-test-agent-prompt');

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const content = await response.text();

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
			expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(content).toBe(mockPromptContent);
		});

		it('should return 404 if prompt file not found', async () => {
			// Mock the ASSETS.fetch to return 404
			const mockResponse = new Response('Not found', { status: 404 });
			env.ASSETS = {
				fetch: vi.fn().mockResolvedValue(mockResponse),
			};

			const request = createMockRequest('https://test-worker.example.com/unit-test-agent-prompt');

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { error: string };

			expect(response.status).toBe(404);
			expect(data.error).toBe('Unit test agent prompt file not found');
		});

		it('should handle errors gracefully', async () => {
			// Mock the ASSETS.fetch to throw an error
			env.ASSETS = {
				fetch: vi.fn().mockRejectedValue(new Error('Asset fetch failed')),
			};

			const request = createMockRequest('https://test-worker.example.com/unit-test-agent-prompt');

			const { default: handler } = await import('../src/index.js');
			const response = await handler.fetch(request, env, {} as ExecutionContext);
			const data = (await response.json()) as { error: string; details: string };

			expect(response.status).toBe(500);
			expect(data.error).toBe('Failed to serve unit test agent prompt');
			expect(data.details).toBe('Asset fetch failed');
		});
	});
});
