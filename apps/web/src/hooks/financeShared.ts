export const financeKey = ["finance"] as const;

export const scopedFinanceKey = (connectionId: string | null, ...parts: unknown[]) =>
	[...financeKey, connectionId, ...parts] as const;

export const hasSelectedConnection = (connectionId: string | null) => connectionId !== null;

export const financeRequestOptions = (connectionId: string, signal: AbortSignal) => ({
	headers: { "x-finance-connection-id": connectionId },
	init: { signal },
});

export async function financeResponseError(response: Response) {
	const problem: unknown = await response.json().catch(() => null);
	if (typeof problem === "object" && problem !== null) {
		if ("detail" in problem && typeof problem.detail === "string") {
			return new Error(problem.detail);
		}
		if ("title" in problem && typeof problem.title === "string") {
			return new Error(problem.title);
		}
	}
	return new Error(`Finance API returned ${response.status}`);
}

export const loadSelectedConnection =
	<Result>(
		connectionId: string | null,
		load: (selected: string, signal: AbortSignal) => Promise<Result>,
	) =>
	({ signal }: { signal: AbortSignal }) => {
		if (connectionId === null) throw new Error("No finance connection selected");
		return load(connectionId, signal);
	};
