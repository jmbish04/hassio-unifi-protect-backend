import type { Env, SnapshotResult } from '../types.js';

export class CameraService {
  constructor(private env: Env) {}

  getCameraList(): string[] {
    return (this.env.CAMERA_IDS || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
  }

  getSelectedCameras(focusCamera?: string | null): string[] {
    const cameras = this.getCameraList();
    return focusCamera ? cameras.filter(c => c === focusCamera) : cameras;
  }

  async fetchAndStoreSnapshot(camera: string, runId: string, ts: number): Promise<SnapshotResult> {
    // Your Protect API should expose something like: GET /cameras/:id/snapshot
    const url = new URL(this.env.PROTECT_API);
    url.pathname = `/cameras/${encodeURIComponent(camera)}/snapshot`;
    url.searchParams.set("ts", String(ts));

    const headers = new Headers();
    if (this.env.ACCESS_CLIENT_ID && this.env.ACCESS_CLIENT_SECRET) {
      headers.set("CF-Access-Client-Id", this.env.ACCESS_CLIENT_ID);
      headers.set("CF-Access-Client-Secret", this.env.ACCESS_CLIENT_SECRET);
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`snapshot ${camera} ${response.status}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const key = `snapshots/${camera}/${runId}.jpg`;

    await this.env.BUCKET.put(key, bytes, {
      httpMetadata: { contentType: "image/jpeg" }
    });

    return { bytes, r2Key: key };
  }
}
