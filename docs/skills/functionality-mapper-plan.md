# functionality-mapper — Implementation Plan

## Task Map

| # | Task | TDD | Files |
|---|------|-----|-------|
| 1 | Scaffold dir + fixtures | No | package.json, fixtures |
| 2 | `lib/load.mjs` | Light | reads .chimera/ inputs |
| 3 | `lib/classify-screens.mjs` | Yes | + classify-screens.test.mjs |
| 4 | `lib/map-endpoints.mjs` | Yes | + map-endpoints.test.mjs |
| 5 | `lib/map-actions.mjs` | Yes | + map-actions.test.mjs |
| 6 | `lib/reconstruct-flows.mjs` | Yes | + reconstruct-flows.test.mjs |
| 7 | `lib/emit.mjs` + `discover.mjs` | Integration test | full pipeline |
| 8 | SKILL.md + REFERENCE.md + publish | No | docs + README + marketplace |

## Fixtures

Mock a small but realistic `.chimera/` structure:
- 3 pages: `000` public landing, `001` projects list (after login), `002` project detail
- nav-graph with edges 000→001, 001→002
- elements.json for each page: links + 1 form on `001` (search), 1 destructive button on `001` (Delete)
- one submitted action: POST /api/projects from page 001
- api-spec/endpoint-map.json with GET /api/projects (linked to page 001) and GET /api/projects/{id} (linked to page 002)

## Module Contracts

### `load.mjs`
```javascript
export function loadInputs(chimeraDir): {
  manifest, navGraph, pages, forms,
  submittedActions, skippedActions,
  endpointMap, warnings
}
```

### `classify-screens.mjs`
```javascript
export function classifyScreen({ meta, elements }): "list" | "detail" | "form" | "settings" | "empty" | "unknown"
```

### `map-endpoints.mjs`
```javascript
export function mapEndpointsForScreen({ pageId, endpointMap }): DataDependency[]
```

### `map-actions.mjs`
```javascript
export function mapActionsForScreen({ pageId, elements, submittedActions, navGraph, pages }): {
  actions: Action[],
  destructive_actions_skipped: ActionRef[]
}
```

### `reconstruct-flows.mjs`
```javascript
export function reconstructFlows({ screens, navGraph }): Flow[]
```

### `emit.mjs`
```javascript
export function emit({ outDir, screens, flows, stateMachine, warnings }): void
```

### `discover.mjs`
Orchestrator: load → classify each → map → reconstruct → emit. Exports `discover({ chimeraDir })`.

## Test Strategy

Unit tests use small in-memory inputs; integration test runs `discover()` against the fixtures directory and asserts:
- `screens.json` contains expected screens with expected types
- `flows.json` contains at least one flow
- `state-machine.json` contains the create-project transition
- `report.md` exists and has the expected sections

## Commit Cadence

One commit per module + test. Same conventions as api-mapper.
