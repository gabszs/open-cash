import * as Cloudflare from "alchemy/Cloudflare";

import { ALLOWED_ORIGINS, APP_NAME } from "./utils";

export const R2 = Cloudflare.R2.Bucket(`${APP_NAME}-bucket`, {
	name: `${APP_NAME}-bucket`,
	cors: [
		{
			allowedMethods: ["PUT"],
			// Same list the API allows on the Hono CORS middleware — presigned
			// uploads go straight from the browser to the bucket, so the bucket has
			// to trust the web origin on its own.
			allowedOrigins: ALLOWED_ORIGINS,
			allowedHeaders: ["Content-Type"],
			exposeHeaders: ["ETag"],
			maxAgeSeconds: 3600,
		},
	],
});
