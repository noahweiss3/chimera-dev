# clone-auditor — Spec

## Purpose

Compare the reconstructed clone (`chimera-clone/`) against the original captured app data (`.chimera/`) and, optionally, against the live original. Identify functional gaps and produce a report with recommendations.

## Inputs

- `.chimera/` (all prior outputs)
- `chimera-clone/` (the scaffolded + LLM-filled output of app-reconstructor)
- Optionally a live original app via `browse` (for runtime API and visual diffs)
- Optionally a live clone via `pnpm dev` (same)

## Outputs

```
.chimera/audit/
├── gap-analysis.json    Structural gaps: endpoints/screens/entities missing from clone
├── api-diffs.json       Runtime API response schema diffs (when both servers are up)
├── visual-diffs/        Side-by-side screenshot comparisons (when both apps are live)
│   └── <screen>.html
├── recommendations.md   Per-gap suggestion: which skill output to update
└── report.md            Human-readable audit summary
```

## Algorithm

### 1. Static gap analysis (always runs)

Compares **what's claimed** in `.chimera/` against **what's implemented** in `chimera-clone/`:

- **Endpoints**: every `(method, path_template)` in `.chimera/api-spec/endpoint-map.json` should have a route file at `chimera-clone/apps/api/src/routes/<table>.ts`. Check for: file exists, file no longer has `TODO(chimera)` markers.
- **Screens**: every screen in `.chimera/func-map/screens.json` should have a page component at `chimera-clone/apps/web/src/pages/<PascalName>.tsx` that's no longer a stub.
- **Entities**: every entity in `.chimera/model/entities.json` should be reachable from `chimera-clone/apps/api/src/db/schema.ts` (literal grep for `pgTable("<table>"`).

A "gap" is any item present in the spec but missing or still-stubbed in the clone.

### 2. Schema diff (TDD-able)

For any pair of response samples (original vs clone), produce a structural diff:

- Properties present in A but missing in B: `missing_in_clone`
- Properties present in B but missing in A: `extra_in_clone`
- Properties whose types disagree: `type_mismatch`
- Required-ness mismatches: `required_mismatch`

Recurses into nested objects and arrays.

### 3. Runtime API diff (interactive; light test coverage)

For each endpoint in `.chimera/api-spec/openapi.json`:
- Make the same request to the original (if `--original-base` provided) and to the clone (if `--clone-base` provided, defaults to `http://localhost:4000`).
- Apply schema diff to the two response bodies.
- Record any status mismatch (e.g., original 200, clone 500).

### 4. Visual diff (interactive)

For each screen with a captured screenshot in `.chimera/pages/<id>/screenshot.png`:
- Use `browse open` to navigate to the same path on the clone, take a fresh screenshot.
- Write `audit/visual-diffs/<name>.html`: a tiny HTML page with both images side-by-side.
- No pixel diffing — the LLM/user eyeballs the comparison.

### 5. Recommendations

For each gap:

| Gap type | Suggested fix |
|----------|---------------|
| Endpoint route still stubbed | Re-run app-reconstructor step "Generate API routes" for that entity |
| Page component still stubbed | Re-run app-reconstructor step "Generate page components" for that screen |
| Entity missing from schema.ts | Re-run model-inferrer or hand-edit `.chimera/model/schema.ts` |
| API response shape disagrees | Adjust the route handler; the source data is in `.chimera/traces/` |
| Visual difference | Layout/style work in the page component; reference the screenshot |

## Architecture

```
skills/clone-auditor/
├── SKILL.md
├── REFERENCE.md
├── package.json
└── scripts/
    ├── discover.mjs          Gap analysis + recommendations (always-on)
    ├── diff-api.mjs          Runtime API request comparison (CLI)
    ├── diff-visual.mjs       Side-by-side HTML report builder
    └── lib/
        ├── gap-analysis.mjs  Compare .chimera/ vs chimera-clone/
        └── diff-schemas.mjs  JSON-schema-ish shape diff
```

## Edge cases

- **No `chimera-clone/`**: `discover.mjs` reports everything as a gap and recommends running `app-reconstructor`.
- **Both servers down**: `diff-api.mjs` and `diff-visual.mjs` skip with an explanation; static analysis still runs.
- **Original app behind auth**: the user must `browse open` first; the audit assumes the session is live.
