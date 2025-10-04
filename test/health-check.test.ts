import { describe, it, expect } from 'vitest';

/**
 * Quick Health Check Test
 *
 * This is a minimal test to quickly verify that the https://unifi-cameras.hacolby.app
 * service is up and running. Run this test when you need to quickly check service status.
 */

const API_BASE_URL = 'https://unifi-cameras.hacolby.app';

describe('Quick Health Check', () => {
	it('should verify service is up and running', async () => {
		const response = await fetch(`${API_BASE_URL}/health`);

		expect(response.status).toBe(200);

		const data = (await response.json()) as {
			status: string;
			uptime_s: number;
			test_summary?: { stdout: string };
		};
		expect(data.status).toBe('ok');
		expect(data.uptime_s).toBeGreaterThan(0);

		console.log('✅ Service is healthy:', {
			status: data.status,
			uptime: `${data.uptime_s}s`,
			testSummary: data.test_summary?.stdout || 'No test summary',
		});
	});

	it('should verify cameras endpoint is accessible', async () => {
		const response = await fetch(`${API_BASE_URL}/protect/cameras`);

		expect(response.status).toBe(200);

		const data = (await response.json()) as { items: any[] };
		expect(data).toHaveProperty('items');
		expect(Array.isArray(data.items)).toBe(true);

		console.log('✅ Cameras endpoint accessible:', {
			status: response.status,
			cameraCount: data.items.length,
			hasItems: data.items.length > 0,
		});
	});

	it('should verify OpenAPI spec is accessible', async () => {
		const response = await fetch(`${API_BASE_URL}/openapi.json`);

		expect(response.status).toBe(200);

		const data = (await response.json()) as {
			openapi: string;
			info: { title: string };
			paths: Record<string, any>;
		};
		expect(data.openapi).toBeDefined();
		expect(data.info).toBeDefined();
		expect(data.paths).toBeDefined();

		const endpointCount = Object.keys(data.paths).length;
		console.log('✅ OpenAPI spec accessible:', {
			status: response.status,
			openApiVersion: data.openapi,
			serviceName: data.info.title,
			endpointCount: endpointCount,
		});
	});
});
