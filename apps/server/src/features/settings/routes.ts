import { protectedProcedure } from "@server/lib/orpc";

import { getUserSettings, updateUserSettings } from "./queries";
import { settingsOutputSchema, updateSettingsSchema } from "./schemas";

const getSettings = protectedProcedure
	.route({
		description: "Returns settings for the authenticated user.",
		method: "GET",
		path: "/settings",
		summary: "Get settings",
		tags: ["Settings"],
	})
	.output(settingsOutputSchema)
	.handler(async ({ context }) => await getUserSettings(context.db, context.session.user.id));

const updateSettings = protectedProcedure
	.route({
		description: "Updates settings for the authenticated user.",
		method: "PATCH",
		path: "/settings",
		summary: "Update settings",
		tags: ["Settings"],
	})
	.input(updateSettingsSchema)
	.output(settingsOutputSchema)
	.handler(
		async ({ context, input }) =>
			await updateUserSettings(context.db, context.session.user.id, input),
	);

export const settingsRouter = {
	get: getSettings,
	update: updateSettings,
};
