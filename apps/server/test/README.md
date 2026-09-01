# API integration tests

The suite runs with Vitest inside the Cloudflare Workers runtime. A single global setup starts
Postgres and MinIO with Testcontainers, applies the PostgreSQL migration, creates the S3 bucket,
and injects the generated endpoints into Miniflare.

```sh
bun test              # Bun unit tests
bun run test           # Cloudflare integration tests
bun run test:all       # Both suites
bun run test:watch     # Cloudflare integration tests in watch mode
bun run test:typecheck
```

Docker (or another Testcontainers-compatible container runtime) must be running. The test files
run in parallel and use unique users and identifiers so they can safely share the two containers.

Cloudflare integration files use the `*.integration.ts` suffix so Bun's native runner does not
collect them. They must run through `bun run test`, which launches Vitest with the Workers Pool.

Tests under `test/src/features/properties` are intentionally excluded for now.
