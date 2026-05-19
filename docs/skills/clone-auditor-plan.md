# clone-auditor — Implementation Plan

## Task Map

| # | Task | TDD | Files |
|---|------|-----|-------|
| 1 | Scaffold + fixtures | No | minimal .chimera + minimal chimera-clone |
| 2 | `lib/gap-analysis.mjs` | Yes | endpoints/screens/entities vs implementation |
| 3 | `lib/diff-schemas.mjs` | Yes | JSON shape diff |
| 4 | `scripts/discover.mjs` | Integration | wires gap-analysis, writes outputs |
| 5 | `scripts/diff-api.mjs` | Light | runtime utility (mocked fetch in test) |
| 6 | `scripts/diff-visual.mjs` | Light | HTML side-by-side builder |
| 7 | SKILL.md + REFERENCE.md + publish | No | docs + manifest + push |

## Module Contracts

### `lib/gap-analysis.mjs`
```javascript
export function analyzeGaps({ chimeraDir, cloneDir }): {
  missing_routes: [{ entity, method, path }],
  stubbed_routes: [{ entity, file }],
  missing_pages: [{ screen, expected_file }],
  stubbed_pages: [{ screen, file }],
  missing_entities_in_schema: [{ entity }],
  summary: { total_gaps, by_category }
}
```

### `lib/diff-schemas.mjs`
```javascript
export function diffSchemas(a, b): {
  missing_in_b: [path],
  missing_in_a: [path],
  type_mismatches: [{ path, a_type, b_type }]
}
```
Works on plain JSON values (inferring shape) or on JSON Schema objects.

### `scripts/discover.mjs`
Reads `.chimera/` + `chimera-clone/`, runs gap-analysis, writes gap-analysis.json + recommendations.md + report.md. Returns summary.

### `scripts/diff-api.mjs`
Runtime CLI: `node diff-api.mjs --original https://app.example.com --clone http://localhost:4000`. For each endpoint in openapi.json, fires paired requests and writes api-diffs.json.

### `scripts/diff-visual.mjs`
For each screen with a captured screenshot, navigates the clone using `browse`, takes a fresh shot, writes an HTML side-by-side page.

## Fixtures

`tests/fixtures/clone-auditor/`:
- A small `.chimera/` (api-spec + func-map + model)
- A small `chimera-clone/` with one route filled in, one route still stubbed, one page filled in, one page still stubbed

## Commit Cadence

One commit per task.
