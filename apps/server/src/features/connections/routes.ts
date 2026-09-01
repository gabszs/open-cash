import type { AuthAppContextType } from "@server/types";
import type { Context } from "hono";

import { $, createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { cookieAuthorizationSchema, searchOptionsSchema } from "@server/common/schemas/baseSchemas";
import { kvTokenCache } from "@server/features/finance/pluggy/tokenCache";
import { ContentTypes, status } from "@server/lib/constants";
import { defaultValidationHook, httpErrors } from "@server/lib/errors";

import { ConnectionsRepository } from "./repository";
import {
	connectionCreateSchema,
	connectionPathSchema,
	connectionSchema,
	connectionUpdateSchema,
} from "./schemas";
import { ConnectionsService } from "./service";

/**
 * Built per request, like every other feature. No connection scope is resolved
 * here on purpose: managing connections has to reach every connection the user
 * owns, or a bad selection could never be edited away.
 */
const connectionsService = (c: Context<AuthAppContextType>) =>
	new ConnectionsService(
		new ConnectionsRepository(c.get("db")),
		c.env.FINANCE_ENCRYPTION_KEY,
		c.env.CACHE ? kvTokenCache(c.env.CACHE, c.env.FINANCE_ENCRYPTION_KEY) : undefined,
	);

const errors = () =>
	httpErrors.responses(
		"VALIDATION_FAILED",
		"UNAUTHORIZED",
		"FINANCE_CONNECTION_NOT_FOUND",
		"PLUGGY_UNAVAILABLE",
		"TOO_MANY_REQUESTS",
		"INTERNAL_SERVER_ERROR",
	);

/**
 * Open Finance credentials, one row per bank the user has linked. Everything the
 * rest of the API reads is selected through one of these, so they are managed on
 * their own resource rather than under the data they unlock.
 */
const connectionsRouter = $(
	new OpenAPIHono<AuthAppContextType>({ defaultHook: defaultValidationHook }),
)
	.openapi(
		createRoute({
			method: "get",
			path: "/connections",
			tags: ["Connections"],
			summary: "List the authenticated user's Open Finance connections",
			request: { headers: cookieAuthorizationSchema, query: searchOptionsSchema },
			responses: {
				[status.OK.code]: status.OK.response(z.array(connectionSchema)),
				...errors(),
			},
		}),
		async (c) =>
			c.json(
				await connectionsService(c).listConnections(c.get("user").id, c.req.valid("query")),
				200,
			),
	)
	.openapi(
		createRoute({
			method: "post",
			path: "/connections",
			tags: ["Connections"],
			summary: "Create a validated Pluggy connection",
			request: {
				headers: cookieAuthorizationSchema,
				body: { content: { [ContentTypes.JSON]: { schema: connectionCreateSchema } } },
			},
			responses: {
				[status.CREATED.code]: status.CREATED.response(connectionSchema),
				...errors(),
			},
		}),
		async (c) =>
			c.json(
				await connectionsService(c).createConnection(c.get("user").id, c.req.valid("json")),
				201,
			),
	)
	.openapi(
		createRoute({
			method: "get",
			path: "/connections/{connectionId}",
			tags: ["Connections"],
			summary: "Get one connection",
			request: { headers: cookieAuthorizationSchema, params: connectionPathSchema },
			responses: {
				[status.OK.code]: status.OK.response(connectionSchema),
				...errors(),
			},
		}),
		async (c) =>
			c.json(
				await connectionsService(c).getConnection(
					c.req.valid("param").connectionId,
					c.get("user").id,
				),
				200,
			),
	)
	.openapi(
		createRoute({
			method: "patch",
			path: "/connections/{connectionId}",
			tags: ["Connections"],
			summary: "Update and revalidate a connection",
			request: {
				headers: cookieAuthorizationSchema,
				params: connectionPathSchema,
				body: { content: { [ContentTypes.JSON]: { schema: connectionUpdateSchema } } },
			},
			responses: {
				[status.OK.code]: status.OK.response(connectionSchema),
				...errors(),
			},
		}),
		async (c) =>
			c.json(
				await connectionsService(c).updateConnection(
					c.req.valid("param").connectionId,
					c.get("user").id,
					c.req.valid("json"),
				),
				200,
			),
	)
	.openapi(
		createRoute({
			method: "delete",
			path: "/connections/{connectionId}",
			tags: ["Connections"],
			summary: "Delete a connection",
			request: { headers: cookieAuthorizationSchema, params: connectionPathSchema },
			responses: { [status.NO_CONTENT.code]: status.NO_CONTENT.response(), ...errors() },
		}),
		async (c) => {
			await connectionsService(c).deleteConnection(
				c.req.valid("param").connectionId,
				c.get("user").id,
			);
			return c.body(null, 204);
		},
	);

export default connectionsRouter;
