# Finance MCP e API — referência

O domínio Finance possui uma única fachada, `FinanceService`. Rotas Hono e tools MCP são adapters finos sobre os mesmos métodos, evitando divergência de regra de negócio.

## Capacidades canônicas

As 16 tools são: `getAccounts`, `getBalanceByAccount`, `getBalance`, `getTransactions`, `listTransactions`, `getTransactionDetails`, `getInvestments`, `setCategory`, `setCounterpartyCategory`, `listClosingDays`, `setClosingDay`, `deleteClosingDay`, `getBills`, `getBillSummary`, `listInstalmentPlans` e `listSources`.

As rotas equivalentes vivem em `/v1/finance/**` e aparecem no OpenAPI do Server. Conexões Pluggy são administradas pelo mesmo service; client secrets ficam criptografados no D1 e nunca retornam em respostas.

## Identidade

Toda consulta recebe o `userId` autenticado. O MCP aceita três origens de identidade:

- cookie de sessão Better Auth;
- API key pessoal do plugin Better Auth;
- token interno curto, assinado pelo Server/Agent e escopado ao usuário.

IDs de conta, conexão, transação e preferências sempre são filtrados por esse proprietário. O Agent não escolhe credenciais: ele recebe um escopo autenticado e o MCP resolve apenas as conexões daquele usuário.

## Regras relevantes

- valores monetários permanecem em representação decimal/cents sem conversão intermediária insegura para float;
- cursores são vinculados aos filtros da consulta;
- saldos de moedas diferentes não são somados silenciosamente;
- credenciais Pluggy são cifradas em repouso;
- operações de mutação exigem confirmação do usuário no prompt do Agent;
- falhas Pluggy são traduzidas para Problem Details sem expor secrets.

## Onde alterar

- contrato HTTP e OpenAPI: `apps/server/src/features/finance/routes.ts`;
- MCP: `apps/server/src/features/finance/mcp.ts`;
- regras e orquestração: `apps/server/src/features/finance/service.ts`;
- persistência D1: `apps/server/src/features/finance/repository.ts`;
- schemas: `apps/server/src/features/finance/schemas.ts`;
- integração Pluggy: `apps/server/src/features/finance/pluggy`.
