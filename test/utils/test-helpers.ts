import type { Env } from '../../src/types.js';
import { vi } from 'vitest';

/**
 * Creates a mock environment for testing
 */
export function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    // Database
    DB: {} as D1Database,

    // Storage
    BUCKET: {} as R2Bucket,

    // AI
    AI: {},

    // Queue
    EVENTS_Q: {} as Queue,

    // Static Assets
    ASSETS: {
      fetch: vi.fn().mockResolvedValue(new Response('Mock asset', { status: 200 }))
    } as any,

    // Home Assistant
    HA_BASE_URL: 'https://test-ha.example.com',
    HA_TOKEN: 'test-ha-token',
    HA_VISION_SERVICE: 'test-vision-service',

    // Protect API
    PROTECT_API: 'https://test-protect.example.com',
    PROTECT_API_KEY: 'test-api-key',
    UNIFI_USERNAME: 'test-user',
    UNIFI_PASSWORD: 'test-password',

    // Cameras
    CAMERA_IDS: 'camera1,camera2',

    // Notifications
    NTFY_TOPIC_URL: 'https://ntfy.sh/test-topic',

    ...overrides
  };
}

/**
 * Creates a mock Request object for testing
 */
export function createMockRequest(
  url: string,
  options: RequestInit = {}
): Request {
  return new Request(url, {
    method: 'GET',
    ...options
  });
}

/**
 * Creates a mock Response object for testing
 */
export function createMockResponse(
  body: any = {},
  status: number = 200,
  headers: HeadersInit = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

/**
 * Mock fetch function for testing API calls
 */
export function createMockFetch(responses: Record<string, Response> = {}) {
  return vi.fn().mockImplementation((url: string | Request) => {
    const urlString = typeof url === 'string' ? url : url.url;
    const response = responses[urlString];

    if (response) {
      return Promise.resolve(response);
    }

    // Default mock response
    return Promise.resolve(createMockResponse({ error: 'Not found' }, 404));
  });
}

/**
 * Mock camera data for testing
 */
export const mockCameraData = {
  id: 'test-camera-1',
  host: '192.168.1.100',
  connectionHost: '192.168.1.100',
  lastSeen: '2025-01-29T12:00:00Z',
  isPoorNetwork: false,
  lastRing: '2025-01-29T11:30:00Z',
  videoCodec: 'H264',
  wiredConnectionState: { phyRate: 1000 },
  wifiConnectionState: { signal: -50 },
  talkbackSettings: { type: 'none' },
  speakerSettings: { isEnabled: false },
  smartDetectSettings: {
    objectTypes: ['person', 'vehicle'],
    autoTrackingObjectTypes: ['person'],
    autoTrackingWithZoom: false,
    audioTypes: ['smoke', 'glass'],
    detectionRanges: []
  },
  motionZones: [],
  smartDetectZones: [],
  name: 'Test Camera',
  mac: 'aa:bb:cc:dd:ee:ff',
  type: 'UVC-G3-FLEX',
  state: 'CONNECTED',
  isRecording: true,
  channels: [
    {
      name: 'High',
      isRtspEnabled: true,
      rtspAlias: 'high'
    },
    {
      name: 'Medium',
      isRtspEnabled: true,
      rtspAlias: 'medium'
    }
  ]
};

/**
 * Mock bootstrap data for testing
 */
export const mockBootstrapData = {
  cameras: [mockCameraData],
  nvr: {
    id: 'test-nvr',
    name: 'Test NVR'
  }
};

/**
 * Mock webhook event for testing
 */
export const mockWebhookEvent = {
  type: 'motion',
  camera: 'test-camera-1',
  timestamp: '2025-01-29T12:00:00Z',
  data: {
    confidence: 0.95,
    boundingBox: { x: 100, y: 100, width: 200, height: 300 }
  }
};
