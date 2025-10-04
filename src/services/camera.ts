import type { Env, SnapshotResult, ProtectCamera } from '../types.js';

export class CameraService {
	constructor(private env: Env) {}

	/**
	 * Get list of cameras from UniFi Protect API
	 * This replaces the static CAMERA_IDS approach with dynamic discovery
	 */
	async getCameraList(): Promise<string[]> {
		try {
			const protectApi = new URL(this.env.PROTECT_API);
			protectApi.pathname = '/protect/cameras';

			const response = await fetch(protectApi.toString(), {
				headers: {
					'x-api-key': this.env.PROTECT_API_KEY,
				},
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch cameras: ${response.status}`);
			}

			const data = (await response.json()) as { cameras?: ProtectCamera[] };
			const cameras: ProtectCamera[] = data.cameras || [];

			// Return only online cameras
			return cameras.filter((camera) => camera.state === 'CONNECTED').map((camera) => camera.id);
		} catch (error) {
			console.error('Failed to fetch camera list from UniFi Protect:', error);

			// Return empty array if API fails - no fallback needed
			return [];
		}
	}

	/**
	 * Get selected cameras for security sweep
	 * If focusCamera is specified, only return that camera (if it exists)
	 * Otherwise, return all online cameras
	 */
	async getSelectedCameras(focusCamera?: string | null): Promise<string[]> {
		const cameras = await this.getCameraList();
		return focusCamera ? cameras.filter((c) => c === focusCamera) : cameras;
	}

	async fetchAndStoreSnapshot(camera: string, runId: string, ts: number): Promise<SnapshotResult> {
		// Your Protect API should expose something like: GET /cameras/:id/snapshot
		const url = new URL(this.env.PROTECT_API);
		url.pathname = `/cameras/${encodeURIComponent(camera)}/snapshot`;
		url.searchParams.set('ts', String(ts));

		const headers = new Headers();
		if (this.env.ACCESS_CLIENT_ID && this.env.ACCESS_CLIENT_SECRET) {
			headers.set('CF-Access-Client-Id', this.env.ACCESS_CLIENT_ID);
			headers.set('CF-Access-Client-Secret', this.env.ACCESS_CLIENT_SECRET);
		}

		const response = await fetch(url, { headers });
		if (!response.ok) {
			throw new Error(`snapshot ${camera} ${response.status}`);
		}

		const bytes = new Uint8Array(await response.arrayBuffer());
		const key = `snapshots/${camera}/${runId}.jpg`;

		await this.env.BUCKET.put(key, bytes, {
			httpMetadata: { contentType: 'image/jpeg' },
		});

		return { bytes, r2Key: key };
	}
}
