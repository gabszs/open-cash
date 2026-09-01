export function checkForChanges(
	payload: Record<string, unknown>,
	existing: Record<string, unknown>,
) {
	for (const key of Object.keys(payload)) {
		if (payload[key] !== existing[key]) {
			return true;
		}
	}
	return false;
}

/**
 * Converts SQL datetime to Unix timestamp in milliseconds
 * Handles both ISO format and SQL format (YYYY-MM-DD HH:MM:SS)
 */
export function convertToUnixTimestamp(sqlDatetime: string): number {
	const datetimeWithZ = sqlDatetime.includes("T")
		? sqlDatetime
		: `${sqlDatetime.replace(" ", "T")}Z`;
	return new Date(datetimeWithZ).getTime();
}
