# App Reconstructor Reference

## Output

```
chimera-clone/
├── package.json                  Root, pnpm workspaces
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── README.md
├── apps/
│   ├── api/
│   │   ├── package.json          @chimera-clone/api
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── index.ts          Express bootstrap (one mount per entity)
│   │       ├── db/
│   │       │   ├── client.ts     drizzle + pg pool
│   │       │   └── schema.ts     (copied from .chimera/model/schema.ts)
│   │       └── routes/
│   │           └── <table>.ts    One file per entity (LLM fills in)
│   └── web/
│       ├── package.json          @chimera-clone/web
│       ├── tsconfig.json
│       ├── vite.config.ts        proxies /api -> :4000
│       ├── index.html
│       └── src/
│           ├── main.tsx          React 19 root + BrowserRouter
│           ├── App.tsx           Routes generated from screens.json
│           ├── pages/
│           │   └── <Name>.tsx    One per screen (LLM fills in)
│           └── lib/
│               └── api.ts        Typed fetch client (LLM fills in)
└── packages/
    └── shared/
        ├── package.json          @chimera-clone/shared
        ├── tsconfig.json
        └── src/
            └── schemas.ts        Zod schemas per entity (LLM fills in)
```

## Stack versions

The scaffold pins to current major versions:

| Package | Version |
|---------|---------|
| React | ^19.0.0 |
| Vite | ^5.4.0 |
| TypeScript | ^5.4.0 |
| Express | ^4.19.0 |
| drizzle-orm | ^0.31.0 |
| drizzle-kit | ^0.22.0 |
| pg | ^8.12.0 |
| zod | ^3.23.0 |
| react-router-dom | ^6.26.0 |

These are starting points — bump them when generating the clone for a real project.

## What scaffold.mjs does

1. Reads `.chimera/model/entities.json` (fails fast if missing).
2. Reads `.chimera/func-map/screens.json` (continues without web stubs if missing).
3. Creates the directory tree.
4. Writes templated root files (package.json, pnpm-workspace.yaml, tsconfig.base.json, .gitignore, README.md).
5. Writes `apps/api/` boilerplate: package.json, tsconfig, drizzle.config.ts, index.ts (with one route mount per entity), db/client.ts.
6. Copies `.chimera/model/schema.ts` to `apps/api/src/db/schema.ts`.
7. Writes one `routes/<table>.ts` stub per entity with a `TODO(chimera)` marker.
8. Writes `apps/web/` boilerplate: package.json, tsconfig, vite.config.ts, index.html, main.tsx.
9. Generates `apps/web/src/App.tsx` with react-router-dom routes from `screens.json`.
10. Writes one `pages/<Name>.tsx` stub per screen with data dependencies + actions inlined as comments.
11. Writes `apps/web/src/lib/api.ts` stub.
12. Writes `packages/shared/` boilerplate + `src/schemas.ts` stub.
13. Returns `{ status, entities_scaffolded, screens_scaffolded, files_written, llm_todos }`.

## Idempotency

The script aborts if `chimera-clone/` exists. Pass `--force` to overwrite. Force-overwrite **does not** preserve hand-written code in route/page files — they're treated as scaffold files. Commit before re-running with force.

## Where the LLM takes over

After `scaffold.mjs`, the host LLM does the actual code generation:

- CRUD route handlers (per entity)
- Page components (per screen)
- Zod schemas (per entity)
- Typed fetch client (per endpoint in openapi)

See SKILL.md for the prompt protocol.

## Dependencies

- Node 18+
- No npm dependencies for the scaffold script itself
- The generated `chimera-clone/` has its own pnpm dependencies — run `pnpm install` after scaffolding
