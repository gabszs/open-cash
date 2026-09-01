# Open Cash — visão geral

Open Cash é uma plataforma de Open Finance com uma interface autenticada, painéis financeiros e um agente de IA privado. Não existe landing page pública: o frontend protege a área `/app` e envia usuários sem sessão para sign-in.

## Arquitetura

```text
Browser
  │ Better Auth cookie / API key
  ▼
Server Worker (Hono, Better Auth, oRPC, Finance MCP)
  ├── D1 + Drizzle: usuários, sessões, configurações e domínio financeiro
  ├── Pluggy: dados Open Finance por credencial criptografada do usuário
  └── AGENT_SERVICE Service Binding
          ▼
      Agent Worker privado (Flue 2)
          ├── Durable Objects: conversas e execução durável
          ├── SSE: resposta incremental e retomada por offset
          ├── Finance MCP: ferramentas limitadas ao usuário autenticado
          └── Sandbox: arquivos e análises isoladas
```

O browser nunca chama o Agent diretamente. Todas as rotas de IA usam `/ai/**` no Server; depois de autenticar a sessão e validar a propriedade da conversa contra a tabela `conversations`, o Server encaminha o request pelo binding privado `AGENT_SERVICE`. O encaminhamento é um clone da request original com um único header acrescentado, `user-id`, que o Server sobrescreve — o cliente não consegue forjá-lo. Os demais headers seguem inalterados.

## Superfícies principais

- Better Auth: `/v1/auth/**`, com email/senha, 2FA, sessões, administração e API keys.
- Finance HTTP/OpenAPI: `/v1/finance/**`.
- Finance MCP: `/mcp`, autenticável por sessão, API key ou token interno curto do Agent.
- oRPC: `/orpc/**` e `/orpc-openapi/**` para preferências e perfil.
- Flue: `/ai/finance/:conversationId` e subrotas de abort e attachments.
- Documentação de API: `/docs`, `/open-api.json` e `/open-api/orpc.json`.

## Persistência

O Server usa exclusivamente Cloudflare D1 através de Drizzle. A migration inicial está em `apps/server/src/db/migrations/0000_initial_d1.sql` e cobre Better Auth, preferências e o domínio Finance. O recurso D1 é declarado em `infra/d1.ts`; Alchemy aplica as migrations declaradas por `migrationsDir` ao provisionar a infraestrutura.

As conversas pertencem aos Durable Objects do Flue. A lista recente mostrada no sidebar é um índice local por usuário; removê-la da interface não apaga o histórico durável, pois o protocolo Flue 2 não expõe endpoint HTTP de exclusão de conversa.

## Guias técnicos

- [Deploy e configuração](../DEPLOY.md)
- [Agent, rotas e SSE](./agent/ROTEAMENTO_E_STREAMING.md)
- [Server, D1, autenticação e bindings](./server/ARQUITETURA.md)
- [Testes do Server](./server/TESTES_DE_INTEGRACAO.md)
- [Frontend, clientes RPC e chat](./frontend/CLIENTES_E_CHAT.md)
- [Desenvolvimento e deploy](./DESENVOLVIMENTO.md)
- [Finance MCP e domínio](./finance-mcp-api-handoff.md)
