import type { Env } from '../types.js';

export class NotificationService {
	constructor(private env: Env) {}

	async sendNtfy(text: string): Promise<void> {
		if (!this.env.NTFY_TOPIC_URL) return;
		await fetch(this.env.NTFY_TOPIC_URL, { method: 'POST', body: text });
	}
}
