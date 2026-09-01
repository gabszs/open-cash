import { uuidV7Field } from "@server/common/schemas/baseSchemas";
import { models } from "@server/db/models";
import { createSelectSchema } from "drizzle-zod";
import z from "zod";

export const userSettingsSchema = createSelectSchema(models.userSettings);

export const updateSettingsSchema = userSettingsSchema
	.pick({
		theme: true,
		connectionId: true,
	})
	.partial()
	// `createSelectSchema` only knows the column is `text | null`, so it would accept
	// any string. The uuid shape has to be asserted here or a junk id reaches the FK.
	.extend({ connectionId: uuidV7Field.nullable().optional() });

export const settingsOutputSchema = z.object({
	theme: z.string(),
	connectionId: uuidV7Field.nullable(),
});

export type UserSettingsType = z.infer<typeof userSettingsSchema>;
