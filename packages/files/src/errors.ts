/**
 * Rejections this package raises on purpose, as opposed to a bug. The code is the
 * whole point: nothing here knows about HTTP, so each consumer maps it on its own
 * — the API to Problem Details, the agent to tool output text. A plain `Error`
 * would reach the API's error handler as a 500 and report a bad filename as an
 * outage.
 */
export type FileErrorCode = "file_invalid" | "file_not_found" | "file_too_large";

export class FileError extends Error {
	readonly code: FileErrorCode;

	constructor(code: FileErrorCode, message: string) {
		super(message);
		this.name = "FileError";
		this.code = code;
	}
}

export const fileInvalid = (message: string) => new FileError("file_invalid", message);

export const fileNotFound = (message = "The conversation file was not found.") =>
	new FileError("file_not_found", message);

export const fileTooLarge = (message: string) => new FileError("file_too_large", message);

export const isFileError = (error: unknown): error is FileError => error instanceof FileError;
