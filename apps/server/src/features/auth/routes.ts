import type { AppContextType } from "@server/types";

import { OpenAPIHono } from "@hono/zod-openapi";

const authRouter = new OpenAPIHono<AppContextType>({
	strict: false,
}).on(["POST", "GET"], "/auth/*", async (c) => c.get("auth").handler(c.req.raw));

export default authRouter;
