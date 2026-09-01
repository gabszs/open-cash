import type { EntityId, Filters, IRepository, RepositoryId } from "../repository/IRepository";
import type { searchOptionsSchemaType } from "../schemas/baseSchemas";

/**
 * Reusable CRUD service over any `IRepository`.
 *
 * Feature services extend this and keep their own domain methods — the point is
 * that those methods delegate ordinary persistence here instead of reaching for
 * the repository themselves.
 *
 * The CRUD methods are `protected` on purpose: extending must never widen a
 * service's public surface by accident. Each service decides which operations
 * its routes may call, under which name and shape — `listConnections` maps rows
 * to a DTO because the raw row carries a sealed credential, and no route should
 * be able to skip that by calling an inherited `getAll`.
 *
 * The generic parameters mirror `IRepository` one for one. Most services want
 * {@link BaseD1Service} instead, which fills them in from the Drizzle model.
 */
export abstract class BaseService<
	TData = object,
	TCreate = Partial<TData>,
	TUpdate = Partial<TCreate>,
	TSearchOptions extends searchOptionsSchemaType = searchOptionsSchemaType,
	TFilters = Filters,
	TMutationResult = TData | null,
	TDeleteResult = boolean,
	TId extends RepositoryId = EntityId<TData>,
> {
	protected readonly repository: IRepository<
		TData,
		TCreate,
		TUpdate,
		TSearchOptions,
		TFilters,
		TMutationResult,
		TDeleteResult,
		TId
	>;

	constructor(
		repository: IRepository<
			TData,
			TCreate,
			TUpdate,
			TSearchOptions,
			TFilters,
			TMutationResult,
			TDeleteResult,
			TId
		>,
	) {
		this.repository = repository;
	}

	protected async getAll(searchOptions: TSearchOptions, filters: TFilters = {} as TFilters) {
		return await this.repository.getAll(searchOptions, filters);
	}

	protected async getById(id: TId, filters: TFilters = {} as TFilters) {
		return await this.repository.getById(id, filters);
	}

	protected async create(data: TCreate) {
		return await this.repository.create(data);
	}

	protected async update(id: TId, data: TUpdate, filters: TFilters = {} as TFilters) {
		return await this.repository.update(id, data, filters);
	}

	protected async delete(id: TId, filters: TFilters = {} as TFilters) {
		return await this.repository.delete(id, filters);
	}

	protected async count(filters: TFilters = {} as TFilters): Promise<number> {
		return await this.repository.count(filters);
	}
}
