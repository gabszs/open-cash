import { uuidV7Field } from "@server/common/schemas/baseSchemas";
import { providerIdSchema } from "@server/features/finance/schemas";
import z from "zod";

export const connectionCreateSchema = z.object({
	name: z.string().trim().min(1).max(120),
	clientId: z.string().trim().min(1).max(300),
	clientSecret: z.string().min(1).max(1000),
	itemIds: z.array(providerIdSchema).min(1).max(50),
});

export const connectionUpdateSchema = connectionCreateSchema
	.partial()
	.refine((value) => Object.keys(value).length > 0, "At least one field is required");

/**
 * The wire shape. `sealedClientSecret` is absent by construction, not by omission:
 * the row never reaches a response without passing through `publicConnection`.
 */
export const connectionSchema = z.object({
	id: uuidV7Field,
	name: z.string(),
	provider: z.literal("pluggy"),
	clientId: z.string(),
	itemIds: z.array(providerIdSchema),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});

export const connectionPathSchema = z.object({ connectionId: uuidV7Field });

export type ConnectionCreate = z.infer<typeof connectionCreateSchema>;
export type ConnectionUpdate = z.infer<typeof connectionUpdateSchema>;
export type Connection = z.infer<typeof connectionSchema>;
