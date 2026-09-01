export const APP_NAME = "open-cash";

/**
 * Public hostnames served by the stack. Set these in the local `.env` before
 * deploying, or replace the example defaults with domains managed in your
 * Cloudflare account.
 *
 * The agent Worker is intentionally absent: it is reachable only through the
 * API's `AGENT_SERVICE` binding, never over the public internet.
 */
export const WEB_HOSTNAME = process.env.OPEN_CASH_WEB_HOSTNAME ?? "open-cash.example.com";
export const API_HOSTNAME = process.env.OPEN_CASH_API_HOSTNAME ?? "api.open-cash.example.com";

export const WEB_URL = `https://${WEB_HOSTNAME}`;
export const API_URL = `https://${API_HOSTNAME}`;

/**
 * Origins the API accepts cross-origin requests from, and the same list R2
 * signs its CORS policy with. The dev server ports are included so a local
 * `bun run dev` talks to the deployed API without a second configuration.
 */
export const ALLOWED_ORIGINS = [WEB_URL, "http://localhost:5055", "http://localhost:3000"];
