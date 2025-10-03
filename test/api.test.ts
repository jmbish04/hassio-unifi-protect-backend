import { describe, it, expect, beforeAll } from 'vitest';
import { getTestConfig, logTestEnvironment } from './test-config';

const config = getTestConfig();
logTestEnvironment(config);

describe('API Endpoint Tests', () => {
  beforeAll(async () => {
    // Verify the worker is accessible
    try {
      const healthResponse = await fetch(`${config.baseUrl}/agent/security_sweep`, {
        headers: {
          'x-api-key': config.apiKey
        }
      });

      if (!healthResponse.ok) {
        throw new Error(`Worker not accessible: ${healthResponse.status} ${healthResponse.statusText}`);
      }

      console.log('✅ Worker is accessible and ready for testing');
    } catch (error) {
      console.error('❌ Worker accessibility check failed:', error);
      throw error;
    }
  });

  describe('Health Check Endpoints', () => {
    it('should respond to security sweep endpoint', async () => {
      const response = await fetch(`${config.baseUrl}/agent/security_sweep`, {
        headers: {
          'x-api-key': config.apiKey
        }
      });

      expect(response.status).toBe(200);
      const result = await response.text();
      expect(result).toBe('ok');
    });
  });

  describe('UniFi Protect API Endpoints', () => {
    it('should require API key for cameras endpoint', async () => {
      const response = await fetch(`${config.baseUrl}/protect/cameras`);
      expect(response.status).toBe(401);
    });

    it('should return cameras with valid API key', async () => {
      const response = await fetch(`${config.baseUrl}/protect/cameras`, {
        headers: {
          'x-api-key': config.apiKey
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json() as { cameras: any[] };
      expect(result.cameras).toBeDefined();
      expect(Array.isArray(result.cameras)).toBe(true);
    });

    it('should return specific camera with valid API key', async () => {
      // First get cameras to find a valid ID
      const camerasResponse = await fetch(`${config.baseUrl}/protect/cameras`, {
        headers: {
          'x-api-key': config.apiKey
        }
      });

      const camerasResult = await camerasResponse.json() as { cameras: any[] };
      if (camerasResult.cameras.length > 0) {
        const cameraId = camerasResult.cameras[0].id;

        const response = await fetch(`${config.baseUrl}/protect/cameras/${cameraId}`, {
          headers: {
            'x-api-key': config.apiKey
          }
        });

        expect(response.status).toBe(200);
        const result = await response.json() as { id: string };
        expect(result.id).toBe(cameraId);
      }
    });

    it('should return camera streams with valid API key', async () => {
      // First get cameras to find a valid ID
      const camerasResponse = await fetch(`${config.baseUrl}/protect/cameras`, {
        headers: {
          'x-api-key': config.apiKey
        }
      });

      const camerasResult = await camerasResponse.json() as { cameras: any[] };
      if (camerasResult.cameras.length > 0) {
        const cameraId = camerasResult.cameras[0].id;

        const response = await fetch(`${config.baseUrl}/protect/cameras/${cameraId}/streams`, {
          headers: {
            'x-api-key': config.apiKey
          }
        });

        expect(response.status).toBe(200);
        const result = await response.json() as { streams: any[] };
        expect(result.streams).toBeDefined();
        expect(Array.isArray(result.streams)).toBe(true);
      }
    });
  });

  describe('Static Assets', () => {
    it('should serve favicon.ico', async () => {
      const response = await fetch(`${config.baseUrl}/favicon.ico`);
      expect(response.status).toBe(204);
    });

    it('should serve index.html', async () => {
      const response = await fetch(`${config.baseUrl}/`);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('UniFi Protect API');
    });

    it('should serve OpenAPI spec', async () => {
      const response = await fetch(`${config.baseUrl}/openapi.json`);
      expect(response.status).toBe(200);
      const spec = await response.json() as { openapi: string };
      expect(spec.openapi).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await fetch(`${config.baseUrl}/non-existent-endpoint`);
      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON in webhook', async () => {
      const response = await fetch(`${config.baseUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      });

      expect(response.status).toBe(500);
    });
  });
});
