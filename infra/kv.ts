import * as Cloudflare from "alchemy/Cloudflare";

import { APP_NAME } from "./utils";

export const CACHE = Cloudflare.KV.Namespace(`${APP_NAME}-cache`, {
	title: `${APP_NAME}-cache`,
});

/** Conversation identity bridge shared by the API and Agent Workers. */
export const SHARED_KV = Cloudflare.KV.Namespace(`${APP_NAME}-shared`, {
	title: `${APP_NAME}-shared`,
});
