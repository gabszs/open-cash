import type { Column, SQL } from "drizzle-orm";

import { gt, gte, lt, lte } from "drizzle-orm";

export interface DateFilterOptions {
	createdAfter?: Date;
	createdBefore?: Date;
	createdOnOrAfter?: Date;
	createdOnOrBefore?: Date;
}

export const getDateFilterConditions = (
	createdAtColumn: Column | undefined,
	options: DateFilterOptions,
): SQL<unknown>[] => {
	if (!createdAtColumn) return [];

	const conditions: SQL<unknown>[] = [];
	if (options.createdAfter) conditions.push(gt(createdAtColumn, options.createdAfter));
	if (options.createdBefore) conditions.push(lt(createdAtColumn, options.createdBefore));
	if (options.createdOnOrAfter) conditions.push(gte(createdAtColumn, options.createdOnOrAfter));
	if (options.createdOnOrBefore) conditions.push(lte(createdAtColumn, options.createdOnOrBefore));
	return conditions;
};
