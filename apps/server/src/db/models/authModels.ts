import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v7 as uuidv7 } from "uuid";

const timestamp = (name: string) => integer(name, { mode: "timestamp" });
const boolean = (name: string) => integer(name, { mode: "boolean" });
const now = sql`(unixepoch())`;

export const users = sqliteTable("users", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => uuidv7()),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	createdAt: timestamp("created_at").default(now).notNull(),
	updatedAt: timestamp("updated_at")
		.$onUpdate(() => new Date())
		.notNull(),
	role: text("role"),
	banned: boolean("banned").default(false),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires"),
	twoFactorEnabled: boolean("two_factor_enabled").default(false),
});

export const sessions = sqliteTable(
	"sessions",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at").default(now).notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		impersonatedBy: text("impersonated_by"),
		timezone: text("timezone"),
		city: text("city"),
		country: text("country"),
		region: text("region"),
		regionCode: text("region_code"),
		colo: text("colo"),
		latitude: text("latitude"),
		longitude: text("longitude"),
	},
	(table) => [index("sessions_userId_idx").on(table.userId)],
);

export const accounts = sqliteTable(
	"accounts",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").default(now).notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("accounts_userId_idx").on(table.userId)],
);

export const verifications = sqliteTable(
	"verifications",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").default(now).notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const apikeys = sqliteTable(
	"apikeys",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		configId: text("config_id").default("default").notNull(),
		name: text("name"),
		start: text("start"),
		referenceId: text("reference_id").notNull(),
		prefix: text("prefix"),
		key: text("key").notNull(),
		refillInterval: integer("refill_interval"),
		refillAmount: integer("refill_amount"),
		lastRefillAt: timestamp("last_refill_at"),
		enabled: boolean("enabled").default(true),
		rateLimitEnabled: boolean("rate_limit_enabled").default(true),
		rateLimitTimeWindow: integer("rate_limit_time_window").default(86_400_000),
		rateLimitMax: integer("rate_limit_max").default(10),
		requestCount: integer("request_count").default(0),
		remaining: integer("remaining"),
		lastRequest: timestamp("last_request"),
		expiresAt: timestamp("expires_at"),
		createdAt: timestamp("created_at").default(now).notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
		permissions: text("permissions"),
		metadata: text("metadata"),
	},
	(table) => [
		index("apikeys_configId_idx").on(table.configId),
		index("apikeys_referenceId_idx").on(table.referenceId),
		index("apikeys_key_idx").on(table.key),
	],
);

export const twoFactors = sqliteTable(
	"two_factors",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		secret: text("secret").notNull(),
		backupCodes: text("backup_codes").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		verified: boolean("verified").default(true),
		failedVerificationCount: integer("failed_verification_count").default(0),
		lockedUntil: timestamp("locked_until"),
	},
	(table) => [
		index("twoFactors_secret_idx").on(table.secret),
		index("twoFactors_userId_idx").on(table.userId),
	],
);

export const userFiles = sqliteTable("user_files", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => uuidv7()),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	filename: text("filename").notNull(),
	originalName: text("original_name").notNull(),
	contentType: text("content_type").notNull(),
	size: integer("size").notNull(),
	r2Key: text("r2_key").notNull(),
	uploadedAt: timestamp("uploaded_at").notNull(),
});

export const agentHosts = sqliteTable(
	"agent_hosts",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		name: text("name"),
		userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
		defaultCapabilities: text("default_capabilities"),
		publicKey: text("public_key"),
		kid: text("kid"),
		jwksUrl: text("jwks_url"),
		enrollmentTokenHash: text("enrollment_token_hash"),
		enrollmentTokenExpiresAt: integer("enrollment_token_expires_at", {
			mode: "timestamp_ms",
		}),
		status: text("status").default("active").notNull(),
		activatedAt: integer("activated_at", { mode: "timestamp_ms" }),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
		lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("agentHosts_userId_idx").on(table.userId),
		index("agentHosts_kid_idx").on(table.kid),
		index("agentHosts_enrollmentTokenHash_idx").on(table.enrollmentTokenHash),
		index("agentHosts_status_idx").on(table.status),
	],
);

export const agents = sqliteTable(
	"agents",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		name: text("name").notNull(),
		userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
		hostId: text("host_id")
			.notNull()
			.references(() => agentHosts.id, { onDelete: "cascade" }),
		status: text("status").default("active").notNull(),
		mode: text("mode").default("delegated").notNull(),
		publicKey: text("public_key").notNull(),
		kid: text("kid"),
		jwksUrl: text("jwks_url"),
		lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
		activatedAt: integer("activated_at", { mode: "timestamp_ms" }),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
		metadata: text("metadata"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("agents_userId_idx").on(table.userId),
		index("agents_hostId_idx").on(table.hostId),
		index("agents_status_idx").on(table.status),
		index("agents_kid_idx").on(table.kid),
	],
);

