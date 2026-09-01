import type { AgentSession } from "@better-auth/agent-auth";
import type { AppContextType, UserIdentityNamespace } from "@server/types";
import type { Auth, BetterAuthOptions } from "better-auth";
import type { CloudflareGeolocation, R2Config } from "better-auth-cloudflare";
import type { Context } from "hono";

import { agentAuth } from "@better-auth/agent-auth";
import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { cloudflare, createKVStorage } from "better-auth-cloudflare";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, bearer, openAPI, testUtils, twoFactor } from "better-auth/plugins";
import { v7 as uuidv7 } from "uuid";

import type { dbType } from "../db";

import { models } from "../db/models";
import { financeAgentCapabilities, financeAgentCapabilityIds } from "../features/finance/agentAuth";
import { sendResetPasswordEmail, sendVerificationEmail } from "./email";

type BetterAuthKVNamespace = Parameters<typeof createKVStorage>[0];
type BetterAuthR2Bucket = R2Config["bucket"];

type BetterAuthApi = Auth<BetterAuthOptions>["api"];
interface AgentAuthApi {
	createHost(input: {
		asResponse?: false;
		body: {
			default_capabilities: string[];
			name: string;
			public_key: JsonWebKey;
		};
		headers: Headers;
	}): Promise<{ hostId?: string; status: string }>;
	getAgentSession(input: { headers: Headers }): Promise<AgentSession | null>;
}
interface AuthInternalContext {
	internalAdapter: {
		createSession(
			userId: string,
			dontRemember?: boolean,
			overrides?: { userAgent?: string },
		): Promise<{ token: string }>;
		deleteSession(token: string): Promise<void>;
	};
}

export interface AuthType {
	$context: Promise<AuthInternalContext>;
	api: Pick<BetterAuthApi, "getSession" | "listSessions" | "revokeSession"> & AgentAuthApi;
	handler: Auth<BetterAuthOptions>["handler"];
}

const userFilePrefix = (userId: string) => `user-files/${userId}/`;

const oauthCredentials = (clientId?: string, clientSecret?: string) =>
	clientId && clientSecret ? { clientId, clientSecret } : undefined;

