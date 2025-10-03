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
    const camerasUrl = `${this.env.PROTECT_API}/protect/cameras`;

    // Ensure we're logged in
    if (!this.cookies) {
      await this.login();
    }

    try {
      const response = await fetch(camerasUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-api-key': this.env.PROTECT_API_KEY,
          'Cookie': this.cookies ? this.serializeCookies(this.cookies) : '',
        },
      });

      if (!response.ok) {
        // If unauthorized, try to login again
        if (response.status === 401) {
          await this.login();
          // Retry with new cookies
          const retryResponse = await fetch(camerasUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'x-api-key': this.env.PROTECT_API_KEY,
              'Cookie': this.cookies ? this.serializeCookies(this.cookies) : '',
            },
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            throw new Error(`Failed to fetch cameras: ${retryResponse.status} ${errorText}`);
          }

          const data = await retryResponse.json() as { cameras?: ProtectCamera[] };
          return data.cameras || [];
        }

        const errorText = await response.text();
        throw new Error(`Failed to fetch cameras: ${response.status} ${errorText}`);
      }

      const data = await response.json() as { cameras?: ProtectCamera[] };
      return data.cameras || [];
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
   * Get camera streams for a specific camera
   */
  async getCameraStreams(cameraId: string): Promise<ProtectStream[]> {
    const camera = await this.getCamera(cameraId);
    if (!camera) {
      throw new Error(`Camera with ID ${cameraId} not found`);
    }

    const protectHost = this.env.PROTECT_API.split('//')[1];

    return camera.channels.map(channel => ({
      name: channel.name || 'Unknown',
      enabled: channel.isRtspEnabled || false,
      url: channel.isRtspEnabled
        ? `rtsp://${protectHost}:7447/${channel.rtspAlias}`
        : 'N/A'
    }));
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
