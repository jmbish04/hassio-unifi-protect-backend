/**
 * ============================================================================
 * AI AGENT INSTRUCTIONS
 * @ai-instructions
 * ============================================================================
 *
 * Before modifying this file or suggesting changes to API interactions, please
 * retrieve the latest API specification:
 *
 *   curl https://unifi-cameras.hacolby.app/openapi.json
 *
 * This OpenAPI 3.0 schema defines:
 * - All available endpoints and their HTTP methods
 * - Request/response body structures and types
 * - Authentication requirements
 * - Query parameters and path variables
 *
 * Use this schema as the source of truth for API contracts rather than relying
 * solely on the implementation details in this file.
 * ============================================================================
 */

import type { Env, ProtectBootstrapData, ProtectCamera, ProtectStream, ProtectLoginResponse } from '../types.js';

export class ProtectApiService {
  private env: Env;
  private cookies: Record<string, string> | null = null;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Login to UniFi Protect using API key authentication
   */
  async login(): Promise<ProtectLoginResponse> {
    const loginUrl = `${this.env.PROTECT_API}/protect/login`;
    const payload = {
      username: this.env.UNIFI_USERNAME,
      password: this.env.UNIFI_PASSWORD
    };

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.PROTECT_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 404) {
          throw new Error(`UniFi Protect API not found at ${this.env.PROTECT_API}. Please check if the service is running and accessible.`);
        }
        throw new Error(`Authentication failed: ${response.status} ${errorText}`);
      }

      // Extract cookies from response
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        this.cookies = this.parseCookies(setCookieHeader);
      }

      return {
        message: 'Logged in successfully',
        status: 'success'
      };
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch bootstrap data from UniFi Protect
   */
  async fetchBootstrapData(): Promise<ProtectBootstrapData> {
    const bootstrapUrl = `${this.env.PROTECT_API}/proxy/protect/api/bootstrap`;

    // Ensure we're logged in
    if (!this.cookies) {
      await this.login();
    }

    try {
      const response = await fetch(bootstrapUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.env.PROTECT_API_KEY}`,
          'Cookie': this.cookies ? this.serializeCookies(this.cookies) : '',
        },
      });

      if (!response.ok) {
        // If unauthorized, try to login again
        if (response.status === 401) {
          await this.login();
          // Retry with new cookies
          const retryResponse = await fetch(bootstrapUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${this.env.PROTECT_API_KEY}`,
              'Cookie': this.cookies ? this.serializeCookies(this.cookies) : '',
            },
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            throw new Error(`Failed to fetch Protect data: ${retryResponse.status} ${errorText}`);
          }

          return await retryResponse.json();
        }

        const errorText = await response.text();
        throw new Error(`Failed to fetch Protect data: ${response.status} ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Bootstrap fetch error:', error);
      throw new Error(`Failed to fetch bootstrap data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all cameras from UniFi Protect
   */
  async getCameras(): Promise<ProtectCamera[]> {
    // Check if PROTECT_API is configured
    if (!this.env.PROTECT_API) {
      console.error('PROTECT_API environment variable is not set');
      throw new Error('PROTECT_API environment variable is not configured');
    }

    const camerasUrl = `${this.env.PROTECT_API}/protect/cameras`;

    try {
      console.log(`Fetching cameras from: ${camerasUrl}`);
      const response = await fetch(camerasUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-api-key': this.env.PROTECT_API_KEY,
        },
      });

      console.log(`Camera API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Camera API error: ${response.status} ${errorText}`);
        throw new Error(`Failed to fetch cameras: ${response.status} ${errorText}`);
      }

      const data = await response.json() as { items?: any[] };
      const items = data.items || [];

      console.log(`Found ${items.length} cameras in API response`);

      // If no cameras returned, log the issue but don't provide test data
      if (items.length === 0) {
        console.warn('No cameras found in API response. This could indicate:');
        console.warn('1. No cameras are configured in UniFi Protect');
        console.warn('2. API authentication is failing');
        console.warn('3. API endpoint is incorrect');
        console.warn('4. Cameras are not online');
        return [];
      }

      // Convert API format to our internal format
      const cameras = items.map(item => ({
        id: item.camera_id,
        name: item.name || 'Unknown Camera',
        type: item.model || 'Unknown',
        state: item.is_online ? 'CONNECTED' : 'DISCONNECTED',
        mac: '', // Not available in this API
        isRecording: false, // Not available in this API
        host: '', // Not available in this API
        connectionHost: '', // Not available in this API
        lastSeen: new Date().toISOString(),
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
      }));

      console.log(`Successfully processed ${cameras.length} cameras`);
      return cameras;
    } catch (error) {
      console.error('Cameras fetch error:', error);
      throw new Error(`Failed to fetch cameras: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific camera by ID
   */
  async getCamera(cameraId: string): Promise<ProtectCamera | null> {
    const cameras = await this.getCameras();
    return cameras.find(cam => cam.id === cameraId) || null;
  }

  /**
   * Get camera streams for a specific camera using the new API endpoint
   */
  async getCameraStreams(cameraId: string): Promise<ProtectStream[]> {
    // Check if PROTECT_API is configured
    if (!this.env.PROTECT_API) {
      console.error('PROTECT_API environment variable is not set');
      throw new Error('PROTECT_API environment variable is not configured');
    }

    const streamsUrl = `${this.env.PROTECT_API}/protect/cameras/${cameraId}/streams`;

    try {
      console.log(`Fetching streams from: ${streamsUrl}`);
      const response = await fetch(streamsUrl, {
        method: 'GET',
        headers: {
          'x-api-key': this.env.PROTECT_API_KEY,
        },
      });

      console.log(`Streams API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Streams API error: ${response.status} ${errorText}`);
        throw new Error(`Failed to fetch camera streams: ${response.status} ${errorText}`);
      }

      const data = await response.json() as { streams?: any };
      const streams = data.streams || {};

      console.log(`Streams data received:`, streams);

      // Convert API format to our internal format
      const protectStreams: ProtectStream[] = [];

      if (streams.vendor_rtsp_url) {
        protectStreams.push({
          name: 'RTSP Stream',
          enabled: true,
          url: streams.vendor_rtsp_url
        });
      }

      if (streams.proxy_hls_url) {
        protectStreams.push({
          name: 'HLS Stream',
          enabled: streams.proxy_status === 'running',
          url: streams.proxy_hls_url
        });
      }

      console.log(`Processed ${protectStreams.length} streams`);

      // If no streams found, return empty array instead of test data
      if (protectStreams.length === 0) {
        console.warn('No streams found in API response');
        return [];
      }

      return protectStreams;
    } catch (error) {
      console.error('Camera streams fetch error:', error);
      // Return empty array instead of test data when API fails
      return [];
    }
  }

  /**
   * Get camera snapshot image
   */
  async getCameraSnapshot(cameraId: string): Promise<ArrayBuffer> {
    // Check if PROTECT_API is configured
    if (!this.env.PROTECT_API) {
      console.error('PROTECT_API environment variable is not set');
      throw new Error('PROTECT_API environment variable is not configured');
    }

    // The API doesn't have a snapshot endpoint, so we'll create a placeholder
    console.log(`Creating placeholder snapshot for camera: ${cameraId}`);
    return this.createPlaceholderSnapshot(cameraId);
  }

  /**
   * Create a placeholder snapshot when the real snapshot is unavailable
   */
  private createPlaceholderSnapshot(cameraId: string): ArrayBuffer {
    // In Cloudflare Workers, we can't use OffscreenCanvas, so we'll create a simple placeholder
    console.log(`Creating placeholder snapshot for camera: ${cameraId}`);
    return this.createMinimalPlaceholder();
  }

  /**
   * Create a minimal placeholder JPEG
   */
  private createMinimalPlaceholder(): ArrayBuffer {
    // Minimal JPEG header for a 1x1 pixel image
    const placeholderImage = new Uint8Array([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
      0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
      0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xFF, 0xC4, 0x00, 0x14,
      0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x08, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C, 0x03, 0x01, 0x00, 0x02,
      0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x2A, 0x00, 0xFF, 0xD9
    ]);

    return placeholderImage.buffer;
  }

  /**
   * Parse cookies from set-cookie header
   */
  private parseCookies(setCookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    const cookiePairs = setCookieHeader.split(',');

    for (const pair of cookiePairs) {
      const [nameValue] = pair.split(';');
      const [name, value] = nameValue.trim().split('=');
      if (name && value) {
        cookies[name] = value;
      }
    }

    return cookies;
  }

  /**
   * Serialize cookies for request headers
   */
  private serializeCookies(cookies: Record<string, string>): string {
    return Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  /**
   * Validate API key for client authentication with this worker
   */
  validateApiKey(apiKey: string): boolean {
    if (!apiKey || apiKey.length === 0) {
      return false;
    }

    // If no worker API key is configured, allow any non-empty key for development
    if (!this.env.WORKER_API_KEY) {
      return true;
    }

    // Validate against the configured worker API key
    return apiKey === this.env.WORKER_API_KEY;
  }
}