// oxlint-disable-next-line complexity -- Better Auth configuration is intentionally assembled in one place
export const createAuth = (c?: Context<AppContextType>): AuthType => {
	const db = c?.get("db") ?? ({} as dbType);
	const env = c?.env;
	const trustedOrigins = (env?.CORS_ORIGIN ?? "http://localhost:5055")
		.split(",")
		.map((origin: string) => origin.trim())
		.filter(Boolean);
	const requestOrigin = c?.req.header("origin");
	const webOrigin =
		requestOrigin && trustedOrigins.includes(requestOrigin) ? requestOrigin : trustedOrigins[0];
	const withWebCallback = (url: string, path: string) => {
		const link = new URL(url);
		link.searchParams.set("callbackURL", new URL(path, webOrigin).toString());
		return link.toString();
	};

	// Login social é opcional: sem as duas credenciais o provider não entra na
	// config, e `/sign-in/social` responde 400 em vez de redirecionar para um
	// consent quebrado. O mesmo build sobe com ou sem os apps OAuth registrados.
	const githubCredentials = oauthCredentials(env?.GITHUB_CLIENT_ID, env?.GITHUB_CLIENT_SECRET);
	const googleCredentials = oauthCredentials(env?.GOOGLE_CLIENT_ID, env?.GOOGLE_CLIENT_SECRET);
	const enabledSocialProviders = [
		...(githubCredentials ? (["github"] as const) : []),
		...(googleCredentials ? (["google"] as const) : []),
	];
	const socialProviders = {
		...(githubCredentials && { github: githubCredentials }),
		...(googleCredentials && {
			google: {
				...googleCredentials,
				// O Google só devolve `refresh_token` na primeira autorização, a menos
				// que o consent seja pedido de novo a cada login.
				accessType: "offline" as const,
				prompt: "select_account consent" as const,
			},
		}),
	};

	return betterAuth({
		account: {
			// GitHub e Google só entregam e-mails já verificados, então vincular à
			// conta existente evita duplicar quem entrou antes por senha. Sem
			// provider configurado não há nada em que confiar.
			accountLinking: {
				enabled: enabledSocialProviders.length > 0,
				trustedProviders: enabledSocialProviders,
			},
		},
		advanced: {
			database: { generateId: () => uuidv7() },
			// O Worker fica atrás do proxy da Cloudflare, então o IP real só chega por header.
			ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-real-ip"] },
		},
		basePath: env?.AUTH_BASE_PATH,
		baseURL: c ? new URL(c.req.url).origin : "http://localhost:8787",
		// Sem binding, o adapter vazio serve apenas para o `auth:generate` inferir o
		// dialeto e emitir `authModels.ts`.
		database: env
			? drizzleAdapter(db, {
					debugLogs: String(env.ENVIRONMENT) !== "production",
					provider: "sqlite",
					schema: models,
					usePlural: true,
				})
			: drizzleAdapter({} as D1Database, {
					provider: "sqlite",
					schema: models,
					usePlural: true,
				}),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			sendResetPassword: ({ url, user }) =>
				sendResetPasswordEmail(env, { name: user.name, to: user.email, url }),
		},
		emailVerification: {
			// `requireEmailVerification` bloqueia o login sem verificação; sem isto nenhum
			// e-mail sairia sozinho, já que o cadastro não dispara nada.
			sendOnSignIn: true,
			sendOnSignUp: true,
			sendVerificationEmail: ({ url, user }) =>
				sendVerificationEmail(env, {
					name: user.name,
					to: user.email,
					// `verified=1` deixa a tela de login explicar o que acabou de acontecer;
					// um token inválido chega na mesma rota com `&error=...`.
					url: withWebCallback(url, "/auth/sign-in?verified=1"),
				}),
			afterEmailVerification: async (user) => {
				if (!c?.env?.USER_IDENTITY || !env) {
					throw new Error("Agent identity provisioning requires request bindings");
				}
				// `worker-configuration.d.ts` descreve o binding como um namespace sem
				// classe, então os métodos RPC do DO só aparecem por este contrato.
				const identity = (
					c.env.USER_IDENTITY as unknown as UserIdentityNamespace
				).getByName(user.id);
				const host = await identity.ensureHost({
					defaultCapabilities: financeAgentCapabilityIds,
					userId: user.id,
				});
				if (host.hostId) return;

				const context = await c.get("auth").$context;
				const session = await context.internalAdapter.createSession(user.id, true, {
					userAgent: "agent-auth-provisioner",
				});
				try {
					const registeredResponse = await c.get("auth").api.createHost({
						asResponse: false,
						body: {
							default_capabilities: financeAgentCapabilityIds,
							name: `open-cash-${user.id}`,
							public_key: host.publicKey,
						},
						headers: new Headers({ Authorization: `Bearer ${session.token}` }),
					});
					if (registeredResponse.status !== "active" || !registeredResponse.hostId) {
						throw new Error("Agent Auth Host provisioning did not activate the Host");
					}
					await identity.bindHost(registeredResponse.hostId);
				} finally {
					await context.internalAdapter.deleteSession(session.token);
				}
			},
		},
		plugins: [
			agentAuth({
				agentSessionTTL: 3600,
				allowDynamicHostRegistration: false,
				capabilities: financeAgentCapabilities,
				defaultHostCapabilities: financeAgentCapabilityIds,
				jtiCacheStorage: "secondary-storage",
				jwksCacheStorage: "secondary-storage",
				modes: ["delegated"],
				providerDescription:
					"Read-only Open Finance data for the authenticated user's pinned connection.",
				providerName: "open-cash Finance",
			}),
			// Used only by the request-scoped internal Host provisioning bridge. It
			// turns a freshly-created Better Auth session token into the same
			// authenticated context as a normal session request.
			bearer(),
			// Primeiro da lista para que o hook de geolocalização rode antes dos demais
			// `databaseHooks` de sessão, como o wrapper `withCloudflare` fazia.
			cloudflare({
				autoDetectIpAddress: true,
				cf: (c?.req.raw.cf as CloudflareGeolocation | undefined) ?? {},
				geolocationTracking: true,
				// Habilitado apenas quando há binding disponível no Worker.
				r2: env?.R2
					? {
							allowedTypes: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
							bucket: env.R2 as BetterAuthR2Bucket,
							hooks: {
								upload: {
									before: (_file, ctx) => (ctx.session ? undefined : null),
								},
							},
							maxFileSize: 2 * 1024 * 1024,
						}
					: undefined,
			}),
			admin(),
			twoFactor({
				backupCodeOptions: { storeBackupCodes: "encrypted" },
				issuer: "open-cash",
			}),
			openAPI({
				disableDefaultReference: String(env?.ENABLE_OPEN_API) === "false",
				path: env?.AUTH_OPEN_API_PATH ?? "/docs",
				theme: env?.SCALAR_THEME ?? "deepSpace",
			}),
			apiKey({
				apiKeyHeaders: ["x-api-key", "authorization"],
				defaultPrefix: "sk_",
				permissions: {
					defaultPermissions: { finance: ["read", "write", "mcp"] },
				},
			}),
			...(String(env?.ENVIRONMENT) === "test" ? [testUtils()] : []),
		],
		secondaryStorage: env?.CACHE
			? createKVStorage(env.CACHE as BetterAuthKVNamespace)
			: undefined,
		secret: env?.AUTH_SECRET ?? "development-only-auth-secret-change-me",
		session: {
			expiresIn: env?.AUTH_SESSION_DURATION_SECONDS ?? 1_209_600,
			// Obrigatório com `geolocationTracking`: as colunas de geo vivem na tabela de sessão.
			storeSessionInDatabase: true,
		},
		socialProviders,
		trustedOrigins,
		user: {
			deleteUser: {
				// `userFiles.userId` é ON DELETE CASCADE, então as linhas somem sozinhas;
				// os objetos no R2 precisam ser removidos à mão para não ficarem órfãos.
				beforeDelete: async (user) => {
					if (!env?.R2) return;
					const stored = await env.R2.list({ prefix: userFilePrefix(user.id) });
					await Promise.all(
						stored.objects.map((object: { key: string }) => env.R2.delete(object.key)),
					);
				},
				enabled: env?.AUTH_ENABLE_DELETE_ACCOUNT,
			},
		},
	});
};

export type AuthSession = NonNullable<Awaited<ReturnType<AuthType["api"]["getSession"]>>>;
export type AuthUser = AuthSession["user"];
export type AuthSessionData = AuthSession["session"] & { impersonatedBy: string | null };
