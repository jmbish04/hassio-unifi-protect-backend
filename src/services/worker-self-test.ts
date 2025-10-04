import type { Env } from '../types.js';
import { UnitTestService } from './unit-test-service.js';

export interface TestResult {
	test_name: string;
	status: 'passed' | 'failed' | 'error';
	duration_ms: number;
	error_message?: string;
	test_results?: any;
}

export interface SelfTestConfig {
	base_url: string;
	api_key?: string;
	timeout_ms?: number;
}

export class WorkerSelfTestService {
	public unitTestService: UnitTestService;
	private config: SelfTestConfig;

	constructor(env: Env, config: SelfTestConfig) {
		this.unitTestService = new UnitTestService(env);
		this.config = {
			timeout_ms: 30000, // 30 seconds default
			...config,
		};
	}

	/**
	 * Run comprehensive self-tests for all worker endpoints
	 */
	async runSelfTests(): Promise<{ session_id: string; results: TestResult[] }> {
		const session_id = `worker-self-test-${Date.now()}`;

		// Create test session
		await this.unitTestService.createSession({
			session_id,
			total_tests: this.getTestDefinitions().length,
		});

		// Register all tests
		for (const test of this.getTestDefinitions()) {
			await this.unitTestService.createTest({
				session_id,
				test_name: test.name,
				test_category: test.category,
			});
		}

		// Run all tests
		const results: TestResult[] = [];
		for (const test of this.getTestDefinitions()) {
			const result = await this.runSingleTest(session_id, test);
			results.push(result);
		}

		// Complete the session
		const failedCount = results.filter((r) => r.status === 'failed' || r.status === 'error').length;
		await this.unitTestService.updateSession({
			session_id,
			status: failedCount > 0 ? 'failed' : 'completed',
			completed_tests: results.length,
			failed_tests: failedCount,
		});

		return { session_id, results };
	}

	/**
	 * Get all test definitions for worker endpoints
	 */
	private getTestDefinitions() {
		return [
			// Health and Status endpoints
			{ name: 'test_health_endpoint', category: 'health', method: 'GET', path: '/agent/security_sweep' },
			{ name: 'test_root_endpoint', category: 'health', method: 'GET', path: '/' },

			// UniFi Protect API endpoints
			{ name: 'test_protect_login', category: 'protect', method: 'POST', path: '/protect/login' },
			{ name: 'test_protect_cameras', category: 'protect', method: 'GET', path: '/protect/cameras' },
			{ name: 'test_protect_bootstrap', category: 'protect', method: 'GET', path: '/protect/bootstrap' },

			// Webhook endpoints
			{ name: 'test_webhook_events_get', category: 'webhook', method: 'GET', path: '/webhook/events' },
			{ name: 'test_webhook_events_post', category: 'webhook', method: 'POST', path: '/webhook/events' },

			// Unit Test Management endpoints
			{ name: 'test_unit_test_sessions_post', category: 'unit-tests', method: 'POST', path: '/unit-tests/sessions' },
			{ name: 'test_unit_test_sessions_get', category: 'unit-tests', method: 'GET', path: '/unit-tests/sessions' },

			// Storage endpoints
			{ name: 'test_storage_upload', category: 'storage', method: 'POST', path: '/storage/upload' },
			{ name: 'test_storage_download', category: 'storage', method: 'GET', path: '/storage/download' },

			// UI endpoints
			{ name: 'test_ui_agent_instructions', category: 'ui', method: 'GET', path: '/ui/agent-instructions' },
			{ name: 'test_ui_root', category: 'ui', method: 'GET', path: '/ui/' },

			// OpenAPI endpoint
			{ name: 'test_openapi_spec', category: 'api', method: 'GET', path: '/openapi.json' },
		];
	}

	/**
	 * Run a single test
	 */
	private async runSingleTest(session_id: string, test: any): Promise<TestResult> {
		const start_time = Date.now();

		try {
			// Mark test as running
			await this.unitTestService.updateTestResult({
				session_id,
				test_name: test.name,
				status: 'running',
			});

			// Execute the test
			const result = await this.executeTest(test);
			const duration = Date.now() - start_time;

			// Update test result
			await this.unitTestService.updateTestResult({
				session_id,
				test_name: test.name,
				status: result.status,
				test_results: result.data,
				error_message: result.error,
				duration_ms: duration,
			});

			return {
				test_name: test.name,
				status: result.status,
				duration_ms: duration,
				error_message: result.error,
				test_results: result.data,
			};
		} catch (error) {
			const duration = Date.now() - start_time;
			const errorMessage = error instanceof Error ? error.message : String(error);

			// Update test result with error
			await this.unitTestService.updateTestResult({
				session_id,
				test_name: test.name,
				status: 'error',
				error_message: errorMessage,
				duration_ms: duration,
			});

			return {
				test_name: test.name,
				status: 'error',
				duration_ms: duration,
				error_message: errorMessage,
			};
		}
	}

