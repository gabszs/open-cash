# Server — testes

## Camadas

`bun run test:unit` executa contratos rápidos em Bun. A cobertura atual inclui proxy do Agent, assinatura do token interno, transporte MCP, lista das 16 tools, criptografia de credenciais, regras de domínio e resiliência Pluggy.

`bun run test` usa Vitest no runtime Cloudflare. Cada arquivo recebe um D1 isolado e aplica `src/db/migrations` com `applyD1Migrations`. O pool também configura bindings locais de KV, R2, rate limit e um Fetcher não roteável para `AGENT_SERVICE`. O rate limit é elevado no ambiente de teste: em produção são 20 requisições por 10s com chave no IP do cliente, e todos os testes compartilham um IP vazio, então arquivos maiores falhavam com 429 no lugar da própria asserção. O proxy de IA nunca é encaminhado nos testes — o gate de propriedade responde 404 antes disso.

As integrações cobrem saúde e bindings, Better Auth, perfil/sessões, preferências oRPC e rotas Finance. O setup global inicia apenas o serviço S3 compatível necessário aos testes de arquivos; PostgreSQL não faz mais parte da suíte.

## Comandos

```sh
cd apps/server
bun run test:unit
bun run test:typecheck
bun run test
bun run test:all
```

Warnings de sourcemap vindos de dependências não representam falha. O critério de sucesso é exit code zero e todos os testes reportados como pass.
