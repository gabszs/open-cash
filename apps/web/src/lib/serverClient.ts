import { hc } from "hono/client";

import type { AppType } from "../../../server/src";

import { serverUrl } from "./const";

export const serverClient = hc<AppType>(serverUrl, {
	init: { credentials: "include" },
});
