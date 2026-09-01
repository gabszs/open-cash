import { eq } from "drizzle-orm";

import { users } from "../../db/models/authModels";
import { protectedProcedure } from "../../lib/orpc";
import {
	profileDeviceInfoInputSchema,
	profileDeviceInfoSchema,
	profileInitialsInputSchema,
	profileInitialsSchema,
	revokeUserSessionResultSchema,
	revokeUserSessionSchema,
	updateUserProfileSchema,
	userProfileSchema,
	userSessionsSchema,
} from "./schemas";

const getProfile = protectedProcedure
	.route({
		description: "Returns the authenticated user's profile.",
		method: "GET",
		path: "/profile",
		summary: "Get profile",
		tags: ["Profile"],
	})
	.output(userProfileSchema)
	.handler(async ({ context }) => {
		const [user] = await context.db
			.select()
			.from(users)
			.where(eq(users.id, context.session.user.id))
			.limit(1);

		return user;
	});

const updateProfile = protectedProcedure
	.route({
		description: "Updates the authenticated user's display profile.",
		method: "PATCH",
		path: "/profile",
		summary: "Update profile",
		tags: ["Profile"],
	})
	.input(updateUserProfileSchema)
	.output(userProfileSchema)
	.handler(async ({ context, input }) => {
		const [updatedUser] = await context.db
			.update(users)
			.set({
				image: input.image,
				name: input.name,
				updatedAt: new Date(),
			})
			.where(eq(users.id, context.session.user.id))
			.returning();

		return updatedUser;
	});

const getInitials = protectedProcedure
	.route({
		description: "Computes initials from a profile name or email address.",
		method: "POST",
		path: "/profile/initials",
		summary: "Get profile initials",
		tags: ["Profile"],
	})
	.input(profileInitialsInputSchema)
	.output(profileInitialsSchema)
	.handler(({ input }) => {
		if (input.name) {
			return input.name
				.split(" ")
				.map((part) => part.charAt(0))
				.join("")
				.toUpperCase()
				.slice(0, 2);
		}

		return input.email.charAt(0).toUpperCase();
	});

const getDeviceInfo = protectedProcedure
	.route({
		description: "Parses a user agent into a human-readable device label.",
		method: "POST",
		path: "/profile/device-info",
		summary: "Get device info",
		tags: ["Profile"],
	})
	.input(profileDeviceInfoInputSchema)
	.output(profileDeviceInfoSchema)
	.handler(({ input }) => {
		if (!input.userAgent) {
			return "Unknown Device";
		}

		let browser = "Unknown Browser";
		let os = "Unknown OS";

		if (input.userAgent.includes("Chrome")) {
			browser = "Chrome";
		} else if (input.userAgent.includes("Firefox")) {
			browser = "Firefox";
		} else if (input.userAgent.includes("Safari")) {
			browser = "Safari";
		} else if (input.userAgent.includes("Edge")) {
			browser = "Edge";
		}

		if (input.userAgent.includes("Windows")) {
			os = "Windows";
		} else if (
			input.userAgent.includes("iPhone") ||
			input.userAgent.includes("iPad") ||
			input.userAgent.includes("iPod")
		) {
			os = "iOS";
		} else if (input.userAgent.includes("Android")) {
			os = "Android";
		} else if (input.userAgent.includes("Mac")) {
			os = "macOS";
		} else if (input.userAgent.includes("Linux")) {
			os = "Linux";
		}

		return `${browser}, ${os}`;
	});

const listSessions = protectedProcedure
	.route({
		description: "Lists active sessions for the authenticated user.",
		method: "GET",
		path: "/profile/sessions",
		summary: "List sessions",
		tags: ["Profile"],
	})
	.output(userSessionsSchema)
	.handler(async ({ context }) => {
		try {
			const sessions = await context.auth.api.listSessions({
				headers: context.headers,
			});

			return Array.isArray(sessions) ? sessions : [];
		} catch (error) {
			console.error("Error listing sessions:", error);
			return [];
		}
	});

const revokeSession = protectedProcedure
	.route({
		description: "Revokes a session by token for the authenticated user.",
		method: "POST",
		path: "/profile/sessions/revoke",
		summary: "Revoke session",
		tags: ["Profile"],
	})
	.input(revokeUserSessionSchema)
	.output(revokeUserSessionResultSchema)
	.handler(async ({ context, input }) => {
		try {
			const result = await context.auth.api.revokeSession({
				body: { token: input.token },
				headers: context.headers,
			});

			if (!result) {
				throw new Error("Failed to revoke session");
			}

			return { success: true };
		} catch (error) {
			console.error("Error revoking session:", error);
			throw new Error("Failed to revoke session", { cause: error });
		}
	});

export const profileRouter = {
	get: getProfile,
	getDeviceInfo,
	getInitials,
	listSessions,
	revokeSession,
	update: updateProfile,
};
