import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

process.env.AUTH_SECRET ??= "integration-test-secret-at-least-32-characters";
process.env.FINANCE_ENCRYPTION_KEY ??= "integration-test-finance-encryption-key";
process.env.R2_ACCESS_KEY_ID ??= "integration-test-access-key";
process.env.R2_S3_ENDPOINT ??= "http://127.0.0.1/placeholder-bucket";
process.env.R2_SECRET_ACCESS_KEY ??= "integration-test-secret-key";

export default defineConfig({
	plugins: [
		cloudflareTest(async ({ inject }) => ({
			additionalExports: { TestUserIdentityDO: "DurableObject" },
			main: "./test/worker.ts",
			miniflare: {
				bindings: {
					AUTH_SECRET: "integration-test-secret-at-least-32-characters",
					CORS_ORIGIN: "http://localhost",
					ENVIRONMENT: "test",
					FINANCE_ENCRYPTION_KEY: "integration-test-finance-encryption-key",
					R2_ACCESS_KEY_ID: inject("s3AccessKeyId"),
					R2_S3_ENDPOINT: inject("s3Endpoint"),
					R2_SECRET_ACCESS_KEY: inject("s3SecretAccessKey"),
					TEST_MIGRATIONS: await readD1Migrations(
						fileURLToPath(new URL("../src/db/migrations", import.meta.url)),
					),
					VITE_WEB_URL: "http://localhost",
				},
				durableObjects: { USER_IDENTITY: "TestUserIdentityDO" },
				d1Databases: ["DATABASE"],
				// Production throttles at 20 requests / 10s keyed on client IP. Tests all
				// share one (empty) IP, so a file with enough assertions started failing
				// with 429 instead of its assertion. Nothing here asserts throttling.
				ratelimits: {
					RATE_LIMIT: { namespace_id: "1001", simple: { limit: 100_000, period: 60 } },
				},
				// The proxy is never exercised end to end here: a non-routable binding is
				// enough for the Server worker to boot, and the ownership gate answers 404
				// before anything would be forwarded.
				serviceBindings: { AGENT_SERVICE: { network: { allow: [] } } },
			},
			wrangler: { configPath: "./wrangler.jsonc" },
		})),
	],
	resolve: {
		alias: {
			"@server": fileURLToPath(new URL("../src", import.meta.url)),
		},
	},
	test: {
		exclude: ["test/src/features/properties/**"],
		fileParallelism: true,
		globalSetup: ["./test/global-setup.ts"],
		hookTimeout: 180_000,
		include: ["test/src/**/*.integration.ts"],
		restoreMocks: true,
		setupFiles: ["./test/applyMigrations.ts"],
		testTimeout: 30_000,
	},
});
