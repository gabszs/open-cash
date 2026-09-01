# Desenvolvimento, migrations e deploy

## Pré-requisitos

- Bun e dependências instaladas com `bun install` na raiz.
- Secrets locais fora do Git.
- Para o Server: `AUTH_SECRET` e `FINANCE_ENCRYPTION_KEY` em `apps/server/.dev.vars`.
- Para o Agent: `FINANCE_MCP_URL` em `apps/agent/.dev.vars`.
- Para o deploy Alchemy: `OPEN_CASH_WEB_HOSTNAME`, `OPEN_CASH_API_HOSTNAME` e os secrets do `.env` raiz.
- Docker somente quando for testar o Sandbox local ou executar integrações que usam o S3 de teste.

## Loop local recomendado

```sh
cd apps/server
bun dev
```

O comando aplica as migrations do D1 local e inicia, em paralelo, o Agent via Vite/Cloudflare e o Server via Wrangler. O Service Binding é descoberto automaticamente; o Server fica em `http://localhost:8787` e o Agent de desenvolvimento em `http://localhost:8788`.

Alternativas:

```sh
bun run dev:worker      # somente Server
bun run dev:wrangler    # build do Agent e multi-worker em um Wrangler
cd ../agent && bun run dev:wrangler
```

## Banco

```sh
cd apps/server
bun run db:generate -- nome_da_migration
bun run db:migrate:local
bun run db:studio
bun run db:migrate      # remoto; exige credenciais Cloudflare
```

Não edite migrations já aplicadas. Gere uma nova migration para cada alteração de schema.

## Build e validação

```sh
bun run typecheck
bun run lint:check
bun run --cwd apps/web build
bun run --cwd apps/agent build
bun run --cwd apps/server test:all
```

## Infraestrutura e deploy

`infra/d1.ts`, `infra/workers/*.ts` e `alchemy.run.ts` declaram D1, bindings,
migrations, Workers e Sandbox. O `wrangler.jsonc` local é uma projeção gerada
da infraestrutura para desenvolvimento.

O fluxo oficial é executado na raiz com `bun x alchemy deploy`; ele constrói e
publica o Agent, provisiona o Sandbox, conecta `AGENT_SERVICE`, publica o API e
publica o Web. O deploy isolado do Agent existe, mas não é o caminho principal
da plataforma.

Consulte o [guia completo de deploy](../DEPLOY.md) para stages, secrets,
migrations, plan e verificação pós-deploy. Não use o endereço local de
`FINANCE_MCP_URL` em produção.
