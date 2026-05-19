# api-mapper — Implementation Plan

## Task Map

| # | Task | TDD? | Files |
|---|------|------|-------|
| 1 | Scaffold skill dir | No | skills/api-mapper/{package.json,SKILL.md placeholder} |
| 2 | `lib/load.mjs` | Yes | load.mjs + load.test.mjs + fixtures |
| 3 | `lib/filter.mjs` | Yes | filter.mjs + filter.test.mjs |
| 4 | `lib/templatize.mjs` | Yes | templatize.mjs + templatize.test.mjs |
| 5 | `lib/infer.mjs` | Yes | infer.mjs + infer.test.mjs |
| 6 | `lib/auth.mjs` | Yes | auth.mjs + auth.test.mjs |
| 7 | `lib/yaml.mjs` | Yes | yaml.mjs + yaml.test.mjs |
| 8 | `lib/emit-openapi.mjs` | Yes | emit-openapi.mjs + test |
| 9 | `lib/emit-client.mjs` | Yes | emit-client.mjs + test |
| 10 | `discover.mjs` orchestrator | Integration | discover.mjs + integration test |
| 11 | SKILL.md, REFERENCE.md | No | docs |
| 12 | Update README + marketplace | No | top-level docs |

## TDD Loop

For each TDD task:
1. Write fixture(s) capturing realistic input
2. Write failing test(s) referencing the not-yet-existent module
3. Verify failure
4. Implement minimum module that makes tests pass
5. Verify all tests in the file pass
6. Verify full test suite still green
7. Commit

## Module Contracts

### `load.mjs`
```javascript
export function loadExchanges({ tracesDir, actionsDir, manifestPath }): Exchange[]
```
- Reads `requests.jsonl`, `responses.jsonl`, `actions/submitted/*.json`
- Returns paired Exchanges (see spec)
- Tolerates missing files; logs warnings via second return value or errors array (decided in test: return `{ exchanges, warnings }`)

### `filter.mjs`
```javascript
export function isNoise(exchange): boolean
export function filterExchanges(exchanges, { appOrigins }): Exchange[]
```

### `templatize.mjs`
```javascript
export function templatizePath(url): { template, params: [{ name, value }] }
export function groupByEndpoint(exchanges): Endpoint[]
```
Where `Endpoint = { method, path_template, exchanges: Exchange[] }`

### `infer.mjs`
```javascript
export function inferSchema(value): JSONSchema
export function mergeSchemas(schemas): JSONSchema
```

### `auth.mjs`
```javascript
export function detectAuth(exchanges): { type, header?, cookie_name?, token_pattern? }
```

### `yaml.mjs`
```javascript
export function toYaml(value, indent = 0): string
```
Subset: scalars, arrays, maps. Strings always double-quoted when ambiguous.

### `emit-openapi.mjs`
```javascript
export function buildOpenApi({ endpoints, auth, targetUrl }): object
```

### `emit-client.mjs`
```javascript
export function buildClient({ endpoints, auth, baseUrl }): string
```
Returns the source of `client.mjs`.

### `discover.mjs`
CLI: `node discover.mjs` (no args; reads `.chimera/` in cwd).
Pipeline: load → filter → group → infer schemas per endpoint → detect auth → map pages → write all outputs.

## Test Fixtures

`tests/fixtures/api-mapper/`:
- `requests.jsonl` — mixed: 1 navigation HTML doc, 2 noise (font, analytics), 4 API calls (GET /api/projects, GET /api/projects/123, POST /api/projects, GET /api/users/me)
- `responses.jsonl` — matching responses
- `bodies/<id>.res.json` — JSON bodies for the API calls
- `actions/submitted/create-project.json` — ground-truth POST exchange

Same data feeds the integration test for `discover.mjs`.

## Commit Cadence

One commit per task. Commit message convention:
- `feat(api-mapper): <module> — <summary>`
- `test(api-mapper): <module> tests`
- `docs(api-mapper): SKILL.md and REFERENCE.md`

## Exit Criteria

- All unit tests pass (`node --test tests/scripts/api-mapper/*.test.mjs`)
- Integration test runs `discover.mjs` against fixtures, asserts each output file exists with sane shape
- README lists api-mapper as Available
- marketplace.json includes `./skills/api-mapper`
- Branch pushed to GitHub
