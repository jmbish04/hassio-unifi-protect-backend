import { describe, it, expect, beforeAll } from 'vitest';

// Test configuration
const TEST_CONFIG = {
  deployed: {
    baseUrl: 'https://unifi-protect-api.hacolby.workers.dev',
    apiKey: process.env.WORKER_API_KEY || '6502241638'
  },
  local: {
    baseUrl: 'http://localhost:8787',
    apiKey: process.env.WORKER_API_KEY || '6502241638'
  }
};

// Determine which environment to test against
const isLocal = process.env.TEST_ENV === 'local';
const config = isLocal ? TEST_CONFIG.local : TEST_CONFIG.deployed;

console.log(`🧪 Testing against ${isLocal ? 'LOCAL' : 'DEPLOYED'} worker: ${config.baseUrl}`);

describe('Webhook API Tests', () => {
  beforeAll(async () => {
    // Verify the worker is accessible
    const healthResponse = await fetch(`${config.baseUrl}/agent/security_sweep`, {
      headers: {
        'x-api-key': config.apiKey
      }
    });

    if (!healthResponse.ok) {
      throw new Error(`Worker not accessible: ${healthResponse.status} ${healthResponse.statusText}`);
    }

    console.log('✅ Worker is accessible and ready for testing');
  });

  describe('Webhook Endpoint', () => {
    it('should accept webhook POST requests', async () => {
      const webhookData = {
        eventId: `test-${Date.now()}`,
        cameraId: '65715e7900ce3103e414eb82', // Garage camera
        eventType: 'motion',
        timestamp: new Date().toISOString(),
        thumbnail: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        rawPayload: {
          test: 'data',
          camera: 'Garage',
          timestamp: Date.now()
        }
      };

      const response = await fetch(`${config.baseUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookData)
      });

      expect(response.status).toBe(200);
      const result = await response.json() as { success: boolean; message: string; requestId: string; eventId: string };
      expect(result.success).toBe(true);
      expect(result.message).toContain('Webhook received');
    });

    it('should handle webhook without thumbnail', async () => {
      const webhookData = {
        eventId: `test-no-thumb-${Date.now()}`,
        cameraId: '65715e7900ce3103e414eb82',
        eventType: 'doorbell',
        timestamp: new Date().toISOString(),
        rawPayload: {
          test: 'no thumbnail',
          camera: 'Garage'
        }
      };

      const response = await fetch(`${config.baseUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookData)
      });

      expect(response.status).toBe(200);
      const result = await response.json() as { success: boolean; message: string; requestId: string; eventId: string };
      expect(result.success).toBe(true);
    });

    it('should handle malformed webhook data gracefully', async () => {
      const response = await fetch(`${config.baseUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invalid: 'data' })
      });

      expect(response.status).toBe(200);
      const result = await response.json() as { success: boolean; message: string; requestId: string; eventId: string };
      expect(result.success).toBe(true);
    });
  });

  describe('Webhook Events Endpoint', () => {
    it('should require API key authentication', async () => {
      const response = await fetch(`${config.baseUrl}/webhook/events`);
      expect(response.status).toBe(401);
    });

    it('should return webhook events with valid API key', async () => {
      const response = await fetch(`${config.baseUrl}/webhook/events`, {
        headers: {
          'x-api-key': config.apiKey
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json() as { success: boolean; events: any[]; count: number; requestId: string };
      expect(result.success).toBe(true);
      expect(Array.isArray(result.events)).toBe(true);
      expect(typeof result.count).toBe('number');
    });

    it('should return events in descending timestamp order', async () => {
      const response = await fetch(`${config.baseUrl}/webhook/events`, {
        headers: {
          'x-api-key': config.apiKey
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json() as { success: boolean; events: any[]; count: number; requestId: string };

      if (result.events.length > 1) {
        const timestamps = result.events.map((event: any) => new Date(event.timestamp).getTime());
        for (let i = 0; i < timestamps.length - 1; i++) {
          expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
        }
      }
    });

    it('should limit results to 20 events', async () => {
      const response = await fetch(`${config.baseUrl}/webhook/events`, {
        headers: {
          'x-api-key': config.apiKey
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json() as { success: boolean; events: any[]; count: number; requestId: string };
      expect(result.events.length).toBeLessThanOrEqual(20);
    });
  });

  describe('R2 Fetch Endpoint', () => {
    it('should return 404 for non-existent R2 objects', async () => {
      const response = await fetch(`${config.baseUrl}/fetch/non-existent-key`);
      expect(response.status).toBe(404);
    });

    it('should handle R2 fetch requests', async () => {
      // First, create a webhook with thumbnail to generate an R2 object
      const webhookData = {
        eventId: `test-r2-${Date.now()}`,
        cameraId: '65715e7900ce3103e414eb82',
        eventType: 'motion',
        timestamp: new Date().toISOString(),
        thumbnail: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        rawPayload: { test: 'r2-fetch' }
      };

      // Send webhook
      await fetch(`${config.baseUrl}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookData)
      });

      // Wait a moment for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get webhook events to find the R2 key
      const eventsResponse = await fetch(`${config.baseUrl}/webhook/events`, {
        headers: { 'x-api-key': config.apiKey }
      });

      const eventsResult = await eventsResponse.json() as { success: boolean; events: any[]; count: number; requestId: string };
      const eventWithThumbnail = eventsResult.events.find((e: any) => e.thumbnail_r2_key);

      if (eventWithThumbnail) {
        const r2Response = await fetch(`${config.baseUrl}/fetch/${eventWithThumbnail.thumbnail_r2_key}`);
        expect(r2Response.status).toBe(200);
        expect(r2Response.headers.get('content-type')).toContain('image');
      }
    });
  });

  describe('Integration Tests', () => {
    it('should process webhook and make it available via events endpoint', async () => {
      const testEventId = `integration-test-${Date.now()}`;
      const webhookData = {
        eventId: testEventId,
        cameraId: '65715e7900ce3103e414eb82',
        eventType: 'motion',
        timestamp: new Date().toISOString(),
        rawPayload: {
          test: 'integration',
          camera: 'Garage',
          timestamp: Date.now()
        }
      };

      // Send webhook
      const webhookResponse = await fetch(`${config.baseUrl}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookData)
      });

      expect(webhookResponse.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if event appears in events list
      const eventsResponse = await fetch(`${config.baseUrl}/webhook/events`, {
        headers: { 'x-api-key': config.apiKey }
      });

      expect(eventsResponse.status).toBe(200);
      const eventsResult = await eventsResponse.json() as { success: boolean; events: any[]; count: number; requestId: string };

      const foundEvent = eventsResult.events.find((e: any) => e.event_id === testEventId);
      expect(foundEvent).toBeDefined();
      expect(foundEvent.camera_enum_id).toBe(webhookData.cameraId);
      expect(foundEvent.event_type).toBe(webhookData.eventType);
    });
  });
});
