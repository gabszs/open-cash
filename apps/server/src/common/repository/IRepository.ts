import type { InferSelectModel } from "drizzle-orm";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";

import type { searchOptionsSchemaType } from "../schemas/baseSchemas";

export type RepositoryId = string | number;
type FilterValue = string | number | boolean | Date | null;

export type Filters = Record<string, FilterValue>;

export type EntityId<TData> = TData extends { id: infer TId extends RepositoryId } ? TId : never;

export type RepositoryFilters<TModel extends AnySQLiteTable> = Partial<InferSelectModel<TModel>>;

export interface IRepository<
	TData = object,
	TCreate = Partial<TData>,
	TUpdate = Partial<TCreate>,
	TSearchOptions extends searchOptionsSchemaType = searchOptionsSchemaType,
	TFilters = Filters,
	TMutationResult = TData | null,
	TDeleteResult = boolean,
	TId extends RepositoryId = EntityId<TData>,
> {
	getAll(searchOptions: TSearchOptions, filters?: TFilters): Promise<TData[]>;

	getById(id: TId, filters?: TFilters): Promise<TData | null>;

	create(data: TCreate): Promise<TData>;

	update(id: TId, data: TUpdate, filters?: TFilters): Promise<TMutationResult>;

	delete(id: TId, filters?: TFilters): Promise<TDeleteResult>;

	count(filters?: TFilters): Promise<number>;
}
