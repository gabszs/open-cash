import type { JSONParsed } from "hono/utils/types";

import { searchOptionsSchema, uuidV7Field } from "@server/common/schemas/baseSchemas";
import { AI_FEATURES } from "@server/db/models/conversations";
import z from "zod";

export const featureSchema = z.enum(AI_FEATURES);

/**
 * A file id, in either shape the storage layer mints: a UUID for uploads (the
 * browser generates it) and a 64-char hex digest for agent output, where the id
 * is derived from the bytes so republishing overwrites instead of duplicating.
 * Narrowing this to a UUID rejects every published file.
 */
export const conversationFileIdField = z
	.union([z.uuid(), z.string().regex(/^[a-f0-9]{64}$/u)])
	.meta({
		description:
			"Conversation file identifier: a UUID for uploads, or a 64-character hex digest for files published by the agent.",
		example: "550e8400-e29b-41d4-a716-446655440000",
	});

export const conversationFileHeadersSchema = z.object({
	"content-type": z.string().min(1),
	"x-file-name": z.string().min(1),
});

export const conversationsQuerySchema = searchOptionsSchema.extend({
	feature: featureSchema.optional(),
});

export const conversationCreateSchema = z.object({
	// Required: the connection is pinned here at creation and never re-read, so a
	// conversation must never start without one.
	connectionId: uuidV7Field,
	feature: featureSchema,
	title: z.string().trim().min(1).max(120),
});

export const conversationSchema = z.object({
	// Nullable on the way out, not on the way in: deleting the connection clears
	// this and keeps the conversation rather than destroying the history.
	connectionId: uuidV7Field.nullable(),
	createdAt: z.date(),
	feature: featureSchema,
	id: uuidV7Field,
	title: z.string(),
	updatedAt: z.date(),
	userId: uuidV7Field,
});

export const conversationFileKindSchema = z.enum(["upload", "output"]);

/**
 * Everything a stored file exposes except its kind. `downloadPath` is an API route
 * because the API owns the file surface — the agent writes into the same bucket but
 * never serves from it.
 */
const conversationFileBaseSchema = z.object({
	downloadPath: z.string().startsWith("/v1/conversations/"),
	fileId: z.string(),
	filename: z.string(),
	mimeType: z.string(),
	sha256: z.string().regex(/^[a-f0-9]{64}$/u),
	size: z.number().int().positive(),
	uploadedAt: z.iso.datetime(),
});

/** What an upload answers with, so the browser never has to widen the kind. */
export const conversationFileSchema = conversationFileBaseSchema.extend({
	kind: z.literal("upload"),
});

export const conversationOutputFileSchema = conversationFileBaseSchema.extend({
	kind: z.literal("output"),
});

/** A listing mixes both kinds, so the discriminant widens instead of branching. */
export const conversationStoredFileSchema = conversationFileBaseSchema.extend({
	kind: conversationFileKindSchema,
});

export const conversationFileListSchema = z.object({
	items: z.array(conversationStoredFileSchema),
	nextCursor: z.string().nullable(),
});

export const conversationFileListQuerySchema = z.object({
	cursor: z.string().min(1).max(1024).optional(),
	kind: conversationFileKindSchema.optional(),
	limit: z.coerce.number<string | number>().int().min(1).max(100).optional(),
});

export type ConversationFeature = z.infer<typeof featureSchema>;
export type ConversationsQuery = z.input<typeof conversationsQuerySchema>;
/** The parsed query — what the service receives, defaults already applied. */
export type ConversationsListInput = z.infer<typeof conversationsQuerySchema>;
export type ConversationCreateInput = z.infer<typeof conversationCreateSchema>;
export type Conversation = JSONParsed<z.infer<typeof conversationSchema>>;
export type ConversationFile = z.infer<typeof conversationFileSchema>;
export type ConversationOutputFile = z.infer<typeof conversationOutputFileSchema>;
export type ConversationStoredFile = z.infer<typeof conversationStoredFileSchema>;
export type ConversationFileListQuery = z.input<typeof conversationFileListQuerySchema>;
