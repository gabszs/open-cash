# Server — autenticação, D1 e Service Binding

## Pipeline HTTP

O Server é o limite público da aplicação. CORS, rate limiting, Drizzle, Better Auth e autenticação de sessão são montados antes de `/v1/**`, `/ai/**`, `/orpc/**`, `/orpc-openapi/**` e `/mcp`.

O Better Auth usa `withCloudflare` com:

- adapter Drizzle/D1 e tabelas plurais;
- KV como secondary storage;
- coleta de IP e geolocalização da propriedade `Request.cf`;
- email/senha, 2FA, administração e API keys;
- R2 e campos Cloudflare presentes no modelo de sessão.

O `baseURL` é derivado da origem real de cada request no runtime. A configuração sem Context existe apenas para o CLI de geração de schema.

## D1 e Drizzle

`getDb(env)` cria `drizzle(env.DATABASE, { schema, casing: "snake_case" })`. Não há cliente PostgreSQL, connection string ou Hyperdrive no runtime.

Arquivos de referência:

- schema agregado: `src/db/models/index.ts`;
- Better Auth: `src/db/models/authModels.ts`;
- preferências: `src/db/models/userSettings.ts`;
- Finance: `src/features/finance/connections/model.ts`;
- migrations: `src/db/migrations`;
- Drizzle Kit: `drizzle.config.ts`.

Em desenvolvimento, Drizzle Kit procura o SQLite criado pelo Wrangler em `.wrangler`. `bun run db:migrate:local` aplica migrations ao D1 local; `bun run db:migrate` aplica ao binding remoto.

## Proxy privado de IA

`src/index.ts` registra `/ai/**` após Better Auth, em duas linhas: o middleware
`requireOwnedAgentConversation` (em `src/lib/middleware.ts`) e o repasse. A camada:

1. obtém o usuário da sessão validada;
2. resolve `/ai/{feature}/{conversationId}` e exige uma linha em `conversations` para aquele
   usuário e aquela feature, respondendo 404 caso contrário — a validação é delegada ao
   `ConversationsService`, única autoridade sobre ownership;
3. clona a request (`new Request(original, { headers })`) e faz `set` em `user-id`, sobrescrevendo
   o que o cliente tenha mandado. Nenhum outro header é alterado;
4. chama `env.AGENT_SERVICE.fetch()`, preservando método, query e body;
5. devolve o response original para preservar SSE e backpressure.

Há um único Worker de agent, e é o `app.ts` dele que decide qual agent responde por rota. O
segmento `{feature}` existe para isso e para amarrar a conversa à sua feature; o Server não mapeia
feature para binding.

O Worker Agent precisa existir antes do deploy do Server que referencia o binding. O Agent fica sem URL pública em produção (`workers_dev: false`, `preview_urls: false`).

## Clientes consumidos pelo frontend

- Hono RPC `hc`: Finance HTTP.
- Better Auth React client: sessão, perfil, 2FA, admin e API keys.
- oRPC fetch link: preferências pessoais.
- Flue SDK: conversas e SSE, sempre apontando ao Server.
