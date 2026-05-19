# app-reconstructor — Spec

## Purpose

Assemble a complete, runnable application from all prior Chimera outputs: API spec, screen specs, flows, and the inferred data model. Output lives in `./chimera-clone/` next to `.chimera/`.

This skill is largely **LLM-driven**. The script (`scaffold.mjs`) creates the directory structure, copies the Drizzle schema, and writes the templated boilerplate. The host LLM then fills in the routes, page components, and shared validation logic by reading `.chimera/` and writing into `./chimera-clone/`.

## Inputs

- `.chimera/api-spec/openapi.json` — endpoint contract
- `.chimera/api-spec/client.mjs` — reference fetch client (illustrative, regenerated for the web app)
- `.chimera/func-map/screens.json` — what each page does
- `.chimera/func-map/flows.json` — user flows
- `.chimera/model/schema.ts` — Drizzle schema (copied wholesale into api)
- `.chimera/model/entities.json` — entity definitions for codegen prompts
- `.chimera/pages/<id>/screenshot.png` — visual reference for layout decisions

## Output

```
chimera-clone/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── README.md
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── index.ts             Express bootstrap
│   │       ├── db/
│   │       │   ├── client.ts        Drizzle Postgres client
│   │       │   └── schema.ts        (copied from model-inferrer)
│   │       └── routes/
│   │           └── <entity>.ts      One per entity (LLM-generated)
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── pages/
│           │   └── <Screen>.tsx     One per screen (LLM-generated)
│           └── lib/
│               └── api.ts           Typed fetch client (LLM-generated from openapi)
└── packages/
    └── shared/
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── schemas.ts           Zod schemas per entity (LLM-generated)
```

## Target Stack

- pnpm workspaces
- React 19 + Vite (web)
- Express + Drizzle ORM + PostgreSQL (api)
- Zod (shared validation)
- TypeScript everywhere

## What `scaffold.mjs` does

1. Reads `.chimera/model/entities.json` and `.chimera/func-map/screens.json` (fails fast if missing).
2. Creates the directory tree.
3. Writes templated boilerplate files: package.jsons, tsconfigs, vite.config.ts, drizzle.config.ts, index.html, main.tsx, App.tsx, db/client.ts, README.
4. Copies `.chimera/model/schema.ts` to `apps/api/src/db/schema.ts`.
5. Creates an empty stub for each entity route (`apps/api/src/routes/<entity>.ts`) and each screen page (`apps/web/src/pages/<Screen>.tsx`). Stubs contain a TODO comment that tells the LLM what to fill in.
6. Emits a JSON summary listing what was scaffolded and what still needs the LLM.

## What the LLM does (per SKILL.md)

After running `scaffold.mjs`:

1. For each entity, fill in `apps/api/src/routes/<entity>.ts` with GET-list, GET-detail, POST-create, PATCH-update, DELETE-remove handlers, using the OpenAPI spec as the contract and Drizzle queries against the schema.
2. For each screen, fill in `apps/web/src/pages/<Screen>.tsx`:
   - Fetch its `data_dependencies` on load
   - Render based on screen `type` (list → table, form → controlled form, detail → card layout)
   - Wire `actions` to the appropriate API calls or `navigate()`
3. Generate `packages/shared/src/schemas.ts` — one Zod schema per entity from `entities.json`.
4. Generate `apps/web/src/lib/api.ts` — a typed fetch client per the OpenAPI doc.
5. Generate `apps/web/src/App.tsx` routing using react-router-dom.

## Boilerplate templates

The script's template literals stay minimal and stack-aligned. Notable specifics:

- `apps/api/src/index.ts`: imports route modules from `./routes/<entity>.js` for every entity; uses `express.json()`; serves on `process.env.API_PORT ?? 4000`.
- `apps/api/src/db/client.ts`: exports `db` from `drizzle-orm/node-postgres` configured via `DATABASE_URL` env.
- `apps/api/drizzle.config.ts`: drizzle-kit config pointing at `./src/db/schema.ts`.
- `apps/web/src/main.tsx`: standard React 19 root with `<App />`.
- `apps/web/vite.config.ts`: dev proxy `/api` → `http://localhost:4000`.
- `packages/shared/src/schemas.ts`: empty file with a comment for the LLM to fill.

## Edge cases

- **Missing entities.json**: scaffold.mjs fails fast with an explanation.
- **Missing screens.json**: scaffold.mjs still creates the API side, skips the web side stubs, and reports it.
- **Existing `chimera-clone/`**: scaffold.mjs aborts unless `--force` is passed (then overwrites only files it itself manages — leaves any LLM-authored files alone if the path looks like a route/page).

## Architecture

```
skills/app-reconstructor/
├── SKILL.md
├── REFERENCE.md
├── package.json
└── scripts/
    └── scaffold.mjs
```

No `lib/` — the script is self-contained because the heavy lifting moves to the LLM.
