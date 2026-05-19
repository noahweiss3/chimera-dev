---
name: model-inferrer
description: "Infer entity definitions, relationships, and a PostgreSQL Drizzle ORM schema from the OpenAPI spec + form definitions. Use after api-mapper (and ideally functionality-mapper). Produces .chimera/model/ consumed by app-reconstructor."
compatibility: "Requires Node 18+ and a .chimera/ directory with api-spec/openapi.json (from api-mapper)."
license: MIT
allowed-tools: Bash, Read, Grep
---

# Chimera Model Inferrer

Cross-reference the inferred API spec, screen specs, and form definitions to figure out the underlying data model: which entities exist, what fields they have, and how they relate.

## When to use

- The user has run `api-mapper` (and ideally `functionality-mapper`) and now wants a database schema and ER diagram.
- Output feeds `app-reconstructor` directly — the generated `schema.ts` is what the reconstructed app uses.

## Setup check

```bash
test -f .chimera/api-spec/openapi.json && echo "ok" || echo "MISSING: run api-mapper first"
```

If openapi.json is missing, the skill fails fast. Tell the user to run `api-mapper`.

## Run the inference

```bash
node skills/model-inferrer/scripts/discover.mjs
```

Walks every JSON response and request schema in the OpenAPI doc, extracts candidate entities, merges structurally equivalent ones (e.g., a nested `owner` object shaped like `User` is merged into `User`), infers relationships from `*_id` fields and URL nesting, then emits a Drizzle schema and a Mermaid ERD.

## Review the output

1. **`report.md`** — entity counts, relationship counts, confidence (high if entity appears in ≥2 sources). Single-source entities are flagged.
2. **`entities.json`** — array of entity records with fields, types, and relationships. The authoritative machine-readable view.
3. **`erd.md`** — Mermaid ER diagram. Read it as a quick visual sanity check. Are the relationships shaped like you'd expect?
4. **`schema.ts`** — Drizzle PostgreSQL schema, ready to drop into a Node.js + Drizzle project. Includes `pgTable` declarations and `relations()` blocks for ORM joins.

## When the heuristic is wrong

The script is best-effort. Common issues to look for and fix in `entities.json` (and re-run nothing — just edit the output):

- **Wrong entity name**: e.g., singular form failed (`categories` → `Categorie`). Edit the `name` and `table` fields.
- **Missing relationship**: an `*_id` field whose target wasn't in the known role-alias list (`owner`, `author`, `creator`, etc.). Add a `relationships` entry by hand.
- **Polymorphic types**: response samples disagreed; `entities.json` may show duplicate entities with overlapping fields. Merge by hand and remove duplicates.
- **Type mismatches**: a `string` field that should be a `uuid` because it's actually an ID. Adjust the `type` field.

After hand edits, regenerate `schema.ts` only if needed. (Re-running `discover.mjs` overwrites everything — capture manual edits as a separate file or in git first.)

## Reporting to the user

> "Inferred **{N}** entities and **{R}** relationships. Output in `.chimera/model/`. **{K}** entities are single-source (lower confidence) — see `report.md`."

## Edge cases

- **No openapi.json**: skill fails fast with a clear error.
- **No forms**: required-ness comes from OpenAPI schemas alone; less precise.
- **GraphQL endpoints**: heuristics will likely fail; produce a minimal model and flag it.
- **`oneOf` / polymorphic responses**: may produce duplicate-ish entities; review carefully.
