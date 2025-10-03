import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProtectApiService } from '../../src/services/protect-api.js';
import { createMockEnv, createMockFetch, mockBootstrapData, mockCameraData } from '../utils/test-helpers.js';

describe('ProtectApiService', () => {
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

  describe('login', () => {
    it('should login successfully', async () => {
      const mockResponse = new Response(JSON.stringify({
        message: 'Logged in successfully',
        status: 'success'
      }), {
        status: 200,
        headers: {
          'set-cookie': 'session=abc123; Path=/; HttpOnly'
        }
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await service.login();

      expect(result).toEqual({
        message: 'Logged in successfully',
        status: 'success'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-protect.example.com/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: 'test-user',
            password: 'test-password'
          })
        })
      );
    });

    it('should handle login failure', async () => {
      const mockResponse = new Response('Unauthorized', { status: 401 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(service.login()).rejects.toThrow('Authentication failed: 401 Unauthorized');
    });
  });

  describe('fetchBootstrapData', () => {
    it('should fetch bootstrap data successfully', async () => {
      const mockResponse = new Response(JSON.stringify(mockBootstrapData), {
        status: 200,
        headers: {
          'set-cookie': 'session=abc123; Path=/; HttpOnly'
        }
      });

      mockFetch
        .mockResolvedValueOnce(mockResponse) // Login response
        .mockResolvedValueOnce(new Response(JSON.stringify(mockBootstrapData), { status: 200 })); // Bootstrap response

      const result = await service.fetchBootstrapData();

      expect(result).toEqual(mockBootstrapData);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Login + bootstrap
    });

    it('should retry with new login on 401', async () => {
      const loginResponse = new Response(JSON.stringify({
        message: 'Logged in successfully',
        status: 'success'
      }), {
        status: 200,
        headers: {
          'set-cookie': 'session=abc123; Path=/; HttpOnly'
        }
      });

      const bootstrapResponse = new Response(JSON.stringify(mockBootstrapData), { status: 200 });

      mockFetch
        .mockResolvedValueOnce(loginResponse) // Initial login
        .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 })) // First bootstrap attempt
        .mockResolvedValueOnce(loginResponse) // Retry login
        .mockResolvedValueOnce(bootstrapResponse); // Second bootstrap attempt

      const result = await service.fetchBootstrapData();

      expect(result).toEqual(mockBootstrapData);
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('getCameras', () => {
    it('should return formatted camera data', async () => {
      // Mock the fetchBootstrapData method directly
      const fetchBootstrapDataSpy = vi.spyOn(service, 'fetchBootstrapData').mockResolvedValue(mockBootstrapData);

      const cameras = await service.getCameras();

      expect(cameras).toHaveLength(1);
      expect(cameras[0]).toMatchObject({
        id: 'test-camera-1',
        name: 'Test Camera',
        state: 'CONNECTED',
        isRecording: true,
        channels: expect.any(Array)
      });
    });

    it('should handle empty camera list', async () => {
      // Mock the fetchBootstrapData method directly
      const fetchBootstrapDataSpy = vi.spyOn(service, 'fetchBootstrapData').mockResolvedValue({ cameras: [] });

      const cameras = await service.getCameras();

      expect(cameras).toHaveLength(0);
    });
  });

  describe('getCamera', () => {
    it('should return specific camera by ID', async () => {
      // Mock the fetchBootstrapData method directly
      const fetchBootstrapDataSpy = vi.spyOn(service, 'fetchBootstrapData').mockResolvedValue(mockBootstrapData);

      const camera = await service.getCamera('test-camera-1');

      expect(camera).toMatchObject({
        id: 'test-camera-1',
        name: 'Test Camera'
      });
    });

    it('should return null for non-existent camera', async () => {
      // Mock the fetchBootstrapData method directly
      const fetchBootstrapDataSpy = vi.spyOn(service, 'fetchBootstrapData').mockResolvedValue(mockBootstrapData);

      const camera = await service.getCamera('non-existent-camera');

      expect(camera).toBeNull();
    });
  });

  describe('getCameraStreams', () => {
    it('should return camera streams with RTSP URLs', async () => {
      // Mock the fetchBootstrapData method directly
      const fetchBootstrapDataSpy = vi.spyOn(service, 'fetchBootstrapData').mockResolvedValue(mockBootstrapData);

      const streams = await service.getCameraStreams('test-camera-1');

      expect(streams).toHaveLength(2);
      expect(streams[0]).toMatchObject({
        name: 'High',
        enabled: true,
        url: 'rtsp://test-protect.example.com:7447/high'
      });
      expect(streams[1]).toMatchObject({
        name: 'Medium',
        enabled: true,
        url: 'rtsp://test-protect.example.com:7447/medium'
      });
    });

    it('should throw error for non-existent camera', async () => {
      // Mock the fetchBootstrapData method directly
      const fetchBootstrapDataSpy = vi.spyOn(service, 'fetchBootstrapData').mockResolvedValue({ cameras: [] });

      await expect(service.getCameraStreams('non-existent-camera')).rejects.toThrow(
        'Camera with ID non-existent-camera not found'
      );
    });
  });

  describe('validateApiKey', () => {
    it('should validate correct API key', () => {
      expect(service.validateApiKey('test-api-key')).toBe(true);
    });

    it('should reject incorrect API key', () => {
      expect(service.validateApiKey('wrong-key')).toBe(false);
    });
  });
});
