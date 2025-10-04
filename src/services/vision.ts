import type { Env, VisionAnalysis } from '../types.js';
import { HomeAssistantClient } from '../integrations/homeassistant.js';

export class VisionAnalysisService {
	private haClient: HomeAssistantClient;

	constructor(private env: Env) {
		this.haClient = new HomeAssistantClient(env);
	}

	async analyzeImage(bytes: Uint8Array, camera: string): Promise<VisionAnalysis | null> {
		// Try HA vision first, fallback to Workers AI
		const haVision = await this.analyzeWithHAVision(bytes, camera).catch(() => null);
		if (haVision) return haVision;

		const workersAI = await this.analyzeWithWorkersAI(bytes, camera).catch(() => null);
		return workersAI;
	}

	private async analyzeWithHAVision(bytes: Uint8Array, camera: string): Promise<VisionAnalysis> {
		return this.haClient.analyzeWithVision(bytes, camera);
	}

	private async analyzeWithWorkersAI(bytes: Uint8Array, camera: string): Promise<VisionAnalysis> {
		if (!this.env.AI) {
			throw new Error('Workers AI not bound');
		}

		// model choice is up to you; this is an example multimodal model
		return this.env.AI.run('@cf/llava-hf/llava-1.5-7b', {
			prompt: `Describe notable objects; detect people, vehicles, doors. Camera=${camera}`,
			image: [...bytes],
		});
	}
}
