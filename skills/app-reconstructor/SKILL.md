---
name: app-reconstructor
description: "Scaffold and fill in a complete full-stack clone (React 19 + Vite + Express + Drizzle + Postgres + Zod) from the captured .chimera/ outputs. Use after model-inferrer."
compatibility: "Requires Node 18+ and a .chimera/ directory containing api-spec/, func-map/, and model/ from the previous Chimera skills."
license: MIT
allowed-tools: Bash, Read, Grep, Edit, Write
---

# Chimera App Reconstructor

You are the assembler. Take the captured spec (API, screens, model) and produce a runnable application in `chimera-clone/`. The scaffold script lays down the skeleton; you fill it in with real code.

## When to use

- The user has run `app-explorer` → `api-mapper` → `functionality-mapper` → `model-inferrer`.
- They want a working full-stack clone they can run locally.

## Setup check

```bash
test -f .chimera/model/entities.json && test -f .chimera/api-spec/openapi.json && echo "ok" || echo "MISSING: prior skills not run"
```

If any input is missing, name which skill to run first.

## Step 1 — Scaffold

```bash
node skills/app-reconstructor/scripts/scaffold.mjs
```

This creates `chimera-clone/` with:

- pnpm workspaces (`apps/api`, `apps/web`, `packages/shared`)
- `apps/api`: Express server, Drizzle client, route stubs (one file per entity)
- `apps/web`: Vite + React 19, App.tsx routing, page stubs (one file per screen), API client stub
- `packages/shared`: Zod schema stub

Every stub has a `TODO(chimera)` marker pointing to the source data in `.chimera/`.

If `chimera-clone/` already exists, the script aborts. Pass `--force` only after the user confirms — it overwrites scaffold files but leaves your hand-written code alone where the file path is a route/page (those are TODO stubs).

## Step 2 — Generate API routes

For each entity in `.chimera/model/entities.json`:

Open `chimera-clone/apps/api/src/routes/<table>.ts`. Replace the TODO comment with full CRUD handlers, matching the OpenAPI contract. Use Drizzle queries:

```ts
router.get("/:id", async (req, res) => {
  const [row] = await db.select().from(schema.projects).where(eq(schema.projects.id, req.params.id));
  if (!row) return res.status(404).end();
  res.json(row);
});
```

Cross-reference `.chimera/api-spec/openapi.json` for the exact request/response shapes per endpoint. Use Zod schemas from `@chimera-clone/shared` for request body validation. Honor relationships from `entities.json` (e.g., a `belongs_to` means the route may accept a parent id from the URL).

## Step 3 — Generate Zod schemas

Open `chimera-clone/packages/shared/src/schemas.ts`. Replace the placeholder with one Zod schema per entity, derived from `.chimera/model/entities.json`. Convention:

```ts
export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  owner_id: z.string().uuid(),
  created_at: z.string().datetime(),
});
export type Project = z.infer<typeof projectSchema>;
```

Required fields use the type directly; optional fields use `.nullable()` or `.optional()`. Enum fields use `z.enum([...])`.

## Step 4 — Generate the API client

Open `chimera-clone/apps/web/src/lib/api.ts`. Replace the stub with a typed function per OpenAPI operation. The structure mirrors `.chimera/api-spec/client.mjs`, but with TypeScript types pulled from `@chimera-clone/shared`. Each function:

- accepts path params positionally
- takes an `options: { body?, query?, headers? }` argument
- returns `Promise<ResponseType>` (parsed JSON, throws on non-2xx)

## Step 5 — Generate page components

For each screen in `.chimera/func-map/screens.json`:

Open `chimera-clone/apps/web/src/pages/<Name>.tsx`. Implement based on the screen's `type`:

- **list**: fetch the collection endpoint on mount, render a table/grid. Wire row clicks to navigate to detail screens.
- **detail**: fetch the resource by id from the URL, render fields as a card. Wire safe action buttons to their endpoints, navigate after success.
- **form**: render a controlled form using the shared Zod schema for validation. On submit, call the POST/PATCH endpoint and navigate per `navigates_to`.
- **settings**: render toggles / form fields, wire each to its endpoint.
- **empty / unknown**: render a placeholder; ask the user for guidance.

For every screen, the `actions` array in screens.json tells you which buttons/links wire up to which endpoint or destination. Use react-router's `useNavigate()` for `navigates_to`.

Skip anything in `destructive_actions_skipped` (the original explorer didn't exercise these and you shouldn't either — leave them as plain buttons with a comment).

## Step 6 — Verify it builds

```bash
cd chimera-clone
pnpm install
pnpm -r run build
```

If TypeScript complains, fix the offending file. Common issues:

- Missing import for `eq`/`and` from drizzle-orm
- Page component prop types don't match react-router signatures
- Zod schema field names mismatch the OpenAPI shapes

If the build succeeds, suggest the user start the dev server:

```bash
cp .env.example .env  # or write one with DATABASE_URL
docker run -d -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
pnpm --filter @chimera-clone/api db:push
pnpm dev
```

## Reporting to the user

> "Scaffolded `chimera-clone/` with **{E}** entities and **{S}** screens. Routes, pages, schemas, and the API client are filled in. Build passes. Ready to run with \`pnpm dev\` after setting DATABASE_URL."

If any step couldn't complete (e.g., a screen had no inferable behavior), list those clearly so the user knows where the manual work begins.

## Important rules

- Don't invent endpoints that aren't in the OpenAPI spec.
- Don't invent fields that aren't in the entity definition.
- Respect the screen `type` heuristic — don't turn a detail page into a form unless the captured data shows form fields.
- Prefer Zod schemas over hand-rolled type guards for validation.
- Use the screenshots at `.chimera/pages/<id>/screenshot.png` as visual reference for layout decisions, but don't try to pixel-match.
