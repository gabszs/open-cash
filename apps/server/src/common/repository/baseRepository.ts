import type { D1Db } from "@server/db";
import type { InferInsertModel, InferSelectModel, SQL } from "drizzle-orm";
import type { AnySQLiteSelect, AnySQLiteTable, SQLiteColumn } from "drizzle-orm/sqlite-core";

import { and, eq, getTableColumns, isNull, sql } from "drizzle-orm";

import type { searchOptionsSchemaType } from "../schemas/baseSchemas";
import type { EntityId, IRepository, RepositoryFilters } from "./IRepository";

import { getDateFilterConditions } from "./shared/dateFilters";
import { getOrderingExpression } from "./shared/ordering";

/**
 * Reusable CRUD repository for Drizzle models backed by Cloudflare D1.
 *
 * Feature repositories can extend this class and keep domain-specific methods,
 * while delegating ordinary persistence to `create`, `getById`, `getAll`,
 * `update`, `delete`, and `count`.
 */
export class BaseD1Repository<TModel extends AnySQLiteTable> implements IRepository<
	InferSelectModel<TModel>,
	InferInsertModel<TModel>,
	Partial<InferInsertModel<TModel>>,
	searchOptionsSchemaType,
	RepositoryFilters<TModel>,
	InferSelectModel<TModel> | null,
	boolean,
	EntityId<InferSelectModel<TModel>>
> {
	private readonly columns: Record<string, SQLiteColumn>;
	protected readonly model: TModel;
	readonly db: D1Db;

	constructor(model: TModel, db: D1Db) {
		this.model = model;
		this.db = db;
		this.columns = getTableColumns(model) as Record<string, SQLiteColumn>;
		this.requireColumn("id");
	}

	private findColumn = (name: string): SQLiteColumn | undefined =>
		this.columns[name] ?? Object.values(this.columns).find((column) => column.name === name);

	private requireColumn(name: string): SQLiteColumn {
		const column = this.findColumn(name);
		if (!column) throw new Error(`Unknown repository column: ${name}`);
		return column;
	}

	protected buildWhereConditions(
		filters?: RepositoryFilters<TModel>,
		searchOptions?: searchOptionsSchemaType,
	): SQL<unknown> | undefined {
		const conditions: SQL<unknown>[] = [];

		for (const [key, value] of Object.entries(filters ?? {})) {
			if (value === undefined) continue;
			const column = this.requireColumn(key);
			conditions.push(value === null ? isNull(column) : eq(column, value));
		}

		if (searchOptions) {
			conditions.push(
				...getDateFilterConditions(this.findColumn("createdAt"), {
					createdAfter: searchOptions.created_after
						? new Date(searchOptions.created_after)
						: undefined,
					createdBefore: searchOptions.created_before
						? new Date(searchOptions.created_before)
						: undefined,
					createdOnOrAfter: searchOptions.created_on_or_after
						? new Date(searchOptions.created_on_or_after)
						: undefined,
					createdOnOrBefore: searchOptions.created_on_or_before
						? new Date(searchOptions.created_on_or_before)
						: undefined,
				}),
			);
		}

		return conditions.length > 0 ? and(...conditions) : undefined;
	}

	private applySelectOptions(
		query: AnySQLiteSelect,
		searchOptions?: searchOptionsSchemaType,
		filters?: RepositoryFilters<TModel>,
	): AnySQLiteSelect {
		let result = query.where(
			this.buildWhereConditions(filters, searchOptions),
		) as AnySQLiteSelect;

		if (!searchOptions) return result;

		result = result.orderBy(
			getOrderingExpression(searchOptions.ordering, this.findColumn),
		) as AnySQLiteSelect;

		if (searchOptions.page_size !== "all") {
			result = (result.limit(searchOptions.page_size) as AnySQLiteSelect).offset(
				(searchOptions.page - 1) * searchOptions.page_size,
			) as AnySQLiteSelect;
		}

		return result;
	}

	async getAll(
		searchOptions: searchOptionsSchemaType,
		filters?: RepositoryFilters<TModel>,
	): Promise<InferSelectModel<TModel>[]> {
		const query = this.applySelectOptions(
			this.db.select().from(this.model) as AnySQLiteSelect,
			searchOptions,
			filters,
		);
		return (await query) as InferSelectModel<TModel>[];
	}

	async getById(
		id: EntityId<InferSelectModel<TModel>>,
		filters?: RepositoryFilters<TModel>,
	): Promise<InferSelectModel<TModel> | null> {
		const query = this.applySelectOptions(
			this.db.select().from(this.model) as AnySQLiteSelect,
			undefined,
			{ ...filters, id } as RepositoryFilters<TModel>,
		);
		const rows = await query.limit(1);
		return (rows[0] ?? null) as InferSelectModel<TModel> | null;
	}

	async create(data: InferInsertModel<TModel>): Promise<InferSelectModel<TModel>> {
		const rows = await this.db.insert(this.model).values(data).returning();
		const [row] = rows;
		if (!row) throw new Error("Repository create did not return a row");
		return row as InferSelectModel<TModel>;
	}

	async update(
		id: EntityId<InferSelectModel<TModel>>,
		data: Partial<InferInsertModel<TModel>>,
		filters?: RepositoryFilters<TModel>,
	): Promise<InferSelectModel<TModel> | null> {
		const where = this.buildWhereConditions({
			...filters,
			id,
		} as RepositoryFilters<TModel>);
		const rows = await this.db.update(this.model).set(data).where(where).returning();
		return (rows[0] ?? null) as InferSelectModel<TModel> | null;
	}

	async delete(
		id: EntityId<InferSelectModel<TModel>>,
		filters?: RepositoryFilters<TModel>,
	): Promise<boolean> {
		const where = this.buildWhereConditions({
			...filters,
			id,
		} as RepositoryFilters<TModel>);
		const rows = await this.db
			.delete(this.model)
			.where(where)
			.returning({ id: this.requireColumn("id") });
		return rows.length > 0;
	}

	async count(filters?: RepositoryFilters<TModel>): Promise<number> {
		const rows = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(this.model)
			.where(this.buildWhereConditions(filters));
		return Number(rows[0]?.count ?? 0);
	}
}
