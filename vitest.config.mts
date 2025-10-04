import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		pool: '@cloudflare/vitest-pool-workers',
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.toml' },
			},
		},
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: ['node_modules/', 'test/', '**/*.d.ts', '**/*.config.*', '**/migrations/**', '**/public/**'],
		},
		reporters: ['verbose', 'json'],
		outputFile: {
			json: './test-results.json',
			verbose: './test-results.txt',
		},
		globals: true,
		setupFiles: ['./test/setup.ts'],
		testTimeout: 10000,
		hookTimeout: 10000,
	},
	resolve: {
		alias: {
			'@': '/Volumes/Projects/workers/unifi-protect-api/src',
		},
	},
});
