import type { ProblemDetailsError, ProblemDetailsInput } from "hono-problem-details";
import type { ZodError } from "zod";

import { createProblemTypeRegistry } from "hono-problem-details";
import { createProblemDetailsSchema, problemDetailsResponse } from "hono-problem-details/openapi";
import z from "zod";

interface NativeProblemTypeDefinition {
	type: string;
	status: number;
	title: string;
	code?: string;
}
type HttpErrorDefinition = NativeProblemTypeDefinition & {
	detail?: string;
	extensionsSchema?: z.ZodObject;
};

type ErrorKeys<K extends string> = Readonly<{ [P in K]: P }>;
interface CreateOptions {
	detail?: string;
	instance?: string;
	extensions?: Record<string, unknown>;
}
interface HttpErrorRegistry<K extends string> {
	create(key: K, options?: CreateOptions): ProblemDetailsError;
	get(key: K): NativeProblemTypeDefinition;
	types(): K[];
	keys: ErrorKeys<K>;
	fromMessage(message: string): ProblemDetailsInput | undefined;
	schema(key: K): z.ZodObject;
	response(
		keyOrKeys: K | readonly [K, ...K[]],
		description?: string,
	): ReturnType<typeof problemDetailsResponse>;
	responses(...keys: K[]): Record<number, ReturnType<typeof problemDetailsResponse>>;
}

const phraseForStatus = (status: number) => new Response(null, { status }).statusText;

export const createHttpErrorRegistry = <
	const Definitions extends Record<string, HttpErrorDefinition>,
>(
	definitions: Definitions,
): HttpErrorRegistry<Extract<keyof Definitions, string>> => {
	type Key = Extract<keyof Definitions, string>;
	const native = createProblemTypeRegistry(
		Object.fromEntries(
			Object.entries(definitions).map(
				([key, { detail: _, extensionsSchema: __, ...definition }]) => [key, definition],
			),
		) as Record<Key, NativeProblemTypeDefinition>,
		{ autoCode: true },
	);
	const keys = Object.freeze(
		Object.fromEntries(Object.keys(definitions).map((key) => [key, key])) as ErrorKeys<Key>,
	);

	const schema = (key: Key) => {
		const definition = definitions[key];
		const resolved = native.get(key);
		const extensions = definition.extensionsSchema?.shape ?? {};
		return createProblemDetailsSchema(z.object(extensions)).extend({
			type: z.literal(resolved.type),
			status: z.literal(resolved.status),
			title: z.literal(resolved.title),
			detail: z.string().optional(),
			instance: z.string(),
			code: z.literal(resolved.code),
		});
	};

	const response = (keyOrKeys: Key | readonly [Key, ...Key[]], description?: string) => {
		const requested = typeof keyOrKeys === "string" ? [keyOrKeys] : keyOrKeys;
		const unique = [...new Set(requested)];
		const [firstKey, ...remainingKeys] = unique;
		if (firstKey === undefined) {
			throw new Error("At least one Problem Details key is required");
		}
		const statuses = [...new Set(unique.map((key) => native.get(key).status))];
		const [responseStatus] = statuses;
		if (responseStatus === undefined || statuses.length !== 1) {
			throw new Error("All Problem Details response keys must use the same HTTP status");
		}
		const responseSchema =
			remainingKeys.length === 0
				? schema(firstKey)
				: z.union([schema(firstKey), ...remainingKeys.map(schema)]);
		return problemDetailsResponse(
			responseStatus,
			description ??
				(remainingKeys.length === 0
					? native.get(firstKey).title
					: phraseForStatus(responseStatus)),
			responseSchema,
		);
	};

	return {
		create: (key: Key, options: CreateOptions = {}) =>
			native.create(key, {
				...options,
				detail: options.detail ?? definitions[key].detail,
			}),
		get: native.get,
		types: native.types,
		keys,
		fromMessage: (message: string): ProblemDetailsInput | undefined =>
			Object.values(keys).includes(message as Key)
				? native.create(message as Key).problemDetails
				: undefined,
		schema,
		response,
		responses: (...requested: Key[]) => {
			const groups = new Map<number, Key[]>();
			for (const key of requested) {
				const group = groups.get(native.get(key).status) ?? [];
				if (!group.includes(key)) {
					group.push(key);
				}
				groups.set(native.get(key).status, group);
			}
			return Object.fromEntries(
				[...groups.entries()].map(([status, group]) => {
					const [firstKey, ...remainingKeys] = group;
					if (firstKey === undefined) {
						throw new Error(`No Problem Details keys registered for HTTP ${status}`);
					}
					return [
						status,
						response(
							remainingKeys.length === 0 ? firstKey : [firstKey, ...remainingKeys],
						),
					];
				}),
			);
		},
	};
};