	/**
	 * Execute a specific test
	 */
	private async executeTest(test: any): Promise<{ status: 'passed' | 'failed' | 'error'; data?: any; error?: string }> {
		try {
			const url = `${this.config.base_url}${test.path}`;
			const options: RequestInit = {
				method: test.method,
				headers: {
					'Content-Type': 'application/json',
					...(this.config.api_key && { 'x-api-key': this.config.api_key }),
				},
			};

			// Add body for POST requests
			if (test.method === 'POST') {
				options.body = JSON.stringify(this.getTestPayload(test.name));
			}

			const response = await fetch(url, options);

			// Validate response based on test type
			const validation = this.validateResponse(test.name, response);

			if (validation.valid) {
				return {
					status: 'passed',
					data: {
						status_code: response.status,
						response_time_ms: 0, // Would need to measure this
						...validation.data,
					},
				};
			} else {
				return {
					status: 'failed',
					error: validation.error,
				};
			}
		} catch (error) {
			return {
				status: 'error',
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Get test payload for POST requests
	 */
	private getTestPayload(testName: string): any {
		switch (testName) {
			case 'test_protect_login':
				return { username: 'test', password: 'test' };
			case 'test_unit_test_sessions_post':
				return {
					session_id: `test-session-${Date.now()}`,
					total_tests: 1,
				};
			case 'test_webhook_events_post':
				return {
					type: 'test_event',
					data: { test: true },
				};
			default:
				return {};
		}
	}

	/**
	 * Validate response based on test expectations
	 */
	private validateResponse(testName: string, response: Response): { valid: boolean; error?: string; data?: any } {
		switch (testName) {
			case 'test_health_endpoint':
				return {
					valid: response.status === 200,
					error: response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
					data: { endpoint: 'health' },
				};

			case 'test_root_endpoint':
				return {
					valid: response.status === 200,
					error: response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
					data: { endpoint: 'root' },
				};

			case 'test_protect_login':
				return {
					valid: [200, 401, 429].includes(response.status), // Login might fail but should respond
					error: ![200, 401, 429].includes(response.status) ? `Unexpected status ${response.status}` : undefined,
					data: { endpoint: 'protect_login' },
				};

			case 'test_protect_cameras':
				return {
					valid: response.status === 200,
					error: response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
					data: { endpoint: 'protect_cameras' },
				};

			case 'test_protect_bootstrap':
				return {
					valid: [200, 401].includes(response.status), // Bootstrap might require auth
					error: ![200, 401].includes(response.status) ? `Unexpected status ${response.status}` : undefined,
					data: { endpoint: 'protect_bootstrap' },
				};

			case 'test_webhook_events_get':
				return {
					valid: response.status === 200,
					error: response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
					data: { endpoint: 'webhook_events_get' },
				};

			case 'test_webhook_events_post':
				return {
					valid: [200, 400].includes(response.status), // POST might fail validation
					error: ![200, 400].includes(response.status) ? `Unexpected status ${response.status}` : undefined,
					data: { endpoint: 'webhook_events_post' },
				};

			case 'test_unit_test_sessions_post':
				return {
					valid: response.status === 200,
					error: response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
					data: { endpoint: 'unit_test_sessions_post' },
				};

			case 'test_unit_test_sessions_get':
				return {
					valid: response.status === 200,
					error: response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
					data: { endpoint: 'unit_test_sessions_get' },
				};

			case 'test_storage_upload':
				return {
					valid: [200, 400, 405].includes(response.status), // Upload might not be implemented
					error: ![200, 400, 405].includes(response.status) ? `Unexpected status ${response.status}` : undefined,
					data: { endpoint: 'storage_upload' },
				};

			case 'test_storage_download':
				return {
					valid: [200, 404, 405].includes(response.status), // Download might not be implemented
					error: ![200, 404, 405].includes(response.status) ? `Unexpected status ${response.status}` : undefined,
					data: { endpoint: 'storage_download' },
				};

			case 'test_ui_agent_instructions':
				return {
					valid: [200, 401].includes(response.status), // UI might require auth
					error: ![200, 401].includes(response.status) ? `Unexpected status ${response.status}` : undefined,
					data: { endpoint: 'ui_agent_instructions' },
				};

			case 'test_ui_root':
				return {
					valid: [200, 401].includes(response.status), // UI might require auth
					error: ![200, 401].includes(response.status) ? `Unexpected status ${response.status}` : undefined,
					data: { endpoint: 'ui_root' },
				};

			case 'test_openapi_spec':
				return {
					valid: response.status === 200,
					error: response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
					data: { endpoint: 'openapi_spec' },
				};

			default:
				return {
					valid: response.status < 500, // Any non-server error is acceptable
					error: response.status >= 500 ? `Server error ${response.status}` : undefined,
					data: { endpoint: 'unknown' },
				};
		}
	}

	/**
	 * Get test session statistics
	 */
	async getTestSessionStats(session_id: string) {
		return await this.unitTestService.getSessionStats(session_id);
	}

	/**
	 * Get test results for a session
	 */
	async getTestResults(session_id: string) {
		return await this.unitTestService.getTestResults(session_id);
	}
}
