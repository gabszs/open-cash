# Finance agent

Private Flue 2 Worker for durable financial conversations. Browsers never call this Worker
directly: the Server authenticates `/ai/**` and forwards the request through its
`AGENT_SERVICE` Service Binding to the same path on this Worker.

## Model routing

Model calls go through the `AI` binding — `env.AI.run(...)` — so there is no API key and no
external provider account: authorization and billing follow the Worker, and third-party
models are covered by [Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/)
credits on the account.

`useModel("cloudflare/dynamic/low-budget")` passes everything after `cloudflare/` to the
binding as the model id — here the `low-budget`
[AI Gateway dynamic route](https://developers.cloudflare.com/ai-gateway/features/dynamic-routing/),
which owns model selection, caching, rate limiting, retries and budget caps.
[src/app.ts](src/app.ts) re-registers `cloudflareBindingProvider()` only to name the
`open-cash-gateway` gateway instead of the account's `default` one; drop that call to fall back to
Flue's generated default, or pass `gateway: false` to bypass the gateway entirely.

Because the route picks a different upstream model per request, the id is outside pi-ai's
catalog and resolves with zero metadata: no `thinkingLevel` is sent, images degrade to text
placeholders, per-token cost is not accounted in agent telemetry (the gateway dashboard has
it), and `contextWindow` is `0`, so threshold-based compaction cannot engage — long
conversations rely on the route's own limits. A startup `[flue]` warning states this. Pin a
concrete model (`cloudflare/@cf/…`, `cloudflare/openai/…`) when you need that metadata back.

## Conversation files

Agent work runs in a real Linux container through Cloudflare Sandbox. The image is pinned to
the same `0.12.5` version as `@cloudflare/sandbox` and extends the Python variant with
`openpyxl`, `python-docx`, `pypdf`, `PyMuPDF` and `reportlab` for XLSX, DOCX and PDF work.

Container files are intentionally treated as ephemeral: Cloudflare stops an idle sandbox and
its local filesystem is then reset. Browser uploads and published outputs therefore live in
the `R2` R2 binding under `conversations/{conversationId}/files/{fileId}`. Filename,
kind (`upload` or `output`), MIME type and SHA-256 live in R2 object metadata. The `open_file`
tool hydrates a working copy into the container; `publish_file` stores the result and emits an
authenticated download card in the chat. Files are limited to 20 MiB and supported extensions
are `.xlsx`, `.docx`, `.pdf`, `.csv`, `.json`, `.md` and `.txt`.

Key layout, object metadata and the accepted formats all come from `@open-cash/files`, which
this Worker shares with the API. The HTTP surface belongs to the API alone —
`PUT|GET|DELETE /v1/conversations/:conversationId/files/:fileId` and
`GET /v1/conversations/:conversationId/files` — because that is where conversation ownership is
enforced. This Worker keeps only the tools that need the container in-process, and it reaches
the bucket through the same shared service so both sides agree on what a stored file is.

## Local development

1. Copy `.dev.vars.example` to `.dev.vars` and set the service-token secrets.
2. Start this Worker with `bun run dev`, then the Server on port `8787`, and the web app on
   `5055`. The web app needs only `VITE_SERVER_URL`.

`workers_dev` and preview URLs are disabled, so the Agent has no public Cloudflare URL. Its
`FINANCE_MCP_URL` is used only for Agent-to-Server MCP calls. The Access service-token
credentials are used only for that Worker-to-Worker request.

Docker must be running for local container development and for Wrangler to build/deploy the
image. The first image build can take a few minutes. Cloudflare Containers access is also
required on the target account.

## Validation and deployment

- `bun run typecheck`
- `bun test` in `packages/files`, which owns the conversation-file rules this Worker uses
- `bun run build`
- `bun run deploy:dry-run`
- `bun run deploy` after configuring the production MCP URL and secrets

The generated Worker output is written to `dist/open_cash_finance_agent`, including the Flue Durable Object
binding. Rerun `bun run typegen` after editing `wrangler.jsonc`.
Deploy the Agent first, then the Server that owns the `AGENT_SERVICE` binding.
