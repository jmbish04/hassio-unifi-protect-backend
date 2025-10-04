import type { Env } from '../types.js';

export interface UnitTestSession {
	id?: number;
	session_id: string;
	timestamp_start: string;
	timestamp_completed?: string;
	status: 'running' | 'completed' | 'failed' | 'cancelled';
	total_tests?: number;
	completed_tests?: number;
	failed_tests?: number;
	created_at?: string;
	updated_at?: string;
}

export interface UnitTestResult {
	id?: number;
	session_id: string;
	test_name: string;
	test_category?: string;
	timestamp_start?: string;
	timestamp_completed?: string;
	status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'error';
	test_results?: string; // JSON string
	error_message?: string;
	duration_ms?: number;
	created_at?: string;
	updated_at?: string;
}

export interface CreateSessionRequest {
	session_id: string;
	total_tests?: number;
}

export interface CreateTestRequest {
	session_id: string;
	test_name: string;
	test_category?: string;
}

export interface UpdateTestResultRequest {
	session_id: string;
	test_name: string;
	status: 'running' | 'passed' | 'failed' | 'skipped' | 'error';
	test_results?: any; // Will be JSON stringified
	error_message?: string;
	duration_ms?: number;
}

export interface UpdateSessionRequest {
	session_id: string;
	status: 'completed' | 'failed' | 'cancelled';
	completed_tests?: number;
	failed_tests?: number;
}

export class UnitTestService {
	constructor(private env: Env) {}

