import type { Env, HAStates, HAState } from '../types.js';

export class HomeAssistantClient {
	constructor(private env: Env) {}

	async getStates(entityIds: string[]): Promise<HAStates> {
		const out: HAStates = {};
		for (const id of entityIds) {
			out[id] = await this.get(`/api/states/${encodeURIComponent(id)}`).catch(() => null);
		}
		return out;
	}

	async setInputBooleans(map: Record<string, boolean>): Promise<void> {
		for (const [entityId, value] of Object.entries(map)) {
			const service = value ? 'turn_on' : 'turn_off';
			await this.post(`/api/services/input_boolean/${service}`, { entity_id: entityId });
		}
	}

	async analyzeWithVision(bytes: Uint8Array, camera: string): Promise<any> {
		if (!this.env.HA_BASE_URL || !this.env.HA_VISION_SERVICE) {
			throw new Error('HA vision not configured');
		}

		const [domain, service] = this.env.HA_VISION_SERVICE.split('/');
		const b64 = btoa(String.fromCharCode(...bytes));
		const payload = {
			// adjust to your service's expected schema
			image: `data:image/jpeg;base64,${b64}`,
			prompt: `Summarize notable objects; detect people/vehicles/doors. Camera=${camera}`,
		};
		return this.post(`/api/services/${domain}/${service}`, payload);
	}

	private async get(path: string): Promise<any> {
		const url = new URL((this.env.HA_BASE_URL || '').replace(/\/+$/, '') + path);
		const headers = new Headers({ Accept: 'application/json' });
		if (this.env.HA_TOKEN) {
			headers.set('Authorization', `Bearer ${this.env.HA_TOKEN}`);
		}
		const response = await fetch(url, { headers });
		if (!response.ok) {
			throw new Error(`HA GET ${path} ${response.status}`);
		}
		return response.json();
	}

	private async post(path: string, jsonBody: any): Promise<any> {
		const url = new URL((this.env.HA_BASE_URL || '').replace(/\/+$/, '') + path);
		const headers = new Headers({ 'Content-Type': 'application/json' });
		if (this.env.HA_TOKEN) {
			headers.set('Authorization', `Bearer ${this.env.HA_TOKEN}`);
		}
		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(jsonBody || {}),
		});
		if (!response.ok) {
			throw new Error(`HA POST ${path} ${response.status}`);
		}
		return response.json().catch(() => ({}));
	}
}

export function onOff(haStateObj: HAState | null): string {
	if (!haStateObj) return 'unknown';
	const s = (haStateObj.state || '').toLowerCase();
	return s;
}
