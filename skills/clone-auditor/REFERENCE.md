# Clone Auditor Reference

## Output

```
.chimera/audit/
├── gap-analysis.json     Structural diff: spec vs clone
├── api-diffs.json        (optional) Runtime API response shape diffs
├── visual-diffs/         (optional) Side-by-side screenshot HTML pages
│   └── <Screen>.html
├── recommendations.md    Per-gap fix guidance
└── report.md             Top-level audit summary
```

## Gap analysis output

```json
{
  "missing_routes": [{ "entity": "users", "method": "GET", "path": "/api/users/me" }],
  "stubbed_routes": [{ "entity": "users", "file": "apps/api/src/routes/users.ts" }],
  "missing_pages": [{ "screen": "003", "expected_file": "apps/web/src/pages/Settings.tsx" }],
  "stubbed_pages": [{ "screen": "002", "file": "apps/web/src/pages/ProjectAlpha.tsx" }],
  "missing_entities_in_schema": [{ "entity": "User", "table": "users" }],
  "summary": {
    "total_gaps": 5,
    "by_category": { … }
  }
}
```

## Gap categories and how they're detected

| Category | Detection |
|----------|-----------|
| `missing_routes` | endpoint in `endpoint-map.json` but no `apps/api/src/routes/<table>.ts` file |
| `stubbed_routes` | route file exists but still contains `TODO(chimera)` |
| `missing_pages` | screen in `screens.json` but no `apps/web/src/pages/<PascalName>.tsx` |
| `stubbed_pages` | page file exists but still contains `TODO(chimera)` |
| `missing_entities_in_schema` | entity in `entities.json` but no `pgTable("<table>"` literal in `apps/api/src/db/schema.ts` |

## Schema diff (`diff-schemas.mjs`)

Given two JSON values, returns:

- `missing_in_b`: paths present in A, absent in B
- `missing_in_a`: paths present in B, absent in A
- `type_mismatches`: paths where the inferred types disagree (`integer` and `number` are unified)

Recurses into objects and arrays. Array paths use `[]` syntax (e.g., `items[].name`).

## Runtime API diff (`diff-api.mjs`)

CLI flags:

| Flag | Default | Purpose |
|------|---------|---------|
| `--chimera` | `.chimera` | Path to the spec directory |
| `--original` | none (required for comparison) | Base URL of the original app |
| `--clone` | `http://localhost:4000` | Base URL of the running clone |
| `--cookie` | none | Cookie header to send (e.g., session) |

Only parameter-less `GET` endpoints are compared. Output: `audit/api-diffs.json`.

## Visual diff (`diff-visual.mjs`)

CLI flags:

| Flag | Default | Purpose |
|------|---------|---------|
| `--chimera` | `.chimera` | Path to the spec directory |
| `--clone-shots` | none | Directory of `<Name>.png` screenshots taken from the clone |

For every screen with a captured screenshot at `.chimera/pages/<id>/screenshot.png`, writes an HTML side-by-side at `audit/visual-diffs/<Name>.html`. If the clone screenshot is missing, that side shows a placeholder.

## Dependencies

- Node 18+ (uses built-in `fetch` for the runtime API diff)
- No npm dependencies
- Reads `.chimera/` and `chimera-clone/`; writes only to `.chimera/audit/`
