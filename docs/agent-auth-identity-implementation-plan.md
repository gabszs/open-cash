# Agent Identity and MCP Authentication Implementation Plan

## Scope

Replace the current conversation-subject custom MCP token with Agent Auth identities backed by a per-user `UserIdentityDO`, while preserving the existing D1 ownership boundary.

This plan is for implementation only. The current session must not modify the existing implementation beyond this document.

## Final decisions

- D1 remains the ownership authority: `conversations.id -> conversations.userId`.
- `SHARED_KV` is an auxiliary bridge from the Flue conversation ID to the user ID.
- The KV key is exactly the conversation ID.
- The KV value is exactly the user ID:

  ```ts
  await env.SHARED_KV.put(conversationId, userId);
  ```

- There is no `agent/auth/conversation/` prefix and no JSON envelope in this first version.
- There is no `/ai/*` KV repair or refresh middleware.
- The existing `/ai/*` ownership check remains mandatory and continues to validate the conversation against the authenticated user's D1 record.
- The `user-id` header is removed from the Server-to-Agent request.
- Private keys remain inside the `UserIdentityDO` SQLite storage.
- JWTs are never stored in KV or `usePersistentState`.
- The `UserIdentityDO` source file is:

  ```text
  apps/agent/src/durable-objects/identityDO.ts
  ```

- Drizzle logging is always enabled in the DO:

  ```ts
  logger: true
  ```

## Phase 0 — Confirm the Agent Auth provisioning contract

Before coding the hook, verify the installed `@better-auth/agent-auth` API for creating a Host programmatically.

The public Host creation endpoint requires a Better Auth session. The `afterEmailVerification` callback has a verified user object, but it must not bypass the route or make an unauthenticated public request.

The implementation must choose a supported internal provisioning path that:

- associates the Host with `user.id`;
- accepts the public key returned by the DO;
- applies the default finance capabilities;
- creates or reactivates an existing Host idempotently;
- rejects a public key already linked to another user;
- does not expose private key material.

Do not make `/host/create` public and do not trust a caller-supplied user ID as authentication.

## Phase 1 — Infrastructure bindings

### Shared KV

Create a new KV namespace in:

- `infra/kv.ts`;
- `infra/workers/api.ts`;
- `infra/workers/agent.ts`.

Bind it as `SHARED_KV` in both Workers. Keep the existing `CACHE` binding unchanged because it is used by Better Auth and finance token caching.

Update the source-of-truth infrastructure and generated Wrangler/type declarations. Do not edit generated files as the only source of the binding.

### UserIdentityDO

Export the class from `apps/agent/src/cloudflare.ts` and add the namespace binding to the Agent Worker.

The Server Worker must also bind the same namespace externally using the Agent Worker script name, so the authentication hook can call the DO directly:

```jsonc
{
  "name": "USER_IDENTITY",
  "class_name": "UserIdentityDO",
  "script_name": "open-cash-finance-agent"
}
```

Update the corresponding Alchemy Worker resources and local Wrangler configuration. Validate local development with both Workers running and validate the production deployment order before deploying a new DO class.

Add the DO class to an append-only SQLite Durable Object migration. Never rewrite an already deployed migration tag.

## Phase 2 — Drizzle-backed UserIdentityDO

Create:

```text
apps/agent/src/durable-objects/identityDO.ts
apps/agent/src/db/doModels/
apps/agent/src/db/doMigrations/
```

Add `drizzle-orm` to the Agent package and use the Durable Object SQLite driver/migrator.

The constructor must:

1. create the Drizzle handle over `ctx.storage`;
2. use the DO schema;
3. set `logger: true`;
4. run migrations inside `ctx.blockConcurrencyWhile`.

Do not hold `blockConcurrencyWhile` across Agent Auth network calls.

### Tables

`host_identity`, one row per user:

```text
userId          primary key
hostId          nullable until Agent Auth registration completes
publicKey       JWK JSON
privateKey      JWK JSON, private to the DO
keyVersion
status
defaultCapabilities
createdAt
updatedAt
```

`agent_identity`, one row per conversation:

```text
conversationId  primary key
agentId         unique, returned by Agent Auth
hostId
publicKey       JWK JSON
privateKey      JWK JSON, private to the DO
status
capabilities
createdAt
updatedAt
```

The DO must expose only controlled metadata and signing operations:

```text
ensureHost()
bindHost(hostId)
ensureAgent(conversationId, capabilities)
signHostJwt(...)
signAgentJwt(agentId, audience)
getIdentityMetadata()
```

It must never return a private key.

`ensureHost` and `ensureAgent` must be idempotent. Persist a pending/active state before external registration where necessary, and rely on the Agent Auth public-key idempotency behavior to make retries safe.

## Phase 3 — Provision Host after e-mail verification

Configure `emailVerification.afterEmailVerification` inside the request-scoped `createAuth(c)` configuration in:

```text
apps/server/src/lib/auth.ts
```

The DO call must be direct, without an `ensureAgentHostForUser` wrapper:

```ts
afterEmailVerification: async (user) => {
  const identity = c.env.USER_IDENTITY.getByName(user.id);
  const host = await identity.ensureHost({
    defaultCapabilities: financeCapabilities,
  });

  // Register or reconcile the Host in Agent Auth using user.id and host.publicKey.
  // The returned Agent Auth hostId is then persisted directly in the DO.
  await identity.bindHost(hostId);
},
```

The hook must:

