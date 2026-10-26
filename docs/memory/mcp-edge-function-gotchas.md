# MCP edge function gotchas (`supabase/functions/mcp`)

## `createMcpHandler` takes a factory that RETURNS a server

`createMcpHandler(factory)` from `@modelcontextprotocol/server` v2 calls
`factory(requestCtx)` and expects an `McpServer` back. Writing
`createMcpHandler((server) => { server.registerTool(...) })` type-checks loosely
but fails every request. Build it inside: `() => { const server = new McpServer({...}); ...; return server; }`.

## Keep the `pipeline` handler inline and un-annotated

`pipeline([withOAuthProtectedResource(), withSupabase({ auth: 'user' })], handler)`
infers `ctx` from the entries. Annotating the handler's ctx parameter (or passing a
separately declared function) collapses it to `object` → TS2345.

## `withOAuthProtectedResource` needs `@supabase/server` >= 1.9

It is not exported by 1.4.x. The import is pinned to `npm:@supabase/server@^1.9.2`.

## Type-check / smoke-test without Docker or a global Deno

The repo root has a package.json, so Deno must be told to ignore `node_modules`:

```bash
npx -y deno@2 check --node-modules-dir=none supabase/functions/mcp/index.ts
```

Tool registration can be smoke-tested by importing the `register*Tools` modules
with a stub context and POSTing `tools/list` to `createMcpHandler(...).fetch`
directly (bypasses auth).

## Zod v4 `uuid()` is strict

Test fixtures need real RFC-4122 UUIDs (version/variant nibbles); `0000…0001`
fails validation. Real ids from `gen_random_uuid()` are fine.
