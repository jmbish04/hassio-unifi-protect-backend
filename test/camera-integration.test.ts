import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProtectApiService } from '../src/services/protect-api.js';
import { createMockEnv } from './utils/test-helpers.js';

describe('Camera Integration Tests - Real API Format', () => {
  let service: ProtectApiService;
  let mockEnv: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    mockEnv = createMockEnv({
      PROTECT_API: 'https://unifi-cameras.hacolby.app',
      PROTECT_API_KEY: 'test-api-key-32-characters-long'
    });
    service = new ProtectApiService(mockEnv);
  });

  describe('Real API Response Format Tests', () => {
    it('should handle the actual API response format from unifi-cameras.hacolby.app', async () => {
      // Mock the actual API response format we discovered
      const realApiResponse = {
        items: [
          {
            camera_id: 'cam_driveway',
            name: 'Driveway',
            model: 'UVC-G4',
            is_online: true
          },
          {
            camera_id: 'cam_front_door',
            name: 'Front Door',
            model: 'UVC-G3',
            is_online: false
          },
          {
            camera_id: 'cam_backyard',
            name: 'Backyard',
            model: 'UVC-G4-PRO',
            is_online: true
          }
        ]
      };

      const mockResponse = new Response(JSON.stringify(realApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const cameras = await service.getCameras();

      expect(cameras).toHaveLength(3);

      // Test first camera
      expect(cameras[0]).toMatchObject({
        id: 'cam_driveway',
        name: 'Driveway',
        type: 'UVC-G4',
        state: 'CONNECTED',
        mac: '', // Not available in this API
        isRecording: false, // Not available in this API
        host: '', // Not available in this API
        connectionHost: '', // Not available in this API
        lastSeen: expect.any(String),
        isPoorNetwork: false, // Not available in this API
        lastRing: '', // Not available in this API
        videoCodec: '', // Not available in this API
        wiredConnectionState: {},
        wifiConnectionState: {},
        talkbackSettings: {},
        speakerSettings: {},
        smartDetectSettings: {
          objectTypes: [],
          autoTrackingObjectTypes: [],
          autoTrackingWithZoom: false,
          audioTypes: [],
          detectionRanges: []
        },
        motionZones: [],
        smartDetectZones: [],
        channels: []
      });

      // Test second camera (offline)
      expect(cameras[1]).toMatchObject({
        id: 'cam_front_door',
        name: 'Front Door',
        type: 'UVC-G3',
        state: 'DISCONNECTED'
      });

      // Test third camera
      expect(cameras[2]).toMatchObject({
        id: 'cam_backyard',
        name: 'Backyard',
        type: 'UVC-G4-PRO',
        state: 'CONNECTED'
      });
    });

    it('should handle empty camera list from real API', async () => {
      const realApiResponse = { items: [] };
      const mockResponse = new Response(JSON.stringify(realApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const cameras = await service.getCameras();

      expect(cameras).toHaveLength(0);
    });

    it('should handle real API streams response format', async () => {
      const realStreamsResponse = {
        streams: {
          vendor_rtsp_url: 'rtsp://unifi.local:7447/cam_driveway',
          proxy_hls_url: 'https://unifi-cameras.hacolby.app/proxy/hls/cam_driveway/master.m3u8',
          proxy_status: 'running'
        }
      };

      const mockResponse = new Response(JSON.stringify(realStreamsResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const streams = await service.getCameraStreams('cam_driveway');

      expect(streams).toHaveLength(2);
      expect(streams[0]).toMatchObject({
        name: 'RTSP Stream',
        enabled: true,
        url: 'rtsp://unifi.local:7447/cam_driveway'
      });
      expect(streams[1]).toMatchObject({
        name: 'HLS Stream',
        enabled: true,
        url: 'https://unifi-cameras.hacolby.app/proxy/hls/cam_driveway/master.m3u8'
      });
    });

    it('should handle streams with proxy not running', async () => {
      const realStreamsResponse = {
        streams: {
          vendor_rtsp_url: 'rtsp://unifi.local:7447/cam_driveway',
          proxy_hls_url: 'https://unifi-cameras.hacolby.app/proxy/hls/cam_driveway/master.m3u8',
          proxy_status: 'stopped'
        }
      };

      const mockResponse = new Response(JSON.stringify(realStreamsResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const streams = await service.getCameraStreams('cam_driveway');

      expect(streams).toHaveLength(2);
      expect(streams[0]).toMatchObject({
        name: 'RTSP Stream',
        enabled: true,
        url: 'rtsp://unifi.local:7447/cam_driveway'
      });
      expect(streams[1]).toMatchObject({
        name: 'HLS Stream',
        enabled: false, // proxy_status is 'stopped'
        url: 'https://unifi-cameras.hacolby.app/proxy/hls/cam_driveway/master.m3u8'
      });
    });

    it('should handle streams with only RTSP URL', async () => {
      const realStreamsResponse = {
        streams: {
          vendor_rtsp_url: 'rtsp://unifi.local:7447/cam_driveway',
          proxy_hls_url: null,
          proxy_status: null
        }
      };

      const mockResponse = new Response(JSON.stringify(realStreamsResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const streams = await service.getCameraStreams('cam_driveway');

      expect(streams).toHaveLength(1);
      expect(streams[0]).toMatchObject({
        name: 'RTSP Stream',
        enabled: true,
        url: 'rtsp://unifi.local:7447/cam_driveway'
      });
    });

    it('should handle streams with only HLS URL', async () => {
      const realStreamsResponse = {
        streams: {
          vendor_rtsp_url: null,
          proxy_hls_url: 'https://unifi-cameras.hacolby.app/proxy/hls/cam_driveway/master.m3u8',
          proxy_status: 'running'
        }
      };

      const mockResponse = new Response(JSON.stringify(realStreamsResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const streams = await service.getCameraStreams('cam_driveway');

      expect(streams).toHaveLength(1);
      expect(streams[0]).toMatchObject({
        name: 'HLS Stream',
        enabled: true,
        url: 'https://unifi-cameras.hacolby.app/proxy/hls/cam_driveway/master.m3u8'
      });
    });

    it('should handle empty streams response', async () => {
      const realStreamsResponse = {
        streams: {
          vendor_rtsp_url: null,
          proxy_hls_url: null,
          proxy_status: null
        }
      };

      const mockResponse = new Response(JSON.stringify(realStreamsResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const streams = await service.getCameraStreams('cam_driveway');

      expect(streams).toHaveLength(0);
    });
  });

  describe('API Authentication Tests', () => {
    it('should handle 401 unauthorized response', async () => {
      const unauthorizedResponse = {
        detail: {
          code: 'unauthorized',
          message: 'Missing or invalid x-api-key'
        }
      };

      const mockResponse = new Response(JSON.stringify(unauthorizedResponse), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await expect(service.getCameras()).rejects.toThrow('Failed to fetch cameras: 401');
    });

    it('should handle 403 forbidden response', async () => {
      const forbiddenResponse = {
        detail: {
          code: 'forbidden',
          message: 'Insufficient permissions'
        }
      };

      const mockResponse = new Response(JSON.stringify(forbiddenResponse), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await expect(service.getCameras()).rejects.toThrow('Failed to fetch cameras: 403');
    });

    it('should handle 404 not found response', async () => {
      const notFoundResponse = {
        detail: {
          code: 'not_found',
          message: 'Camera not found'
        }
      };

      const mockResponse = new Response(JSON.stringify(notFoundResponse), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      // The current implementation returns empty array on error, not throws
      const streams = await service.getCameraStreams('nonexistent-camera');
      expect(streams).toHaveLength(0);
    });

    it('should handle 502 bad gateway response', async () => {
      const badGatewayResponse = {
        detail: {
          code: 'upstream_error',
          message: 'Failed to fetch vendor data'
        }
      };

      const mockResponse = new Response(JSON.stringify(badGatewayResponse), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await expect(service.getCameras()).rejects.toThrow('Failed to fetch cameras: 502');
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle malformed JSON in API response', async () => {
      const mockResponse = new Response('invalid json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await expect(service.getCameras()).rejects.toThrow();
    });

    it('should handle network timeout', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Request timeout'));

      await expect(service.getCameras()).rejects.toThrow('Request timeout');
    });

    it('should handle DNS resolution failure', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND'));

      await expect(service.getCameras()).rejects.toThrow('getaddrinfo ENOTFOUND');
    });

    it('should handle very large response body', async () => {
      // Create a large response with many cameras
      const largeCameraList = Array.from({ length: 1000 }, (_, i) => ({
        camera_id: `cam_${i.toString().padStart(4, '0')}`,
        name: `Camera ${i}`,
        model: 'UVC-G4',
        is_online: i % 2 === 0
      }));

      const realApiResponse = { items: largeCameraList };
      const mockResponse = new Response(JSON.stringify(realApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const cameras = await service.getCameras();

      expect(cameras).toHaveLength(1000);
      expect(cameras[0].id).toBe('cam_0000');
      expect(cameras[999].id).toBe('cam_0999');
    });

    it('should handle response with unexpected structure', async () => {
      const unexpectedResponse = {
        data: {
          cameras: [
            {
              id: 'cam_test',
              name: 'Test Camera',
              online: true
            }
          ]
        }
      };

      const mockResponse = new Response(JSON.stringify(unexpectedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const cameras = await service.getCameras();

      // Should return empty array since the structure doesn't match expected format
      expect(cameras).toHaveLength(0);
    });
  });
});
