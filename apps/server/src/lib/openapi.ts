interface ExternalDocumentationObject {
	description?: string;
	url: string;
	[key: `x-${string}`]: unknown;
}

interface TagObject {
	name: string;
	description?: string;
	externalDocs?: ExternalDocumentationObject;
	[key: `x-${string}`]: unknown;
}

type SecurityRequirementObject = Record<string, string[]>;

type SecuritySchemeObject =
	| {
			type: "apiKey";
			in: "query" | "header" | "path" | "cookie";
			name: string;
			description?: string;
			[key: `x-${string}`]: unknown;
	  }
	| {
			type: "http";
			scheme: string;
			description?: string;
			bearerFormat?: string;
			[key: `x-${string}`]: unknown;
	  };

interface ComponentsObject {
	securitySchemes?: Record<string, SecuritySchemeObject>;
	[key: string]: unknown;
}

interface OpenAPIObjectV31 {
	openapi: string;
	info: {
		title: string;
		description?: string;
		version: string;
		contact?: {
			name?: string;
			email?: string;
			url?: string;
		};
		termsOfService?: string;
	};
	paths?: Record<string, unknown>;
	components?: ComponentsObject;
	externalDocs?: ExternalDocumentationObject;
	security?: SecurityRequirementObject[];
	tags?: TagObject[];
	[key: `x-${string}`]: unknown;
}

export const openApiSecuritySchemes = {
	apiKeyCookie: {
		in: "cookie",
		name: "open_cash_cookie",
		type: "apiKey",
	},
	bearerAuth: {
		scheme: "bearer",
		type: "http",
	},
} satisfies Record<string, SecuritySchemeObject>;

export const openApiSecurityRequirements: SecurityRequirementObject[] = [
	{ bearerAuth: [] },
	{ apiKeyCookie: [] },
];

export const scalarAuthentication = {
	preferredSecurityScheme: "bearerAuth",
	securitySchemes: {
		apiKeyCookie: {
			value: "open_cash_cookie",
		},
		bearerAuth: {
			token: "open_cash_session_token",
		},
	},
} as const;

export const openApiSchema = {
	components: {
		securitySchemes: openApiSecuritySchemes,
	},
	externalDocs: {
		description: "Official Documentation",
		url: "https://open-cash.example.com/docs",
	},
	info: {
		contact: {
			email: "maintainers@example.com",
			name: "Official Website",
			url: "https://open-cash.example.com",
		},
		description:
			"Open Cash is an authenticated Open Finance API with account, transaction, investment, conversation, and AI assistant features.",
		termsOfService: "https://open-cash.example.com/privacy",
		title: "Open Cash API",
		version: "1.0.0",
	},
	openapi: "3.1.0",
	paths: {},
} satisfies OpenAPIObjectV31;

export const tagDescriptions: TagObject[] = [
	{
		description: "The Open Finance credentials a user has linked, one row per bank.",
		name: "Connections",
	},
	{
		description: "The per-user index of AI assistant conversations.",
		name: "Conversations",
	},
	{
		description: "Auxiliary endpoints such as health checks and service status.",
		name: "Utilities",
	},
];
