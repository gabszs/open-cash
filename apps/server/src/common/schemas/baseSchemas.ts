import { env } from "cloudflare:workers";
import { z } from "zod";

import { uuidField, uuidV7Field } from "./primitives";

// Re-exported so features have one import for the whole contract surface. The
// only exception is `finance/schemas.ts`, which reaches for `./primitives`
// directly: this module reads `env` at load and cannot be imported under `bun test`.
export { uuidField, uuidV7Field } from "./primitives";

export const searchOptionsSchema = z.object({
	created_after: z.iso
		.datetime()
		.optional()
		.meta({ description: "Filter by creation date after (ISO 8601)" }),
	created_before: z.iso
		.datetime()
		.optional()
		.meta({ description: "Filter by creation date before (ISO 8601)" }),
	created_on_or_after: z.iso
		.datetime()
		.optional()
		.meta({ description: "Filter by creation date on or after (ISO 8601)" }),
	created_on_or_before: z.iso
		.datetime()
		.optional()
		.meta({ description: "Filter by creation date on or before (ISO 8601)" }),
	ordering: z
		.enum(["created_at", "-created_at", "updated_at", "-updated_at"])
		.default("-created_at")
		.meta({ description: "Ordering field" }),
	page: z.coerce
		.number<string | number>()
		.int()
		.positive()
		.optional()
		.default(1)
		.meta({ description: "Page number" }),
	page_size: z
		.union([
			z.coerce
				.number<string | number>()
				.int()
				.positive()
				.max(env.DEFAULT_MAX_PAGE_SIZE, {
					message: `Page must be <= ${env.DEFAULT_MAX_PAGE_SIZE}`,
				}),
			z.literal("all"),
		])
		.optional()
		.default(env.DEFAULT_PAGE_SIZE)
		.meta({
			description: 'Number of items per page (integer or "all" to return all records)',
		}),
});

export type searchOptionsSchemaType = z.infer<typeof searchOptionsSchema>;

const errorItemSchema = z.object({
	code: z.string().meta({ description: "Error code" }),
	expected: z.string().meta({ description: "Expected type" }),
	message: z.string().meta({ description: "Error message" }),
	path: z.array(z.string().meta({ description: "Path to the field" })),
	received: z.string().meta({ description: "Received type" }),
});

export const zodValidationErrorSchema = z.object({
	errors: z.array(errorItemSchema),
	result: z.object({}).default({}),
});

export const pixelActivationSchema = z.object({
	id: z.string().meta({ description: "Unique identifier for the pixel activation" }),
	status: z.string().meta({ description: "Status of the pixel activation" }),
});

export const uuidIdSchema = z.object({ id: uuidField });

// The v4 example the v7 variant used to carry could never pass its own schema.
export const uuidIdV7Schema = z.object({ id: uuidV7Field });

export const intIdSchema = z.object({
	id: z.coerce
		.number()
		.int()
		.positive()
		.meta({
			param: {
				in: "path",
				name: "id",
			},
			description: "Numeric property identifier",
			example: 1,
		}),
});

export const authorizationHeaderSchema = z.object({
	authorization: z
		.string()
		.refine((val) => val.toLowerCase().startsWith("bearer "), {
			message: "Authorization header must start with 'Bearer '",
		})
		.meta({
			default: "Bearer your_token",
			description:
				"Bearer token for authorization. Must start with 'Bearer ' followed by the JWT token.",
			externalDocs: {
				description: "Learn more about JWT (JSON Web Tokens)",
				url: "https://jwt.io/introduction",
			},
			format: "bearer",
		}),
});

export const optionalAuthorizationHeaderSchema = z.object({
	authorization: z
		.string()
		.refine((val) => !val || val.toLowerCase().startsWith("bearer "), {
			message: "Authorization header must start with 'Bearer '",
		})
		.meta({ description: "Bearer token for authorization" })
		.optional()
		.nullable(),
});

export const cookieAuthorizationSchema = optionalAuthorizationHeaderSchema.extend({
	cookie: z.string().optional().nullable().meta({
		description:
			"Optional cookie for authentication. Can be used as an alternative to the Authorization header.",
		example: "session=your_session_cookie",
		format: "cookie",
	}),
});

export const shortUuidSchema = z.object({
	id: z.string().regex(/^[a-zA-Z0-9]{6,32}$/u, "Invalid ID"),
});

export const fileUploadSchema = z.object({
	file: z.any().meta({
		description: "File to upload",
		format: "binary",
		type: "string",
	}),
});

export const fileUploadSuccessSchema = z
	.object({
		data: z.object({
			file_key: z.string().meta({
				description: "Key of the uploaded file",
				example: "uploads/550e8400-e29b-41d4-a716-446655440000",
			}),
		}),
		message: z.string().meta({
			description: "Success message",
			example: "File uploaded successfully",
		}),
		metadata: z.null(),
	})
	.meta({ id: "DocumentSuccess" });
