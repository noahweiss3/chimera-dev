# model-inferrer — Implementation Plan

## Task Map

| # | Task | TDD | Files |
|---|------|-----|-------|
| 1 | Scaffold + fixtures | No | small openapi.json with 2-3 entities |
| 2 | `pluralize.mjs` | Yes | tiny helper: singularize/pluralize/capitalize |
| 3 | `extract-entities.mjs` | Yes | walk OpenAPI, merge by structure |
| 4 | `infer-relationships.mjs` | Yes | _id FKs, URL nesting, nested objects |
| 5 | `emit-drizzle.mjs` | Yes | entities → TS Drizzle schema |
| 6 | `emit-erd.mjs` | Yes | entities → Mermaid ER block |
| 7 | `discover.mjs` + integration | Integration | full pipeline |
| 8 | SKILL.md + REFERENCE.md + publish | No | docs + manifest + push |

## Module Contracts

### `pluralize.mjs`
```javascript
export function singularize(s): string  // "projects" → "project"
export function pluralize(s): string    // "project" → "projects"
export function capitalize(s): string   // "project" → "Project"
```
Heuristic-only — handles common English rules (ies/es/s).

### `extract-entities.mjs`
```javascript
export function extractEntities({ openapi }): Entity[]
```
Returns candidate entities. Merges by structural similarity.

### `infer-relationships.mjs`
```javascript
export function inferRelationships({ entities, openapi }): Entity[]
```
Mutates/returns entities with `relationships` populated. Adds FK columns when needed.

### `emit-drizzle.mjs`
```javascript
export function buildDrizzleSchema(entities): string
```

### `emit-erd.mjs`
```javascript
export function buildErd(entities): string
```

### `discover.mjs`
```javascript
export function discover({ chimeraDir }): Summary
```

## Fixtures

`tests/fixtures/model-inferrer/`:
- `api-spec/openapi.json` — three endpoints (GET list, GET detail, POST create) producing two entities (Project, User) with a belongs_to relationship via `owner_id`.
- `func-map/screens.json` — minimal: one list screen, one detail screen.
- `forms/001-create-project.json` — fields for the create form.

## Commit Cadence

One commit per task. Conventional commit messages.
