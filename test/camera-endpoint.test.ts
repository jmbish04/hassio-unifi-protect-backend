import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProtectApiService } from '../src/services/protect-api.js';
import { createMockEnv, createMockFetch } from './utils/test-helpers.js';

describe('Camera Endpoint Tests', () => {
	let service: ProtectApiService;
	let mockEnv: ReturnType<typeof createMockEnv>;
	let mockFetch: ReturnType<typeof createMockFetch>;

	beforeEach(() => {
		mockEnv = createMockEnv();
		mockFetch = createMockFetch();
		service = new ProtectApiService(mockEnv);

		// Mock global fetch
		global.fetch = mockFetch;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('getCameras() - Service Layer', () => {
		it('should successfully fetch and parse cameras from API', async () => {
			// Mock API response with real API format
			const mockApiResponse = {
				items: [
					{
						camera_id: 'cam_driveway',
						name: 'Driveway Camera',
						model: 'UVC-G4',
						is_online: true,
					},
					{
						camera_id: 'cam_front_door',
						name: 'Front Door Camera',
						model: 'UVC-G3',
						is_online: false,
					},
				],
			};

			const mockResponse = new Response(JSON.stringify(mockApiResponse), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});

			mockFetch.mockResolvedValueOnce(mockResponse);

			const cameras = await service.getCameras();

			expect(cameras).toHaveLength(2);
			expect(cameras[0]).toMatchObject({
				id: 'cam_driveway',
				name: 'Driveway Camera',
				type: 'UVC-G4',
				state: 'CONNECTED',
			});
			expect(cameras[1]).toMatchObject({
				id: 'cam_front_door',
				name: 'Front Door Camera',
				type: 'UVC-G3',
				state: 'DISCONNECTED',
			});

			expect(mockFetch).toHaveBeenCalledWith(
				'https://test-protect.example.com/protect/cameras',
				expect.objectContaining({
					method: 'GET',
					headers: {
						Accept: 'application/json',
						'x-api-key': 'test-api-key',
					},
				}),
			);
		});

		it('should handle empty camera list from API', async () => {
			const mockApiResponse = { items: [] };
			const mockResponse = new Response(JSON.stringify(mockApiResponse), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});

			mockFetch.mockResolvedValueOnce(mockResponse);

			const cameras = await service.getCameras();

			expect(cameras).toHaveLength(0);
		});

		it('should handle API authentication failure', async () => {
			const mockResponse = new Response(
				JSON.stringify({
					detail: {
						code: 'unauthorized',
						message: 'Missing or invalid x-api-key',
					},
				}),
				{
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				},
			);

			mockFetch.mockResolvedValueOnce(mockResponse);

			await expect(service.getCameras()).rejects.toThrow('Failed to fetch cameras: 401');
		});

		it('should handle API server error', async () => {
			const mockResponse = new Response('Internal Server Error', {
				status: 500,
			});

			mockFetch.mockResolvedValueOnce(mockResponse);

			await expect(service.getCameras()).rejects.toThrow('Failed to fetch cameras: 500');
		});

		it('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			await expect(service.getCameras()).rejects.toThrow('Failed to fetch cameras: Network error');
		});

		it('should throw error when PROTECT_API is not configured', async () => {
			const serviceWithoutApi = new ProtectApiService({
				...mockEnv,
				PROTECT_API: '',
			});

			await expect(serviceWithoutApi.getCameras()).rejects.toThrow('PROTECT_API environment variable is not configured');
		});

		it('should handle malformed JSON response', async () => {
			const mockResponse = new Response('invalid json', {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});

			mockFetch.mockResolvedValueOnce(mockResponse);

			await expect(service.getCameras()).rejects.toThrow();
		});

		it('should handle missing items field in response', async () => {
			const mockApiResponse = {}; // Missing items field
			const mockResponse = new Response(JSON.stringify(mockApiResponse), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});

			mockFetch.mockResolvedValueOnce(mockResponse);

			const cameras = await service.getCameras();

			expect(cameras).toHaveLength(0);
		});
	});

	describe('getCameraStreams() - Service Layer', () => {
		it('should successfully fetch camera streams', async () => {
			const mockStreamsResponse = {
				streams: {
					vendor_rtsp_url: 'rtsp://unifi.local:7447/cam_driveway',
					proxy_hls_url: 'https://unifi-cameras.hacolby.app/proxy/hls/cam_driveway/master.m3u8',
					proxy_status: 'running',
				},
			};

			const mockResponse = new Response(JSON.stringify(mockStreamsResponse), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});

			mockFetch.mockResolvedValueOnce(mockResponse);

			const streams = await service.getCameraStreams('cam_driveway');

			expect(streams).toHaveLength(2);
			expect(streams[0]).toMatchObject({
				name: 'RTSP Stream',
				enabled: true,
				url: 'rtsp://unifi.local:7447/cam_driveway',
			});
			expect(streams[1]).toMatchObject({
				name: 'HLS Stream',
				enabled: true,
				url: 'https://unifi-cameras.hacolby.app/proxy/hls/cam_driveway/master.m3u8',
			});
		});

		it('should handle streams API authentication failure', async () => {
			const mockResponse = new Response(
				JSON.stringify({
					detail: {
						code: 'unauthorized',
						message: 'Missing or invalid x-api-key',
					},
				}),
				{
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				},
			);

			mockFetch.mockResolvedValueOnce(mockResponse);

			// The current implementation returns empty array on error, not throws
			const streams = await service.getCameraStreams('cam_driveway');
			expect(streams).toHaveLength(0);
		});

		it('should return empty array when no streams available', async () => {
			const mockStreamsResponse = { streams: {} };
			const mockResponse = new Response(JSON.stringify(mockStreamsResponse), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});

			mockFetch.mockResolvedValueOnce(mockResponse);

			const streams = await service.getCameraStreams('cam_driveway');

			expect(streams).toHaveLength(0);
		});

		it('should handle streams API errors gracefully', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const streams = await service.getCameraStreams('cam_driveway');

			expect(streams).toHaveLength(0);
		});
	});

	describe('getCameraSnapshot() - Service Layer', () => {
		it('should create placeholder snapshot when no snapshot endpoint available', async () => {
			const snapshot = await service.getCameraSnapshot('cam_driveway');

			expect(snapshot).toBeInstanceOf(ArrayBuffer);
			expect(snapshot.byteLength).toBeGreaterThan(0);
		});

		it('should throw error when PROTECT_API is not configured', async () => {
			const serviceWithoutApi = new ProtectApiService({
				...mockEnv,
				PROTECT_API: '',
			});

			await expect(serviceWithoutApi.getCameraSnapshot('cam_driveway')).rejects.toThrow(
				'PROTECT_API environment variable is not configured',
			);
		});
	});

	describe('API Endpoint Unit Tests', () => {
		it('should validate API key correctly', () => {
			expect(service.validateApiKey('test-api-key')).toBe(true);
			expect(service.validateApiKey('wrong-key')).toBe(true); // Any non-empty key is valid when WORKER_API_KEY is not set
			expect(service.validateApiKey('')).toBe(false);
		});

		it('should handle missing API key validation', () => {
			const serviceWithoutWorkerKey = new ProtectApiService({
				...mockEnv,
				WORKER_API_KEY: '',
			});

			expect(serviceWithoutWorkerKey.validateApiKey('any-key')).toBe(true);
		});

		it('should validate against configured WORKER_API_KEY when set', () => {
			const serviceWithWorkerKey = new ProtectApiService({
				...mockEnv,
				WORKER_API_KEY: 'correct-worker-key',
			});

			expect(serviceWithWorkerKey.validateApiKey('correct-worker-key')).toBe(true);
			expect(serviceWithWorkerKey.validateApiKey('wrong-key')).toBe(false);
			expect(serviceWithWorkerKey.validateApiKey('')).toBe(false);
		});
	});

	describe('Error Handling and Edge Cases', () => {
		it('should handle malformed camera data gracefully', async () => {
			const mockApiResponse = {
				items: [
					{
						// Missing required fields
						camera_id: 'cam_test',
						// name and is_online missing
					},
					{
						camera_id: 'cam_test2',
						name: 'Test Camera 2',
						is_online: true,
					},
				],
			};

			const mockResponse = new Response(JSON.stringify(mockApiResponse), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});

			mockFetch.mockResolvedValueOnce(mockResponse);

			const cameras = await service.getCameras();

			expect(cameras).toHaveLength(2);
			expect(cameras[0]).toMatchObject({
				id: 'cam_test',
				name: 'Unknown Camera',
				type: 'Unknown',
				state: 'DISCONNECTED',
			});
			expect(cameras[1]).toMatchObject({
				id: 'cam_test2',
				name: 'Test Camera 2',
				type: 'Unknown',
				state: 'CONNECTED',
			});
		});

		it('should handle null/undefined values in camera data', async () => {
			const mockApiResponse = {
				items: [
					{
						camera_id: 'cam_test',
						name: null,
						model: undefined,
						is_online: null,
					},
				],
			};

			const mockResponse = new Response(JSON.stringify(mockApiResponse), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});

			mockFetch.mockResolvedValueOnce(mockResponse);

			const cameras = await service.getCameras();

			expect(cameras).toHaveLength(1);
			expect(cameras[0]).toMatchObject({
				id: 'cam_test',
				name: 'Unknown Camera',
				type: 'Unknown',
				state: 'DISCONNECTED',
			});
		});

		it('should handle very large camera lists', async () => {
			const largeCameraList = Array.from({ length: 100 }, (_, i) => ({
				camera_id: `cam_${i}`,
				name: `Camera ${i}`,
				model: 'UVC-G4',
				is_online: i % 2 === 0,
			}));

			const mockApiResponse = { items: largeCameraList };
			const mockResponse = new Response(JSON.stringify(mockApiResponse), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});

			mockFetch.mockResolvedValueOnce(mockResponse);

			const cameras = await service.getCameras();

			expect(cameras).toHaveLength(100);
			expect(cameras[0].id).toBe('cam_0');
			expect(cameras[99].id).toBe('cam_99');
		});
	});

	describe('Performance and Logging', () => {
		it('should log API calls and responses', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const mockApiResponse = { items: [] };
			const mockResponse = new Response(JSON.stringify(mockApiResponse), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});

			mockFetch.mockResolvedValueOnce(mockResponse);

			await service.getCameras();

			expect(consoleSpy).toHaveBeenCalledWith('Fetching cameras from: https://test-protect.example.com/protect/cameras');
			expect(consoleSpy).toHaveBeenCalledWith('Using API key: Set (length: 12)');
			expect(consoleSpy).toHaveBeenCalledWith('Camera API response status: 200');
			expect(consoleSpy).toHaveBeenCalledWith('Found 0 cameras in API response');
			expect(consoleWarnSpy).toHaveBeenCalledWith('No cameras found in API response. This could indicate:');

			consoleSpy.mockRestore();
			consoleWarnSpy.mockRestore();
		});

		it('should handle API timeouts gracefully', async () => {
			mockFetch.mockImplementationOnce(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 100)));

			await expect(service.getCameras()).rejects.toThrow('Request timeout');
		});
	});
});
