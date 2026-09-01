# Frontend — clientes, autenticação e chat

## Clientes oficiais

O browser usa uma única origem configurável por `VITE_SERVER_URL`:

| Superfície   | Cliente                             | Base path                   |
| ------------ | ----------------------------------- | --------------------------- |
| Finance HTTP | `hc` de `hono/client`               | `/v1/finance`               |
| Autenticação | `createAuthClient` do Better Auth   | `/v1/auth`                  |
| Preferências | `createORPCClient` + TanStack Query | `/orpc`                     |
| Agente       | `createFlueClient` + `useFlueAgent` | `/ai/finance/:sessionId` |

Todos enviam credenciais ao Server. Não existe `VITE_AGENT_URL`.

## Sessões de conversa

`/app` começa com chat vazio. Uma conversa e seu ID escopado ao usuário são criados somente quando a primeira mensagem é enviada. O sidebar apresenta o índice das conversas recentes, permite abrir uma sessão e remover a entrada local; o botão de novo chat retorna ao estado vazio.

A página de sessão usa SSE, exibe status, histórico durável retornado pelo Flue, tool calls, raciocínio, gráficos e arquivos. Também oferece reconexão, retry de envio e abort da execução.

O Flue 2 não oferece uma rota HTTP de exclusão de conversa. Por isso, “excluir” no sidebar remove apenas a referência recente do navegador; essa distinção deve permanecer explícita até existir uma API durável de deleção.

## Autenticação e configurações

As rotas protegidas aguardam `authClient.getSession()` no guard. Usuários sem sessão vão para sign-in preservando um redirect interno seguro. A área de configurações reúne perfil, 2FA e sessões com localização/IP Cloudflare, API keys, conexões Open Finance, inventário de rotas e administração condicional ao papel admin.
