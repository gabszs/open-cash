import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";

import { DATABASE } from "../d1";
import { EMAIL } from "../email";
import { CACHE, SHARED_KV } from "../kv";
import { R2 } from "../r2";
import { RATE_LIMIT } from "../rateLimit";
import { ALLOWED_ORIGINS, API_HOSTNAME, APP_NAME } from "../utils";
import { VERSION_METADATA } from "../versionMetadata";
import { AGENT, AGENT_NAME } from "./agent";

/**
 * Social login providers. Each one is opt-in: `Config.redacted` aborts the
 * deploy when the variable is missing, and pushing an empty secret instead
 * would leave a credential-shaped value in Cloudflare that Better Auth still
 * has to special-case. So a provider without both halves configured produces
 * no binding at all.
 *
 * The names stay declared in the generated Wrangler config through
 * `OPTIONAL_SECRETS` below, which is what keeps `wrangler types` emitting them
 * whether or not this machine has the credentials.
 */
const SOCIAL_PROVIDERS = ["GITHUB", "GOOGLE"] as const;

const socialSecrets = Object.fromEntries(
	SOCIAL_PROVIDERS.flatMap((provider) => {
		const names = [`${provider}_CLIENT_ID`, `${provider}_CLIENT_SECRET`] as const;
		return names.every((name) => process.env[name])
			? names.map((name) => [name, Config.redacted(name)] as const)
			: [];
	}),
);

/**
 * Secret names the Worker reads but does not require. Wrangler only warns about
 * a missing one, and listing them keeps `Env` stable across machines.
 */
export const OPTIONAL_SECRETS = SOCIAL_PROVIDERS.flatMap((provider) => [
	`${provider}_CLIENT_ID`,
	`${provider}_CLIENT_SECRET`,
]);

export const API = Cloudflare.Worker("Api", {
	name: `${APP_NAME}-api`,
	main: "./apps/server/src/index.ts",
	domain: API_HOSTNAME,
	// Disables the workers.dev production URL and the per-version preview URLs
	// in one go — Alchemy sends `previewsEnabled` only when enabling. Without
	// this the API stays reachable at a second, unprotected hostname that
	// bypasses whatever is configured on the custom domain.
	url: false,
	compatibility: {
		date: "2026-07-15",
		flags: ["nodejs_compat"],
	},
	observability: {
		enabled: true,
		traces: {
			enabled: true,
			headSamplingRate: 1,
		},
	},
	env: {
		// ── Bindings ────────────────────────────────────────────────────────────
		// Service binding to the Flue agent Worker. Declaring it here rather than
		// hand-writing the binding means the script name comes from the resource
		// itself, and Alchemy deploys the agent first.
		AGENT_SERVICE: AGENT,
		DATABASE,
		EMAIL,
		R2,
		CACHE,
		RATE_LIMIT,
		VERSION_METADATA,
		SHARED_KV,
		USER_IDENTITY: Cloudflare.DurableObject("UserIdentity", {
			className: "UserIdentityDO",
			scriptName: AGENT_NAME,
		}),

		// ── Vars ────────────────────────────────────────────────────────────────
		ENVIRONMENT: "production",
		// Read by the Hono CORS middleware, which splits on commas.
		CORS_ORIGIN: Config.string("CORS_ORIGIN").pipe(
			Config.withDefault(ALLOWED_ORIGINS.join(",")),
		),
		// The sender domain must have Email Routing enabled on the Cloudflare account.
		EMAIL_FROM_ADDRESS: Config.string("EMAIL_FROM_ADDRESS").pipe(
			Config.withDefault("noreply@open-cash.example.com"),
		),
		EMAIL_FROM_NAME: Config.string("EMAIL_FROM_NAME").pipe(Config.withDefault("open-cash")),
		AUTH_BASE_PATH: Config.string("AUTH_BASE_PATH").pipe(Config.withDefault("/v1/auth")),
		AUTH_OPEN_API_PATH: Config.string("AUTH_OPEN_API_PATH").pipe(Config.withDefault("/docs")),
		AUTH_ENABLE_DELETE_ACCOUNT: Config.boolean("AUTH_ENABLE_DELETE_ACCOUNT").pipe(
			Config.withDefault(false),
		),
		AUTH_SESSION_DURATION_SECONDS: Config.number("AUTH_SESSION_DURATION_SECONDS").pipe(
			Config.withDefault(1_209_600),
		),
		ENABLE_OPEN_API: Config.string("ENABLE_OPEN_API").pipe(Config.withDefault("true")),
		SCALAR_THEME: Config.string("SCALAR_THEME").pipe(Config.withDefault("deepSpace")),
		DEFAULT_PAGE_SIZE: Config.number("DEFAULT_PAGE_SIZE").pipe(Config.withDefault(100)),
		DEFAULT_MAX_PAGE_SIZE: Config.number("DEFAULT_MAX_PAGE_SIZE").pipe(
			Config.withDefault(1000),
		),

		// ── Secrets ─────────────────────────────────────────────────────────────
		AUTH_SECRET: Config.redacted("AUTH_SECRET"),
		// Seals each user's Pluggy client secret before it is stored in D1.
		FINANCE_ENCRYPTION_KEY: Config.redacted("FINANCE_ENCRYPTION_KEY"),
		// Present only when this environment carries the provider's credentials.
		...socialSecrets,
	},
	dev: {
		port: 8787,
	},
});

export type ApiEnv = Cloudflare.InferEnv<typeof API>;
