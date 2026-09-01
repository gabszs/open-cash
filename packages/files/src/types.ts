export type ConversationFileKind = "output" | "upload";

/**
 * Has to stay a type alias, and so does everything built on it: the agent returns
 * these straight out of a Flue tool, whose `output` is constrained to `JsonValue`, and
 * only object literal types — never an `interface` — get the implicit index signature
 * that satisfies it. Converting this back to an interface breaks `apps/agent`.
 */
// oxlint-disable-next-line typescript/consistent-type-definitions -- see above
export type ConversationFileMetadata = {
	filename: string;
	kind: ConversationFileKind;
	mimeType: string;
	sha256: string;
};

/** The wire shape: object metadata plus what only the bucket knows. */
export type ConversationFile = ConversationFileMetadata & {
	downloadPath: string;
	fileId: string;
	size: number;
	uploadedAt: string;
};

/**
 * `kind` narrowed to a literal. Writes always know which one they produced, and both
 * consumers declare it as a literal — the API on the upload response schema, the
 * agent on the `finance-file` data part.
 */
export type ConversationUploadFile = ConversationFile & { kind: "upload" };

export type ConversationOutputFile = ConversationFile & { kind: "output" };

export interface ConversationFileListOptions {
	cursor?: string;
	kind?: ConversationFileKind;
	limit?: number;
}

export interface ConversationFileListPage {
	items: ConversationFile[];
	/**
	 * Where the next scan resumes, or null once the prefix is exhausted. Filtering by
	 * `kind` happens after the bucket applied `limit`, so a page can hold fewer items
	 * than asked while more still exist: follow this until it is null.
	 */
	nextCursor: string | null;
}

export interface ConversationFileUpload {
	bytes: ArrayBuffer | Uint8Array;
	contentType?: string;
	filename: string;
}

export interface ConversationFilePublish {
	bytes: ArrayBuffer | Uint8Array;
	filename: string;
	mimeType?: string;
}
