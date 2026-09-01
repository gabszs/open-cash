import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";

import type { BaseD1Repository } from "../repository/baseRepository";
import type { EntityId, RepositoryFilters } from "../repository/IRepository";
import type { searchOptionsSchemaType } from "../schemas/baseSchemas";

import { BaseService } from "./baseService";

/**
 * The service half of `BaseD1Repository`: collapses the eight generic parameters
 * of `BaseService` into the Drizzle model, so a feature service reads
 * `extends BaseD1Service<typeof connections, ConnectionsRepository>` and nothing
 * more. `TRepository` is what keeps whatever the feature repository adds on top
 * of the base — including `db`, for the rules that need a query of their own.
 */
export abstract class BaseD1Service<
	TModel extends AnySQLiteTable,
	TRepository extends BaseD1Repository<TModel> = BaseD1Repository<TModel>,
> extends BaseService<
	InferSelectModel<TModel>,
	InferInsertModel<TModel>,
	Partial<InferInsertModel<TModel>>,
	searchOptionsSchemaType,
	RepositoryFilters<TModel>,
	InferSelectModel<TModel> | null,
	boolean,
	EntityId<InferSelectModel<TModel>>
> {
	declare protected readonly repository: TRepository;

	// Narrows the constructor parameter to `TRepository`, which is what makes the
	// redeclaration above true rather than a claim.
	// oxlint-disable-next-line eslint/no-useless-constructor -- see above.
	constructor(repository: TRepository) {
		super(repository);
	}
}