- use the verified `user.id` supplied by Better Auth;
- generate or reuse the Host keypair in the DO;
- register/reconcile the Host in Agent Auth;
- bind the returned `hostId` back into the DO;
- configure the default capabilities;
- remain safe when invoked more than once.

The hook is a side effect after the user update. If provisioning fails, the system must leave a retryable DO state and the first Agent bootstrap must fail closed rather than issue an unscoped token.

The module-level `auth = createAuth()` instance does not have request bindings. Ensure the e-mail verification route uses the request-scoped `createAuth(c)` instance for this hook.

## Phase 4 — Write the conversation KV record

In the authenticated conversation creation flow:

1. validate the connection and user ownership;
2. create the D1 conversation;
3. await `SHARED_KV.put(conversation.id, conversation.userId)`;
4. return the conversation.

The value must come from the D1/service result and never from request input.

Do not add a repair step to `requireOwnedAgentConversation` or the `/ai/*` route.

The Agent Worker must treat a missing KV value as a bootstrap failure. It must not guess the user from the request, accept the removed `user-id` header, or proceed without a user identity.

## Phase 5 — Register an Agent per conversation

The Agent resolves the user by:

```ts
const userId = await env.SHARED_KV.get(id);
if (!userId) throw new Error("Conversation identity not found");

const identity = env.USER_IDENTITY.getByName(userId);
```

`ensureAgent(conversationId, capabilities)` must:

1. load the Host identity for the user;
2. return the existing conversation Agent when present;
3. otherwise generate an Agent keypair in the DO;
4. sign a Host JWT inside the DO;
5. call Agent Auth registration with the Agent public key;
6. persist the returned `agentId` and status;
7. return only non-secret metadata.

Different conversations from the same user share the Host but have different Agents. Conversations from different users resolve to different UserIdentityDO instances.

## Phase 6 — Persistent state and MCP auth

In the Finance agent, add:

```ts
type AgentAuthState = {
  status: "ready";
  userId: string;
  hostId: string;
  agentId: string;
};
```

Persist it with `usePersistentState("agent-auth", null)`.

Use the complete readiness check:

```ts
const isReady =
  authState?.status === "ready" &&
  Boolean(authState.userId) &&
  Boolean(authState.hostId) &&
  Boolean(authState.agentId);
```

The same readiness check must be applied inside the MCP `auth` callback.

Because `useAgentStart` runs after MCP initialization, its setter does not update the `authState` variable captured by the current render. Use a render-local state and Promise cache:

```ts
let runtimeAuthState = authState;
let bootstrapPromise: Promise<AgentAuthState> | undefined;

const getAgentState = async () => {
  if (isReady(runtimeAuthState)) return runtimeAuthState;

  bootstrapPromise ??= ensureAgentIdentity(id, env);
  runtimeAuthState = await bootstrapPromise;
  return runtimeAuthState;
};
```

The `auth` callback must:

- use the persisted state when complete;
- call `ensureAgentIdentity` only when state is incomplete;
- reuse the local Promise during the current submission;
- call `signAgentJwt(agentId, audience)` for the MCP request.

`useAgentStart` must reuse `getAgentState()` and persist the returned metadata. It should not generate a second Agent or store a JWT.

A ready state avoids repeated registration/discovery calls. It does not eliminate JWT signing: the JWT remains short-lived and is signed when the Flue auth resolver is invoked.

## Phase 7 — Replace the custom token path

Update:

- `apps/agent/src/lib/agentToken.ts`;
- `apps/agent/src/agents/finance.ts`;
- `apps/server/src/lib/middleware.ts`;
- MCP authentication setup.

Remove the `agent.*` custom token format and its verifier after Agent Auth is validated.

Keep `AGENT_INTERNAL_SECRET` only for internal Server/Agent communication if still needed. It must no longer be the user authorization mechanism for MCP.

The MCP must derive:

```text
Agent JWT → Agent → Host → userId
```

Finance tools authorize by user. Conversation-specific file operations continue validating the conversation ID and ownership separately.

Remove the `user-id` header from the Server-to-Agent proxy entirely.

## Phase 8 — Tests and validation

Add tests for:

- e-mail verification provisioning a Host;
- repeated e-mail verification not creating a second Host;
- Host public key collision across users;
- one Host shared by multiple conversations of the same user;
- one Agent per conversation;
- concurrent `ensureAgent` calls returning the same Agent;
- missing KV value failing closed;
- D1 ownership still blocking another user before Agent forwarding;
- absence of the `user-id` header;
- `authState` complete path skipping `ensureAgent`;
- incomplete `authState` path bootstrapping once per submission;
- `useAgentStart` persisting metadata after the first bootstrap;
- private keys absent from KV, persistent state, responses, and logs;
- Agent JWT audience, subject, expiry, and capability validation;
- local external DO binding with both Workers running;
- fresh and existing Durable Object migrations;
- Agent and Server typechecks, tests, builds, and Wrangler dry runs.

## Implementation order

1. Confirm the supported internal Host provisioning API.
2. Add `SHARED_KV` and `USER_IDENTITY` bindings.
3. Add the `UserIdentityDO` and Drizzle migrations.
4. Implement Host and Agent idempotent operations.
5. Add direct `afterEmailVerification` provisioning.
6. Write `conversationId → userId` to `SHARED_KV` during conversation creation.
7. Remove the `user-id` header and KV repair middleware.
8. Add persistent Agent auth state and the render-local Promise cache.
9. Configure `useMcpConnection.auth` with readiness checking and DO signing.
10. Enable Agent Auth for MCP and remove the custom token path.
11. Run the full test and deployment validation sequence.
