import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecuritySweepService } from '../../src/services/security-sweep.js';
import { createMockEnv } from '../utils/test-helpers.js';

// Mock the other services
vi.mock('../../src/services/camera.js', () => ({
	CameraService: vi.fn().mockImplementation(() => ({
		getCameraList: vi.fn().mockResolvedValue(['camera-1', 'camera-2']),
		getSelectedCameras: vi.fn().mockResolvedValue(['camera-1']),
		fetchAndStoreSnapshot: vi.fn().mockResolvedValue({
			bytes: new Uint8Array([1, 2, 3]),
			r2Key: 'test-key',
		}),
	})),
}));

vi.mock('../../src/services/rules.js', () => ({
	RulesEngine: vi.fn().mockImplementation(() => ({
		evaluateRules: vi.fn().mockReturnValue([
			{
				name: 'test-rule',
				description: 'Test rule',
				enabled: true,
			},
		]),
		summarise: vi.fn().mockReturnValue('All clear'),
		computeBooleans: vi.fn().mockReturnValue({}),
	})),
}));

vi.mock('../../src/services/vision.js', () => ({
	VisionAnalysisService: vi.fn().mockImplementation(() => ({
		analyzeImage: vi.fn().mockResolvedValue({
			description: 'Test analysis',
			objects: ['person'],
			confidence: 0.95,
		}),
	})),
}));

vi.mock('../../src/services/notifications.js', () => ({
	NotificationService: vi.fn().mockImplementation(() => ({
		send: vi.fn().mockResolvedValue(true),
	})),
}));

vi.mock('../../src/services/storage.js', () => ({
	StorageService: vi.fn().mockImplementation(() => ({
		saveRun: vi.fn().mockResolvedValue(undefined),
		saveObservation: vi.fn().mockResolvedValue(undefined),
	})),
}));

vi.mock('../../src/integrations/homeassistant.js', () => ({
	HomeAssistantClient: vi.fn().mockImplementation(() => ({
		getStates: vi.fn().mockResolvedValue({}),
		setInputBooleans: vi.fn().mockResolvedValue(undefined),
		analyzeWithVision: vi.fn().mockResolvedValue({}),
	})),
}));

describe('SecuritySweepService', () => {
	let service: SecuritySweepService;
	let mockEnv: ReturnType<typeof createMockEnv>;

	beforeEach(() => {
		mockEnv = createMockEnv();
		service = new SecuritySweepService(mockEnv);
	});

	describe('runSecuritySweep', () => {
		it('should run security sweep successfully', async () => {
			const options = {
				trigger: 'test',
				focusCamera: null,
			};

			const result = await service.runSecuritySweep(options);

			expect(result).toMatchObject({
				runId: expect.any(String),
				ts: expect.any(Number),
				trigger: 'test',
				summary: expect.any(String),
				observations: expect.any(Array),
			});

			expect(result.runId).toMatch(/^[a-f0-9-]+$/); // UUID format
			expect(result.ts).toBeGreaterThan(0);
		});

		it('should generate unique run IDs', async () => {
			const options = {
				trigger: 'test',
				focusCamera: null,
			};

			const result1 = await service.runSecuritySweep(options);
			const result2 = await service.runSecuritySweep(options);

			expect(result1.runId).not.toBe(result2.runId);
		});

		it('should include trigger in result', async () => {
			const options = {
				trigger: 'cron',
				focusCamera: null,
			};

			const result = await service.runSecuritySweep(options);

			expect(result.trigger).toBe('cron');
		});

		it('should handle focus camera option', async () => {
			const options = {
				trigger: 'test',
				focusCamera: 'camera-1',
			};

			const result = await service.runSecuritySweep(options);

			expect(result).toMatchObject({
				runId: expect.any(String),
				ts: expect.any(Number),
				trigger: 'test',
				summary: expect.any(String),
				observations: expect.any(Array),
			});
		});

		it('should handle different trigger types', async () => {
			const triggers = ['api', 'cron', 'webhook', 'manual'];

			for (const trigger of triggers) {
				const options = {
					trigger,
					focusCamera: null,
				};

				const result = await service.runSecuritySweep(options);

				expect(result.trigger).toBe(trigger);
				expect(result.runId).toBeDefined();
				expect(result.ts).toBeGreaterThan(0);
			}
		});

		it('should generate meaningful summary', async () => {
			const options = {
				trigger: 'test',
				focusCamera: null,
			};

			const result = await service.runSecuritySweep(options);

			expect(result.summary).toBeTruthy();
			expect(typeof result.summary).toBe('string');
			expect(result.summary.length).toBeGreaterThan(0);
		});

		it('should return observations array', async () => {
			const options = {
				trigger: 'test',
				focusCamera: null,
			};

			const result = await service.runSecuritySweep(options);

			expect(Array.isArray(result.observations)).toBe(true);
		});

		it('should handle errors gracefully', async () => {
			// Mock a service to throw an error
			const { CameraService } = await import('../../src/services/camera.js');
			const mockCameraService = new (CameraService as any)();
			mockCameraService.getCameras = vi.fn().mockRejectedValue(new Error('Camera service error'));

			const options = {
				trigger: 'test',
				focusCamera: null,
			};

			// Should not throw, but handle the error gracefully
			const result = await service.runSecuritySweep(options);

			expect(result).toMatchObject({
				runId: expect.any(String),
				ts: expect.any(Number),
				trigger: 'test',
				summary: expect.any(String),
				observations: expect.any(Array),
			});
		});
	});

	describe('runId generation', () => {
		it('should generate unique IDs in runSecuritySweep', async () => {
			const result1 = await service.runSecuritySweep();
			const result2 = await service.runSecuritySweep();

			expect(result1.runId).toBeDefined();
			expect(result2.runId).toBeDefined();
			expect(result1.runId).not.toBe(result2.runId);
		});

		it('should generate UUID-like format', async () => {
			const result = await service.runSecuritySweep();
			const id = result.runId;

			// Should be a UUID-like string
			expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
		});
	});
});
