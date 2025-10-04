export interface TestConfig {
	baseUrl: string;
	apiKey: string;
	environment: 'local' | 'deployed';
}

export function getTestConfig(): TestConfig {
	const isLocal = process.env.TEST_ENV === 'local';
	const apiKey = process.env.WORKER_API_KEY || '6502241638';

	if (isLocal) {
		return {
			baseUrl: 'http://localhost:8787',
			apiKey,
			environment: 'local',
		};
	} else {
		return {
			baseUrl: 'https://unifi-protect-api.hacolby.workers.dev',
			apiKey,
			environment: 'deployed',
		};
	}
}

export function logTestEnvironment(config: TestConfig): void {
	console.log(`🧪 Testing against ${config.environment.toUpperCase()} worker: ${config.baseUrl}`);
	console.log(`🔑 Using API key: ${config.apiKey.substring(0, 4)}...`);
}
