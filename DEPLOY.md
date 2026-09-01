# Open Cash — deploy

Este documento descreve o deploy da plataforma Open Cash em Cloudflare. O
fluxo usa Bun e Alchemy como caminho principal de infraestrutura; Wrangler é
usado para desenvolvimento local, geração de tipos e migrations explícitas.

## 1. Pré-requisitos

- Bun instalado na versão indicada pelo `packageManager` do `package.json`.
- Docker ativo para construir o Sandbox do Agent.
- Uma conta Cloudflare com acesso a Workers, D1, KV, R2, Durable Objects,
  Workers AI/AI Gateway, Containers e Email Routing.
- Uma zona Cloudflare para os hostnames públicos escolhidos.
- Uma conta Pluggy e as credenciais de aplicação dos usuários que serão
  conectados à plataforma.

O Agent é privado e não recebe hostname público. O Web e o API recebem os
hostnames definidos por `OPEN_CASH_WEB_HOSTNAME` e
`OPEN_CASH_API_HOSTNAME`.

## 2. Instalação e arquivos de ambiente

Na raiz do projeto:

```sh
bun install
cp .env.example .env
cp apps/server/.dev.vars.example apps/server/.dev.vars
cp apps/agent/.dev.vars.example apps/agent/.dev.vars
cp apps/web/.env.example apps/web/.env
```

Não substitua um `.env` existente sem fazer backup. O arquivo é local e
ignorado pelo Git.

### `.env` da raiz

É lido pelo Alchemy e contém configuração de deploy:

| Variável | Uso |
| --- | --- |
| `OPEN_CASH_WEB_HOSTNAME` | domínio do Web Worker |
| `OPEN_CASH_API_HOSTNAME` | domínio do API Worker |
| `AUTH_SECRET` | assinatura das sessões Better Auth |
| `FINANCE_ENCRYPTION_KEY` | criptografia dos secrets Pluggy armazenados no D1 |
| `CORS_ORIGIN` | origens permitidas pelo API e pelo CORS do R2 |
| `EMAIL_FROM_ADDRESS` | remetente; o domínio precisa estar habilitado no Email Routing |
| `FINANCE_MCP_URL` | URL pública do `/mcp` usada pelo Agent em produção |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | opcional: habilita o login com GitHub |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | opcional: habilita o login com Google |

As credenciais Cloudflare podem vir do perfil do Alchemy ou de variáveis de
ambiente. Consulte `.env.example` para `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_API_KEY` e as variáveis opcionais do Drizzle Studio.

Gere secrets fortes e diferentes por ambiente. `AUTH_SECRET` e
`FINANCE_ENCRYPTION_KEY` não devem ser compartilhados entre instalações. A
troca de `FINANCE_ENCRYPTION_KEY` torna ilegíveis as credenciais Pluggy já
seladas.

O login social é opcional. Cada provider só é registrado quando as duas
variáveis do par estão preenchidas; com qualquer uma vazia o Better Auth ignora
o provider e `POST /v1/auth/sign-in/social` responde erro para ele. Registre o
OAuth app com a callback apontando para a **API**, não para o front:

| Provider | Callback de produção |
| --- | --- |
| GitHub | `https://api.open-cash.dev/v1/auth/callback/github` |
| Google | `https://api.open-cash.dev/v1/auth/callback/google` |

Em desenvolvimento troque a origem por `http://localhost:8787`. No Google, a
origem JavaScript autorizada é a do front (`https://open-cash.dev`).

O binding é resolvido no deploy: `infra/workers/api.ts` só declara o segredo
quando as duas variáveis existem no ambiente, então nada vazio é enviado à
Cloudflare. Preencher o `.env` depois exige um novo deploy para o provider
passar a existir. Os nomes continuam listados em `secrets.required` na
`wrangler.jsonc` gerada — é o que mantém o tipo `Env` igual em quem nunca
configurou OAuth; o Wrangler apenas avisa sobre o segredo ausente.

