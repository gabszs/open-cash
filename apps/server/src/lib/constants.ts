export const EMAIL_FROM_NAME = "open-cash";
export const EMAIL_FROM_ADDRESS = "noreply@open-cash.example.com";
export const GITHUB_REPO_URL = "https://github.com/your-org/open-cash";
export const MAIN_SITE_URL = "https://open-cash.example.com";

export const ContentTypes = {
	CSV: "text/csv",
	FORM_DATA: "multipart/form-data",
	FORM_URLENCODED: "application/x-www-form-urlencoded",
	HTML: "text/html",
	JSON: "application/json",
	OCTET_STREAM: "application/octet-stream",
	PDF: "application/pdf",
	PROBLEM_JSON: "application/problem+json; charset=utf-8",
	PROTOBUF: "application/protobuf",
	TEXT: "text/plain",
	XML: "application/xml",
	X_PROTOBUF: "application/x-protobuf",
} as const;

/**
 * JSON only, on purpose: a widened `contentType` parameter turns the computed key
 * into an index signature, and every route built on this would stop checking the
 * shape its handler returns. Non-JSON responses declare their content inline.
 */
export const createHttpResponse = <TSchema>(
	schema: TSchema,
	description: string,
	contentType = ContentTypes.JSON,
) => ({ content: { [contentType]: { schema } }, description }) as const;
const success = <const Code extends number>(code: Code, title: string, detail: string) => ({
	code,
	title,
	detail,
	response: <TSchema>(schema: TSchema, description = detail) =>
		createHttpResponse(schema, description),
});
export const status = {
	OK: success(200, "OK", "Request completed successfully."),
	CREATED: success(201, "Created", "Resource created successfully."),
	NO_CONTENT: {
		code: 204 as const,
		title: "No Content",
		detail: "Request completed. No content to return.",
		response: (description = "Request completed. No content to return.") => ({ description }),
	},
} as const;
export type HttpStatusEntry = (typeof status)[keyof typeof status];
