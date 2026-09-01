import * as Cloudflare from "alchemy/Cloudflare";

import { API_URL, APP_NAME, WEB_HOSTNAME } from "../utils";

/**
 * The React SPA, deployed as a Worker serving static assets.
 *
 * `Website.Vite` runs `vite build` itself (no separate `Command.Build`) and
 * uploads the client output. There is no server bundle: every route falls back
 * to `index.html` so TanStack Router handles it on the client.
 */
export const WEB = Cloudflare.Website.Vite("Web", {
	name: `${APP_NAME}-web`,
	rootDir: "apps/web",
	domain: WEB_HOSTNAME,
	// Disables the workers.dev production URL and the per-version preview URLs.
	url: false,
	assets: {
		htmlHandling: "auto-trailing-slash",
		notFoundHandling: "single-page-application",
	},
	observability: {
		enabled: true,
	},
	env: {
		// Inlined into the bundle at build time as `import.meta.env.VITE_SERVER_URL`
		// — only `VITE_`-prefixed keys are, mirroring `vite build` semantics.
		VITE_SERVER_URL: API_URL,
	},
});
