# Agent — roteamento, streaming e ferramentas

## Responsabilidade

`apps/agent` é um Worker Flue 2 privado. Em produção ele não recebe subdomínio `workers.dev` nem preview URL; o ingresso autorizado é o Service Binding do Server. A autenticação de usuário permanece no Server.

O projeto explicita descoberta e build em `flue.config.ts`: agents em `src/agents`, app Hono próprio, exports Cloudflare, provider OpenAI, target Cloudflare e tracing habilitado. `vite.config.ts` compõe os plugins oficiais do Flue e Cloudflare.

## Rotas internas

Montagem em `src/app.ts`:

| Método       | Rota                                           | Uso                 |
| ------------ | ---------------------------------------------- | ------------------- |
| `GET`        | `/ai/health`                                | saúde interna (não exposta pelo Server) |
| `POST`       | `/ai/finance/:id`                           | enviar mensagem     |
| `GET`/`HEAD` | `/ai/finance/:id`                           | ler estado e stream |
| `POST`       | `/ai/finance/:id/abort`                     | abortar execução    |
| `GET`        | `/ai/finance/:id/attachments/:attachmentId` | ler attachment      |

O Agent não valida nada: ele é alcançável apenas pelo binding `AGENT_SERVICE` e confia no Server, que é quem resolve a propriedade da conversa contra o banco antes de encaminhar. O header `user-id` que chega junto é produzido pelo Server depois da autenticação e serve só para logs e traces. `/ai/health` só é alcançável dentro da rede de Workers — pelo Server ela cai no gate de conversa e responde 404.

## SSE

O frontend usa `useFlueAgent({ live: "sse" })`. O SDK abre a visualização de updates com offset, processa heartbeats, deduplica eventos e retoma o stream. O Server encaminha o `Response` sem consumir o body e o CORS expõe `Stream-Next-Offset`, `Stream-Up-To-Date` e `Location`.

Cada nova conversa recebe um ID novo somente no primeiro envio. A rota inicial do chat fica vazia. No chat existente o usuário pode atualizar/reconectar, tentar novamente um envio falho e chamar `abort()` para interromper execuções ativas ou enfileiradas.

## FinanceAgent

O agent registra:

- modelo OpenAI e skill de análise financeira;
- estado persistente por conversa;
- MCP com as 16 ferramentas Finance canônicas;
- token interno curto e assinado, escopado ao usuário extraído da conversa;
- data writers para gráficos e artefatos renderizados no chat;
- Sandbox Cloudflare para CSV, JSON e Markdown;
- hooks de início/fim, métricas de uso, tentativas duráveis e timeout.

O endereço `FINANCE_MCP_URL` é configuração de ambiente do Agent. Nenhum valor real deve entrar no repositório.

O loop local padrão mantém containers desabilitados para funcionar sem Docker. Isso não remove a configuração de Sandbox do deploy. Para testar geração de arquivos localmente, habilite containers e mantenha o daemon Docker ativo.
