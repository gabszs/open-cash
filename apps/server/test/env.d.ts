import "cloudflare:workers";
import type { D1Migration } from "@cloudflare/vitest-pool-workers";

declare global {
	namespace Cloudflare {
		interface Env {
			R2_ACCESS_KEY_ID: string;
			R2_S3_ENDPOINT: string;
			R2_SECRET_ACCESS_KEY: string;
			TEST_MIGRATIONS: D1Migration[];
		}
	}
}

declare module "cloudflare:workers" {
	// oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- Cloudflare exposes binding types through interface augmentation.
	interface ProvidedEnv extends Env {}
}

declare module "vitest" {
	export interface ProvidedContext {
		s3AccessKeyId: string;
		s3Endpoint: string;
		s3SecretAccessKey: string;
	}
}