	/**
	 * Create a new unit test session
	 */
	async createSession(request: CreateSessionRequest): Promise<UnitTestSession> {
		const session: UnitTestSession = {
			session_id: request.session_id,
			timestamp_start: new Date().toISOString(),
			status: 'running',
			total_tests: request.total_tests || 0,
			completed_tests: 0,
			failed_tests: 0,
		};

		const stmt = this.env.DB.prepare(`
      INSERT INTO unit_test_sessions (session_id, timestamp_start, status, total_tests, completed_tests, failed_tests)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

		await stmt
			.bind(session.session_id, session.timestamp_start, session.status, session.total_tests, session.completed_tests, session.failed_tests)
			.run();

		return session;
	}

	/**
	 * Get a unit test session by session_id
	 */
	async getSession(sessionId: string): Promise<UnitTestSession | null> {
		const stmt = this.env.DB.prepare(`
      SELECT * FROM unit_test_sessions WHERE session_id = ?
    `);

		const result = await stmt.bind(sessionId).first();
		return result as UnitTestSession | null;
	}

	/**
	 * Update a unit test session
	 */
	async updateSession(request: UpdateSessionRequest): Promise<UnitTestSession | null> {
		const updateFields = [];
		const values = [];

		if (request.status) {
			updateFields.push('status = ?');
			values.push(request.status);
		}

		if (request.completed_tests !== undefined) {
			updateFields.push('completed_tests = ?');
			values.push(request.completed_tests);
		}

		if (request.failed_tests !== undefined) {
			updateFields.push('failed_tests = ?');
			values.push(request.failed_tests);
		}

		if (request.status === 'completed' || request.status === 'failed' || request.status === 'cancelled') {
			updateFields.push('timestamp_completed = ?');
			values.push(new Date().toISOString());
		}

		updateFields.push('updated_at = ?');
		values.push(new Date().toISOString());

		values.push(request.session_id);

		const stmt = this.env.DB.prepare(`
      UPDATE unit_test_sessions
      SET ${updateFields.join(', ')}
      WHERE session_id = ?
    `);

		await stmt.bind(...values).run();

		return this.getSession(request.session_id);
	}

	/**
	 * Create a test record for tracking
	 */
	async createTest(request: CreateTestRequest): Promise<UnitTestResult> {
		const test: UnitTestResult = {
			session_id: request.session_id,
			test_name: request.test_name,
			test_category: request.test_category || 'unit',
			status: 'pending',
		};

		const stmt = this.env.DB.prepare(`
      INSERT INTO unit_test_results (session_id, test_name, test_category, status)
      VALUES (?, ?, ?, ?)
    `);

		await stmt.bind(test.session_id, test.test_name, test.test_category, test.status).run();

		return test;
	}

	/**
	 * Update a test result
	 */
	async updateTestResult(request: UpdateTestResultRequest): Promise<UnitTestResult | null> {
		const updateFields = [];
		const values = [];

		if (request.status) {
			updateFields.push('status = ?');
			values.push(request.status);
		}

		if (request.test_results !== undefined) {
			updateFields.push('test_results = ?');
			values.push(JSON.stringify(request.test_results));
		}

		if (request.error_message !== undefined) {
			updateFields.push('error_message = ?');
			values.push(request.error_message);
		}

		if (request.duration_ms !== undefined) {
			updateFields.push('duration_ms = ?');
			values.push(request.duration_ms);
		}

		if (request.status === 'running') {
			updateFields.push('timestamp_start = ?');
			values.push(new Date().toISOString());
		}

		if (request.status === 'passed' || request.status === 'failed' || request.status === 'skipped' || request.status === 'error') {
			updateFields.push('timestamp_completed = ?');
			values.push(new Date().toISOString());
		}

		updateFields.push('updated_at = ?');
		values.push(new Date().toISOString());

		values.push(request.session_id, request.test_name);

		const stmt = this.env.DB.prepare(`
      UPDATE unit_test_results
      SET ${updateFields.join(', ')}
      WHERE session_id = ? AND test_name = ?
    `);

		await stmt.bind(...values).run();

		// Get the updated test result
		const getStmt = this.env.DB.prepare(`
      SELECT * FROM unit_test_results WHERE session_id = ? AND test_name = ?
    `);

		const result = await getStmt.bind(request.session_id, request.test_name).first();
		return result as UnitTestResult | null;
	}

	/**
	 * Get all test results for a session
	 */
	async getTestResults(sessionId: string): Promise<UnitTestResult[]> {
		const stmt = this.env.DB.prepare(`
      SELECT * FROM unit_test_results
      WHERE session_id = ?
      ORDER BY created_at ASC
    `);

		const result = await stmt.bind(sessionId).all();
		return result.results as unknown[] as UnitTestResult[];
	}

	/**
	 * Get test results by status
	 */
	async getTestResultsByStatus(sessionId: string, status: string): Promise<UnitTestResult[]> {
		const stmt = this.env.DB.prepare(`
      SELECT * FROM unit_test_results
      WHERE session_id = ? AND status = ?
      ORDER BY created_at ASC
    `);

		const result = await stmt.bind(sessionId, status).all();
		return result.results as unknown[] as UnitTestResult[];
	}

	/**
	 * Get session statistics
	 */
	async getSessionStats(sessionId: string): Promise<{
		total: number;
		completed: number;
		failed: number;
		running: number;
		pending: number;
	}> {
		const stmt = this.env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' OR status = 'error' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM unit_test_results
      WHERE session_id = ?
    `);

		const result = (await stmt.bind(sessionId).first()) as any;
		return {
			total: result.total || 0,
			completed: result.completed || 0,
			failed: result.failed || 0,
			running: result.running || 0,
			pending: result.pending || 0,
		};
	}

	/**
	 * List all sessions with pagination
	 */
	async listSessions(limit: number = 50, offset: number = 0): Promise<UnitTestSession[]> {
		const stmt = this.env.DB.prepare(`
      SELECT * FROM unit_test_sessions
      ORDER BY timestamp_start DESC
      LIMIT ? OFFSET ?
    `);

		const result = await stmt.bind(limit, offset).all();
		return result.results as unknown[] as UnitTestSession[];
	}

	/**
	 * Delete a session and all its test results
	 */
	async deleteSession(sessionId: string): Promise<boolean> {
		const stmt = this.env.DB.prepare(`
      DELETE FROM unit_test_sessions WHERE session_id = ?
    `);

		const result = await stmt.bind(sessionId).run();
		return (result as any).changes > 0;
	}
}
