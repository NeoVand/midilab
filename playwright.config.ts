import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'npm run build && npm run preview', port: 4173 },
	use: {
		trace: process.env.CI ? 'retain-on-failure' : 'off',
		screenshot: 'only-on-failure'
	},
	testMatch: '**/*.e2e.{ts,js}'
});
