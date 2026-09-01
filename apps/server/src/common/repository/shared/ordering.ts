import type { Column } from "drizzle-orm";

import { asc, desc } from "drizzle-orm";

export const getOrderingExpression = (
	ordering: string,
	findColumn: (name: string) => Column | undefined,
) => {
	const descending = ordering.startsWith("-");
	const columnName = descending ? ordering.slice(1) : ordering;
	const column = findColumn(columnName);
	if (!column) {
		throw new Error(`Unknown ordering column: ${columnName}`);
	}
	return descending ? desc(column) : asc(column);
};
