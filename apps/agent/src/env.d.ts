declare global {
	interface Env {
		R2: R2Bucket;
		Sandbox: DurableObjectNamespace;
	}

	namespace Cloudflare {
		interface Env {
			R2: R2Bucket;
			Sandbox: DurableObjectNamespace;
		}
	}
}

// Bindings, vars and secrets are normally generated into
// `worker-configuration.d.ts` by `bun run typegen` (`wrangler types`). These
// two bindings stay local to avoid rewriting unrelated runtime declarations.
export type AgentEnvironment = Env;
