import z from "zod";

export const userProfileSchema = z.object({
	banExpires: z.date().nullable(),
	banReason: z.string().nullable(),
	banned: z.boolean().nullable(),
	createdAt: z.date(),
	email: z.string(),
	emailVerified: z.boolean(),
	id: z.string(),
	image: z.string().nullable(),
	name: z.string(),
	role: z.string().nullable(),
	twoFactorEnabled: z.boolean().nullable(),
	updatedAt: z.date(),
});

export const updateUserProfileSchema = z.object({
	image: z.string().optional(),
	name: z.string().min(1),
});

export const profileInitialsInputSchema = z.object({
	email: z.string(),
	name: z.string().nullable(),
});

export const profileInitialsSchema = z.string();

export const profileDeviceInfoInputSchema = z.object({
	userAgent: z.string().nullable(),
});

export const profileDeviceInfoSchema = z.string();

export const userSessionsSchema = z.array(z.record(z.string(), z.unknown()));

export const revokeUserSessionSchema = z.object({
	token: z.string(),
});

export const revokeUserSessionResultSchema = z.object({
	success: z.literal(true),
});