export const agentCapabilityGrants = sqliteTable(
	"agent_capability_grants",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		agentId: text("agent_id")
			.notNull()
			.references(() => agents.id, { onDelete: "cascade" }),
		capability: text("capability").notNull(),
		deniedBy: text("denied_by").references(() => users.id, {
			onDelete: "cascade",
		}),
		grantedBy: text("granted_by").references(() => users.id, {
			onDelete: "cascade",
		}),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		status: text("status").default("active").notNull(),
		reason: text("reason"),
		constraints: text("constraints"),
	},
	(table) => [
		index("agentCapabilityGrants_agentId_idx").on(table.agentId),
		index("agentCapabilityGrants_capability_idx").on(table.capability),
		index("agentCapabilityGrants_grantedBy_idx").on(table.grantedBy),
		index("agentCapabilityGrants_status_idx").on(table.status),
	],
);

export const approvalRequests = sqliteTable(
	"approval_requests",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		method: text("method").notNull(),
		agentId: text("agent_id").references(() => agents.id, {
			onDelete: "cascade",
		}),
		hostId: text("host_id").references(() => agentHosts.id, {
			onDelete: "cascade",
		}),
		userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
		capabilities: text("capabilities"),
		status: text("status").default("pending").notNull(),
		userCodeHash: text("user_code_hash"),
		loginHint: text("login_hint"),
		bindingMessage: text("binding_message"),
		clientNotificationToken: text("client_notification_token"),
		clientNotificationEndpoint: text("client_notification_endpoint"),
		deliveryMode: text("delivery_mode"),
		interval: integer("interval").notNull(),
		lastPolledAt: integer("last_polled_at", { mode: "timestamp_ms" }),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("approvalRequests_agentId_idx").on(table.agentId),
		index("approvalRequests_hostId_idx").on(table.hostId),
		index("approvalRequests_userId_idx").on(table.userId),
		index("approvalRequests_status_idx").on(table.status),
	],
);

export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	accounts: many(accounts),
	agentHosts: many(agentHosts),
	agents: many(agents),
	agentCapabilityGrants: many(agentCapabilityGrants),
	approvalRequests: many(approvalRequests),
	twoFactors: many(twoFactors),
	userFiles: many(userFiles),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	users: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
	users: one(users, {
		fields: [accounts.userId],
		references: [users.id],
	}),
}));

export const agentHostsRelations = relations(agentHosts, ({ one, many }) => ({
	users: one(users, {
		fields: [agentHosts.userId],
		references: [users.id],
	}),
	agents: many(agents),
	approvalRequests: many(approvalRequests),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
	users: one(users, {
		fields: [agents.userId],
		references: [users.id],
	}),
	agentHosts: one(agentHosts, {
		fields: [agents.hostId],
		references: [agentHosts.id],
	}),
	agentCapabilityGrants: many(agentCapabilityGrants),
	approvalRequests: many(approvalRequests),
}));

export const agentCapabilityGrantsDeniedByRelations = relations(
	agentCapabilityGrants,
	({ one }) => ({
		users: one(users, {
			fields: [agentCapabilityGrants.deniedBy],
			references: [users.id],
		}),
	}),
);

export const agentCapabilityGrantsGrantedByRelations = relations(
	agentCapabilityGrants,
	({ one }) => ({
		users: one(users, {
			fields: [agentCapabilityGrants.grantedBy],
			references: [users.id],
		}),
	}),
);

export const agentCapabilityGrantsRelations = relations(agentCapabilityGrants, ({ one }) => ({
	agents: one(agents, {
		fields: [agentCapabilityGrants.agentId],
		references: [agents.id],
	}),
}));

export const approvalRequestsRelations = relations(approvalRequests, ({ one }) => ({
	agents: one(agents, {
		fields: [approvalRequests.agentId],
		references: [agents.id],
	}),
	agentHosts: one(agentHosts, {
		fields: [approvalRequests.hostId],
		references: [agentHosts.id],
	}),
	users: one(users, {
		fields: [approvalRequests.userId],
		references: [users.id],
	}),
}));

export const twoFactorsRelations = relations(twoFactors, ({ one }) => ({
	users: one(users, {
		fields: [twoFactors.userId],
		references: [users.id],
	}),
}));

export const userFilesRelations = relations(userFiles, ({ one }) => ({
	users: one(users, {
		fields: [userFiles.userId],
		references: [users.id],
	}),
}));
