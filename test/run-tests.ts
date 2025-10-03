#!/usr/bin/env node

import { execSync } from 'child_process';
import { getTestConfig, logTestEnvironment } from './test-config';

const args = process.argv.slice(2);
const isLocal = args.includes('--local') || process.env.TEST_ENV === 'local';
const testType = args.find(arg => arg.startsWith('--type='))?.split('=')[1] || 'all';

// Set environment variable
process.env.TEST_ENV = isLocal ? 'local' : 'deployed';

const config = getTestConfig();
logTestEnvironment(config);

console.log(`\n🚀 Running ${testType} tests...\n`);

try {
  let command = 'vitest run';

  if (testType === 'webhook') {
    command += ' test/webhook.test.ts';
  } else if (testType === 'api') {
    command += ' test/api.test.ts';
  } else if (testType === 'all') {
    command += ' test/';
  }

  console.log(`Executing: ${command}`);
  execSync(command, { stdio: 'inherit' });

  console.log('\n✅ All tests passed!');
} catch (error) {
  console.error('\n❌ Tests failed:', error);
  process.exit(1);
}
