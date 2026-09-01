import { seal, unseal } from "@server/lib/secrets";

/**
 * Shared store for the short-lived Pluggy API key.
 *
 * `PluggyClient` only ever holds the token for the lifetime of one request, so without a
 * store every request pays the slow `POST /auth` round trip. The interface keeps the client
 * free of Cloudflare types and lets tests drive it with a plain map.
 */
export interface PluggyTokenCache {
	get(key: string): Promise<string | null>;
	set(key: string, value: string, ttlSeconds: number): Promise<void>;
	delete(key: string): Promise<void>;
}

const KEY_PREFIX = "pluggy:apikey:";
const KEY_LENGTH = 32;
/** Renew before the provider actually expires the token so in-flight requests never race it. */
const EXPIRY_SKEW_SECONDS = 300;
const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 7200;
/** Used when the token is not a JWT we can read an `exp` from. */
const FALLBACK_TTL_SECONDS = 5400;

const encoder = new TextEncoder();

export interface PluggyTokenCacheScope {
	userId: string;
	connectionId: string;
}

/**
 * Namespaces the entry by the local owner and connection. Credentials never become part of
 * the KV key; rotating them explicitly evicts this stable entry before verification.
 */
export async function tokenCacheKey(scope: PluggyTokenCacheScope) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		encoder.encode(JSON.stringify([scope.userId, scope.connectionId])),
	);
	const hex = [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
	return `${KEY_PREFIX}${hex.slice(0, KEY_LENGTH)}`;
}

const decodeJwtExpiry = (token: string) => {
	const [, payload] = token.split(".");
	if (!payload) return null;
	const padded = payload
		.replaceAll("-", "+")
		.replaceAll("_", "/")
		.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
	const claims: unknown = JSON.parse(atob(padded));
	if (typeof claims !== "object" || claims === null) return null;
	const { exp } = claims as { exp?: unknown };
	return typeof exp === "number" && Number.isFinite(exp) ? exp : null;
};

/** Derives the cache lifetime from the token's own `exp` rather than a hardcoded provider policy. */
export function tokenTtlSeconds(token: string, nowSeconds = Math.floor(Date.now() / 1000)) {
	let expiry: number | null = null;
	try {
		expiry = decodeJwtExpiry(token);
	} catch {
		expiry = null;
	}
	if (expiry === null) return FALLBACK_TTL_SECONDS;
	const remaining = expiry - nowSeconds - EXPIRY_SKEW_SECONDS;
	return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.floor(remaining)));
}

/**
 * KV-backed store that seals the token at rest — `CACHE` is shared with the auth session
 * storage, and the API key is a bearer credential for the user's financial data.
 *
 * Failures are left to propagate: `PluggyClient` treats any cache error as a miss and falls
 * back to `POST /auth`, so a KV outage or a rotated `FINANCE_ENCRYPTION_KEY` costs a round
 * trip rather than a failed request.
 */
export function kvTokenCache(kv: KVNamespace, encryptionKey: string): PluggyTokenCache {
	return {
		async get(key) {
			const sealed = await kv.get(key);
			return sealed === null ? null : await unseal(sealed, encryptionKey);
		},
		async set(key, value, ttlSeconds) {
			await kv.put(key, await seal(value, encryptionKey), { expirationTtl: ttlSeconds });
		},
		async delete(key) {
			await kv.delete(key);
		},
	};
}