### `apps/server/.dev.vars`

É usado pelo Wrangler no Server local:

```dotenv
AUTH_SECRET=um-secret-local-com-32-ou-mais-caracteres
FINANCE_ENCRYPTION_KEY=outra-chave-local-com-32-ou-mais-caracteres
```

### `apps/agent/.dev.vars`

É usado pelo Agent local:

```dotenv
FINANCE_MCP_URL=http://localhost:8787/mcp
```

Em produção, a URL deve apontar para o domínio do API Worker.

### `apps/web/.env`

O Web precisa apenas da origem do API:

```dotenv
VITE_SERVER_URL=https://api.example.com
```

Valores prefixados com `VITE_` são incorporados no bundle do navegador. Nunca
coloque secrets nesse arquivo.

## 3. Configuração do Pluggy por usuário

O Open Cash não usa `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` ou
`PLUGGY_ITEM_IDS` globais no `.env`. Essas variáveis fazem sentido no fluxo
single-user do `cata-centavo`, mas fariam todos os usuários compartilharem a
mesma conexão e não correspondem ao modelo atual da plataforma.

Cada usuário autenticado cadastra uma ou mais conexões em **Settings → Open
Finance → New connection**. Para cada conexão, informe:

- um nome identificável, como `Meu banco principal`;
- o `clientId` e o `clientSecret` da aplicação Pluggy;
- um ou mais `itemId`s, separados por vírgula na interface.

O fluxo recomendado para obter esses valores é:

1. criar/acessar a aplicação no Pluggy;
2. conectar as contas bancárias desejadas no Pluggy/Meu Pluggy;
3. copiar o `clientId` e o `clientSecret` da aplicação;
4. copiar o `itemId` de cada item conectado;
5. salvar os valores na tela de conexão do Open Cash.

Também é possível criar a conexão pela API autenticada:

```sh
curl -X POST "https://$OPEN_CASH_API_HOSTNAME/v1/connections" \
  -H "Content-Type: application/json" \
  -H "Cookie: <sessao-do-usuario>" \
  -d '{
    "name": "Meu banco principal",
    "clientId": "<pluggy-client-id>",
    "clientSecret": "<pluggy-client-secret>",
    "itemIds": ["<item-id-1>", "<item-id-2>"]
  }'
```

Ao salvar, o API valida os itens com o Pluggy, sela o `clientSecret` usando
`FINANCE_ENCRYPTION_KEY` antes de persistir no D1 e nunca devolve o secret nas
respostas. O cache temporário da API key do Pluggy é separado por `userId` e
`connectionId`. Portanto, não coloque credenciais Pluggy em `.env`,
`wrangler.jsonc` ou no código-fonte.

`FINANCE_ENCRYPTION_KEY` é uma chave do Open Cash para proteger os secrets
armazenados; ela não substitui o `clientSecret` do Pluggy. Se essa chave for
trocada sem uma migração planejada, as credenciais Pluggy já seladas não
poderão ser lidas.

## 4. Autenticação do Alchemy

A opção recomendada é configurar o perfil do Alchemy:

```sh
bun x alchemy login --configure --env-file .env
```

Também é possível fornecer uma credencial Cloudflare escopada no `.env`. Use o
menor conjunto de permissões compatível com os recursos da stack e nunca
coloque um token no `wrangler.jsonc` ou no código.

## 5. Checks antes do deploy

Execute os checks sem alterar o estado remoto:

```sh
bun run typecheck
bun run lint:check
bun run --cwd apps/web build
bun run --cwd apps/agent build
bun run --cwd apps/server test:all
bun x alchemy plan --stage prod --env-file .env
```

O `plan` deve ser revisado antes de confirmar qualquer mudança. Confira com
atenção alterações em D1, R2, KV e Durable Objects. Uma mudança de nome ou
classe de Durable Object pode afetar estado persistente.

## 6. Deploy da stack

O deploy oficial é executado na raiz:

```sh
bun x alchemy deploy --stage prod --env-file .env
```

