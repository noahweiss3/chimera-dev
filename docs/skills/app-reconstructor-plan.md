# app-reconstructor — Implementation Plan

## Task Map

| # | Task | TDD | Files |
|---|------|-----|-------|
| 1 | Scaffold skill dir + fixtures | No | package.json + fixture with model/schema.ts |
| 2 | `scaffold.mjs` | Yes | + integration test verifying file layout |
| 3 | SKILL.md + REFERENCE.md | No | docs |
| 4 | Update README + marketplace + push | No | publish |

## Module Contract

### `scaffold.mjs`
```javascript
export function scaffold({ chimeraDir, outDir, force = false }): Summary
```
- `outDir` defaults to `<chimeraDir>/../chimera-clone`.
- Returns `{ status, entities_scaffolded, screens_scaffolded, files_written, llm_todos: [] }`.

## Test Strategy

Single integration test:
- Fixture: minimal `.chimera/` with `model/entities.json`, `model/schema.ts`, `func-map/screens.json`, `api-spec/openapi.json`.
- Run scaffold against a temp directory.
- Assert: required files exist, package.jsons reference the right names, schema.ts was copied, every entity has a route stub, every screen has a page stub, llm_todos is populated.

## Commit Cadence

One commit per task. Same conventions.
