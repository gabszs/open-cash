# Add an Awaited Agent Initialization Hook

# Summary

Introduce a lifecycle hook that runs at the earliest stage of agent execution, before other agent hooks, model execution, tools, or external integrations are initialized. The hook should support asynchronous setup and provide a reliable place to prepare runtime state required by the agent.

# Background & Motivation

The current `useAgentStart` hook runs before the model, but it is not the earliest lifecycle phase. Some agents need to perform asynchronous initialization before any other part of the agent begins execution.

Examples include loading user or conversation context, initializing external resources, preparing credentials, or loading a JWT or access token required by an authenticated integration.

For example, an agent may need to:

- resolve its user or conversation identity;
- load credentials from a Durable Object or storage provider;
- refresh or generate a short-lived JWT;
- prepare authentication state for downstream operations;
- fail before execution if initialization cannot be completed.

`useAgentStart` is not an ideal abstraction for this purpose because it represents the start of message processing, rather than the initialization of the agent itself.

# Goals

- Add an asynchronous hook that runs before all other agent lifecycle work.
- Provide a reliable initialization point for agent-wide setup.
- Support loading, refreshing, or generating JWTs and access tokens.
- Support user-scoped, agent-scoped, and conversation-scoped initialization.
- Allow initialization results to be reused by subsequent agent operations.
- Fail early when required initialization cannot be completed.
- Support idempotent execution and safe retries.
- Preserve `useAgentStart` for per-message preparation before the model runs.

# Example

The exact API is illustrative:

```ts
useAgentInitialize(async ({ id, env }) => {
  const identity = await loadAgentIdentity(id, env);

  const token = await loadOrRefreshAccessToken({
    userId: identity.userId,
    agentId: identity.agentId,
    env,
  });

  return {
    userId: identity.userId,
    agentId: identity.agentId,
    accessToken: token,
  };
});
```

The important contract is that the initialization callback is awaited before any other agent lifecycle work begins, and that its result can be accessed by the agent and its integrations.
