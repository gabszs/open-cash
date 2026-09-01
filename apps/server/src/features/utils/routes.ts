import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import type { AppContextType } from "../../types";

import { ContentTypes, status } from "../../lib/constants";
import { httpErrors } from "../../lib/errors";
import { healthSchema } from "./schemas";

const utilityRouter = new OpenAPIHono<AppContextType>().openapi(
	createRoute({
		description: "Returns the health status of the service along with the current timestamp",
		method: "get",
		path: "/health",
		responses: {
			[status.OK.code]: {
				content: {
					[ContentTypes.JSON]: {
						schema: healthSchema,
					},
				},
				description: "Service is healthy",
			},
			...httpErrors.responses("TOO_MANY_REQUESTS", "INTERNAL_SERVER_ERROR"),
		},
		summary: "Health check endpoint",
		tags: ["Utilities"],
	}),
	async (c) =>
		c.json(
			{
				status: "ok",
				...c.env.VERSION_METADATA,
			},
			200,
		),
);

export default utilityRouter;
