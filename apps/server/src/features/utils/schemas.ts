import z from "zod";

export const setupSchema = z.object({
	hasUsers: z.boolean().meta({
		description: "Whether any users exist in the system",
		example: false,
	}),
});

export const healthSchema = z.object({
	status: z.string().meta({
		description: "Health status of the service",
		example: "ok",
	}),
	timestamp: z.string().meta({
		description: "Current server timestamp in ISO 8601 format",
		example: "2024-01-01T00:00:00.000Z",
	}),
	tag: z.string().meta({
		description: "Git tag of the current build",
		example: "v1.0.0",
	}),
	id: z.uuidv4().meta({
		description: "Unique identifier for the health check request",
		example: "dcf5c4f3-267e-4f50-80eb-ccd1d3bbb7c3",
	}),
});
