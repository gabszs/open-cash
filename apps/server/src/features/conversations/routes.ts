import type { AuthAppContextType } from "@server/types";
import type { Context } from "hono";

import { $, createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { decodeFilename, FilesService, isFileError, MAX_FILE_BYTES } from "@open-cash/files";
import {
	cookieAuthorizationSchema,
	uuidField,
	uuidV7Field,
} from "@server/common/schemas/baseSchemas";
import { ContentTypes, status } from "@server/lib/constants";
import { defaultValidationHook, httpErrors } from "@server/lib/errors";

import { ConversationsRepository } from "./repository";
import {
	conversationCreateSchema,
	conversationFileHeadersSchema,
	conversationFileIdField,
	conversationFileListQuerySchema,
	conversationFileListSchema,
	conversationFileSchema,
	conversationSchema,
	conversationsQuerySchema,
} from "./schemas";
import { ConversationsService } from "./service";

const conversationsService = (c: Context<AuthAppContextType>) =>
	new ConversationsService(new ConversationsRepository(c.get("db")));

/**
 * The same bucket the agent Worker publishes its results into, bound here as `R2`.
 * Both sides go through this service so the key layout and the object metadata have
 * a single owner.
 */
const filesService = (c: Context<AuthAppContextType>) => new FilesService(c.env.R2);

const fileErrorKeys = {
	file_invalid: "CONVERSATION_FILE_INVALID",
	file_not_found: "CONVERSATION_FILE_NOT_FOUND",
	file_too_large: "CONVERSATION_FILE_TOO_LARGE",
} as const;

/**
 * `@open-cash/files` knows nothing about HTTP, so its rejections are translated
 * here. Anything that is not a `FileError` keeps bubbling to the Problem Details
 * handler, where it belongs: that is a bug, not a rejected request.
 */
const asHttpError = (error: unknown): never => {
	if (isFileError(error)) {
		throw httpErrors.create(fileErrorKeys[error.code], { detail: error.message });
	}
	throw error;
};

/**
 * Proven on every file route instead of relying on the `/ai/*` middleware, which
 * does not cover `/v1`. Files are addressed by conversation prefix, so this is the
 * only thing standing between a caller and someone else's documents.
 */
const requireOwnedConversation = async (c: Context<AuthAppContextType>, conversationId: string) =>
	await conversationsService(c).requireOwned(c.get("user").id, conversationId);

const errors = () =>
	httpErrors.responses(
		"VALIDATION_FAILED",
		"UNAUTHORIZED",
		"CONVERSATION_NOT_FOUND",
		"TOO_MANY_REQUESTS",
		"INTERNAL_SERVER_ERROR",
	);
const fileErrors = () =>
	httpErrors.responses(
		"VALIDATION_FAILED",
		"CONVERSATION_FILE_INVALID",
		"UNAUTHORIZED",
		"CONVERSATION_NOT_FOUND",
		"CONVERSATION_FILE_NOT_FOUND",
		"CONVERSATION_FILE_TOO_LARGE",
		"TOO_MANY_REQUESTS",
		"INTERNAL_SERVER_ERROR",
	);

/**
 * The conversation index. Rows are immutable once created, so there is no PATCH;
 * the Flue runtime exposes no way to drop a conversation's Durable Object, so
 * there is no DELETE either. Which agent a conversation belongs to travels in
 * the payload as `feature` — the `/ai/{feature}` path segment exists only to
 * pick an agent binding, never to address this resource.
 *
 * Conversation files hang off this resource and are served straight from R2. The
 * agent Worker writes into the same bucket for what needs its container, but it
 * exposes no file routes of its own: ownership lives here, next to the database.
 */
const conversationsRouter = $(
	new OpenAPIHono<AuthAppContextType>({ defaultHook: defaultValidationHook }),
)
	.openapi(
		createRoute({
			method: "get",
			path: "/conversations/{conversationId}",
			tags: ["Conversations"],
			summary: "Get one conversation owned by the authenticated user",
			request: {
				headers: cookieAuthorizationSchema,
				params: z.object({ conversationId: uuidV7Field }),
			},
			responses: {
				[status.OK.code]: status.OK.response(conversationSchema),
				...errors(),
			},
		}),
		async (c) => {
			const { conversationId } = c.req.valid("param");
			const conversation = await requireOwnedConversation(c, conversationId);
			return c.json(conversation, 200);
		},
	)
	.openapi(
		createRoute({
			method: "get",
			path: "/conversations",
			tags: ["Conversations"],
			summary: "List the authenticated user's conversations, newest first",
			request: { headers: cookieAuthorizationSchema, query: conversationsQuerySchema },
			responses: {
				[status.OK.code]: status.OK.response(z.array(conversationSchema)),
				...errors(),
			},
		}),
		async (c) => {
			const rows = await conversationsService(c).listConversations(
				c.get("user").id,
				c.req.valid("query"),
			);
			return c.json(rows, 200);
		},
	)
	.openapi(
		createRoute({
			method: "post",
			path: "/conversations",
			tags: ["Conversations"],
			summary: "Start a conversation with an AI feature",
			request: {
				headers: cookieAuthorizationSchema,
				body: { content: { [ContentTypes.JSON]: { schema: conversationCreateSchema } } },
			},
			responses: {
				[status.CREATED.code]: status.CREATED.response(conversationSchema),
				...httpErrors.responses(
					"VALIDATION_FAILED",
					"UNAUTHORIZED",
					"FINANCE_CONNECTION_NOT_FOUND",
					"TOO_MANY_REQUESTS",
					"INTERNAL_SERVER_ERROR",
				),
			},
		}),
		async (c) => {
			const conversation = await conversationsService(c).createConversation(
				c.get("user").id,
				c.req.valid("json"),
			);
			await c.env.SHARED_KV.put(conversation.id, conversation.userId);
			return c.json(conversation, 201);
		},
	)
	.openapi(
		createRoute({
			method: "get",
			path: "/conversations/{conversationId}/files",
			tags: ["Conversations"],
			summary: "List the files stored for a conversation",
			description:
				"Scans the conversation's R2 prefix. `limit` bounds the objects scanned, not the items returned: filtering by `kind` happens after that limit, so a page can be short while more files still exist. Follow `nextCursor` until it is null.",
			request: {
				headers: cookieAuthorizationSchema,
				params: z.object({ conversationId: uuidV7Field }),
				query: conversationFileListQuerySchema,
			},
			responses: {
				[status.OK.code]: status.OK.response(conversationFileListSchema),
				...fileErrors(),
			},
		}),
		async (c) => {
			const { conversationId } = c.req.valid("param");
			await requireOwnedConversation(c, conversationId);
			try {
				const page = await filesService(c).list(conversationId, c.req.valid("query"));
				return c.json(page, 200);
			} catch (error) {
				return asHttpError(error);
			}
		},
	)
	.openapi(
		createRoute({
			method: "put",
			path: "/conversations/{conversationId}/files/{fileId}",
			tags: ["Conversations"],
			summary: "Upload a file to a conversation owned by the authenticated user",
			request: {
				headers: cookieAuthorizationSchema.extend(conversationFileHeadersSchema.shape),
				// `fileId` is minted by the browser with `crypto.randomUUID()`, which
				// returns a v4 — the only id here that must not be narrowed to v7.
				params: z.object({ conversationId: uuidV7Field, fileId: uuidField }),
				body: {
					content: {
						[ContentTypes.OCTET_STREAM]: {
							schema: z.string().openapi({ format: "binary" }),
						},
					},
					required: true,
				},
			},
			responses: {
				[status.OK.code]: status.OK.response(conversationFileSchema),
				...fileErrors(),
			},
		}),
		async (c) => {
			const { conversationId, fileId } = c.req.valid("param");
			await requireOwnedConversation(c, conversationId);
			// Advisory, but when it is present and oversized there is no reason to
			// buffer the body first. The real limit is enforced on the bytes.
			const declaredSize = Number(c.req.header("content-length"));
			if (Number.isFinite(declaredSize) && declaredSize > MAX_FILE_BYTES) {
				throw httpErrors.create("CONVERSATION_FILE_TOO_LARGE");
			}
			try {
				const file = await filesService(c).upload(conversationId, fileId, {
					bytes: await c.req.arrayBuffer(),
					contentType: c.req.header("content-type"),
					filename: decodeFilename(c.req.valid("header")["x-file-name"]),
				});
				return c.json(file, 200);
			} catch (error) {
				return asHttpError(error);
			}
		},
	)
	.openapi(
		createRoute({
			method: "get",
			path: "/conversations/{conversationId}/files/{fileId}",
			tags: ["Conversations"],
			summary: "Download one conversation file",
			request: {
				headers: cookieAuthorizationSchema,
				// Both kinds are downloadable, and only uploads carry a UUID.
				params: z.object({
					conversationId: uuidV7Field,
					fileId: conversationFileIdField,
				}),
			},
			responses: {
				[status.OK.code]: {
					content: {
						[ContentTypes.OCTET_STREAM]: {
							schema: z.string().openapi({ format: "binary" }),
						},
					},
					description: "The file contents, as an attachment.",
				},
				...fileErrors(),
			},
		}),
		async (c) => {
			const { conversationId, fileId } = c.req.valid("param");
			await requireOwnedConversation(c, conversationId);
			try {
				const { file, object } = await filesService(c).download(conversationId, fileId);
				const headers = new Headers();
				// The bucket's own content type first, then the parts that decide how a
				// browser treats the bytes: never inline, never cached, never scripted.
				object.writeHttpMetadata(headers);
				headers.set("Content-Length", String(object.size));
				headers.set("Content-Disposition", `attachment; filename="${file.filename}"`);
				headers.set("Cache-Control", "private, max-age=0, must-revalidate");
				headers.set("Content-Security-Policy", "sandbox");
				headers.set("ETag", object.httpEtag);
				return new Response(object.body, { headers, status: 200 });
			} catch (error) {
				return asHttpError(error);
			}
		},
	)
	.openapi(
		createRoute({
			method: "delete",
			path: "/conversations/{conversationId}/files/{fileId}",
			tags: ["Conversations"],
			summary: "Delete one conversation file",
			request: {
				headers: cookieAuthorizationSchema,
				params: z.object({
					conversationId: uuidV7Field,
					fileId: conversationFileIdField,
				}),
			},
			responses: {
				[status.NO_CONTENT.code]: status.NO_CONTENT.response(),
				...fileErrors(),
			},
		}),
		async (c) => {
			const { conversationId, fileId } = c.req.valid("param");
			await requireOwnedConversation(c, conversationId);
			try {
				await filesService(c).delete(conversationId, fileId);
				return c.body(null, 204);
			} catch (error) {
				return asHttpError(error);
			}
		},
	);

export default conversationsRouter;