O Alchemy executa o build do Agent, publica o Agent privado, provisiona o
Sandbox, cria/atualiza o API Worker com o `AGENT_SERVICE` e publica o Web Worker.
Ao final, também atualiza o `apps/server/wrangler.jsonc` gerado.

Depois de revisar o primeiro prompt/plan da instalação, `--yes` pode ser usado
em automações controladas:

```sh
bun x alchemy deploy --stage prod --env-file .env --yes
```

Não use `--yes` para uma mudança cujo plan não foi inspecionado.

O comando `apps/agent bun run deploy` é um caminho de baixo nível para publicar
o bundle do Agent isoladamente. Ele não é o fluxo recomendado da plataforma,
porque o binding `AGENT_SERVICE`, o Sandbox e os recursos compartilhados são
coordenados pelo `alchemy.run.ts`.

## 7. Migrations do D1

As migrations ficam em `apps/server/src/db/migrations` e são declaradas no
recurso D1 da stack. Elas são append-only:

- nunca renomeie uma migration já aplicada;
- nunca reutilize uma tag ou execute novamente SQL destrutivo sob outro nome;
- gere uma nova migration para cada alteração de schema;
- verifique o plan antes de aplicar qualquer alteração remota.

Para aplicar/reconciliar explicitamente o binding remoto depois que o Wrangler
foi gerado pelo Alchemy:

```sh
bun run db:migrate
```

Para desenvolvimento local:

```sh
bun run --cwd apps/server db:migrate:local
```

Para Drizzle Studio no D1 remoto, preencha no `.env` as variáveis
`CLOUDFLARE_D1_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID` e
`CLOUDFLARE_D1_API_TOKEN`, e então execute:

```sh
bun run --cwd apps/server db:studio:prod
```

## 8. Verificação pós-deploy

Substitua os hostnames pelos valores do seu ambiente:

```sh
curl --fail --silent --show-error https://api.example.com/health
curl --fail --silent --show-error https://api.example.com/open-api.json
```

Verifique também:

1. o Web abre no hostname configurado;
2. cadastro, verificação de e-mail e login funcionam;
3. uma conexão Pluggy pode ser criada sem que o client secret apareça na resposta;
4. contas, transações e cartões ficam limitados ao usuário e à conexão selecionada;
5. uma conversa chega ao Agent através do `AGENT_SERVICE`;
6. o Agent consegue chamar `/mcp` com seu JWT interno;
7. uploads e arquivos publicados chegam ao bucket R2;
8. o log do Agent não expõe tokens, client secrets ou cookies.

Uma resposta HTTP 200 do health check não prova o fluxo completo de autenticação,
Pluggy, Agent, MCP ou R2. Faça pelo menos um smoke test autenticado antes de
considerar o ambiente pronto.

## 9. MCP e OAuth

O `/mcp` atual é uma superfície interna e autenticada da própria plataforma.
Ele permite que o Agent opere com o usuário e a conexão da conversa, mas não
oferece ainda o fluxo OAuth necessário para um cliente MCP externo descobrir a
autorização, obter consentimento e receber tokens próprios.

O roadmap de OAuth deve preservar o isolamento multiusuário: cada token
externo precisará carregar identidade, escopos e vínculo com um usuário Open
Cash, e cada chamada deverá reconstruir o escopo antes de acessar Pluggy. Até
essa implementação, não anuncie `/mcp` como integração externa pública.

## 10. Ambientes e limpeza

Use stages diferentes para evitar que desenvolvimento e produção compartilhem
recursos ou estado:

```sh
bun x alchemy plan --stage dev_seu-nome --env-file .env
bun x alchemy plan --stage prod --env-file .env
```

`alchemy destroy` é destrutivo. Antes de executá-lo, confirme o stage exato,
revise o plan e faça backup/export do que precisar preservar, especialmente D1,
R2 e Durable Objects.

## Referências

- [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare Workers environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [README](README.md)