const problemType = (code: string) => `https://open-cash.example.com/problems/${code}`;

export const httpErrors = createHttpErrorRegistry({
	VALIDATION_FAILED: {
		type: problemType("validation-failed"),
		status: 422,
		title: "Validation Failed",
		detail: "Request validation failed",
		extensionsSchema: z.object({
			errors: z.array(z.object({ field: z.string(), message: z.string(), code: z.string() })),
		}),
	},
	UNAUTHORIZED: {
		type: problemType("unauthorized"),
		status: 401,
		title: "Unauthorized",
		detail: "Authentication is required to access this resource",
	},
	FORBIDDEN: {
		type: problemType("forbidden"),
		status: 403,
		title: "Forbidden",
		detail: "You do not have permission to access this resource",
	},
	UNSUPPORTED_MEDIA_TYPE: {
		type: problemType("unsupported-media-type"),
		status: 415,
		title: "Unsupported Media Type",
		detail: "The request Content-Type is not supported",
	},
	TOO_MANY_REQUESTS: {
		type: problemType("too-many-requests"),
		status: 429,
		title: "Too Many Requests",
		detail: "Too many requests, please try again later",
	},
	INTERNAL_SERVER_ERROR: {
		type: problemType("internal-server-error"),
		status: 500,
		title: "Internal Server Error",
		detail: "An unexpected error occurred",
	},
	CONVERSATION_NOT_FOUND: {
		type: problemType("conversation-not-found"),
		status: 404,
		title: "Conversation Not Found",
		detail: "The requested conversation was not found for the authenticated user",
	},
	// The three below mirror `FileError` from `@open-cash/files`: that service knows
	// nothing about HTTP, so its codes are mapped onto these on the route.
	CONVERSATION_FILE_NOT_FOUND: {
		type: problemType("conversation-file-not-found"),
		status: 404,
		title: "Conversation File Not Found",
		detail: "The requested conversation file was not found",
	},
	CONVERSATION_FILE_INVALID: {
		type: problemType("conversation-file-invalid"),
		status: 422,
		title: "Invalid Conversation File",
		detail: "The file name, type or contents are not accepted",
	},
	CONVERSATION_FILE_TOO_LARGE: {
		type: problemType("conversation-file-too-large"),
		status: 413,
		title: "Conversation File Too Large",
		detail: "The file exceeds the upload limit",
	},
	FINANCE_CONNECTION_NOT_FOUND: {
		type: problemType("finance-connection-not-found"),
		status: 404,
		title: "Finance Connection Not Found",
		detail: "The requested finance connection was not found",
	},
	FINANCE_ACCOUNT_NOT_FOUND: {
		type: problemType("finance-account-not-found"),
		status: 404,
		title: "Finance Account Not Found",
		detail: "The requested account was not found for the authenticated user",
	},
	FINANCE_TRANSACTION_NOT_FOUND: {
		type: problemType("finance-transaction-not-found"),
		status: 404,
		title: "Finance Transaction Not Found",
		detail: "One or more requested transactions were not found",
	},
	FINANCE_INVALID_CURSOR: {
		type: problemType("finance-invalid-cursor"),
		status: 422,
		title: "Invalid Finance Cursor",
		detail: "The cursor is invalid or belongs to different filters",
	},
	FINANCE_INVALID_DOCUMENT: {
		type: problemType("finance-invalid-document"),
		status: 422,
		title: "Invalid Counterparty Document",
		detail: "The document must be an 11-digit CPF or 14-digit CNPJ",
	},
	FINANCE_ACCOUNT_TYPE_INVALID: {
		type: problemType("finance-account-type-invalid"),
		status: 422,
		title: "Invalid Account Type",
		detail: "This operation requires a credit-card account",
	},
	FINANCE_MIXED_CURRENCIES: {
		type: problemType("finance-mixed-currencies"),
		status: 422,
		title: "Mixed Currencies",
		detail: "Balances in different currencies cannot be consolidated",
	},
	PLUGGY_UNAVAILABLE: {
		type: problemType("finance-provider-unavailable"),
		status: 503,
		title: "Finance Provider Unavailable",
		detail: "The finance provider is temporarily unavailable",
	},
});

type ZodValidationResult = { success: true; data: unknown } | { success: false; error: ZodError };

export const defaultValidationHook = (result: ZodValidationResult) => {
	if (result.success) {
		return;
	}

	throw httpErrors.create("VALIDATION_FAILED", {
		extensions: {
			errors: result.error.issues.map((issue) => ({
				field: issue.path.join("."),
				message: issue.message,
				code: issue.code,
			})),
		},
	});
};
