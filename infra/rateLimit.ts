import * as Cloudflare from "alchemy/Cloudflare";

import { APP_NAME } from "./utils";

export const RATE_LIMIT = Cloudflare.RateLimit(`${APP_NAME}-rate-limit`, {
	namespaceId: 1001,
	simple: {
		limit: 20,
		period: 10,
	},
});
