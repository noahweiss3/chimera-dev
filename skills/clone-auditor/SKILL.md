---
name: clone-auditor
description: "Audit a reconstructed Chimera clone against the captured spec and (optionally) the live original. Identifies stubbed routes, missing pages, schema gaps, and response-shape drift. Use after app-reconstructor when the user wants a quality check."
compatibility: "Requires Node 18+ and both .chimera/ and chimera-clone/ in the working directory."
license: MIT
allowed-tools: Bash, Read, Grep
---

# Chimera Clone Auditor

Verify that the reconstructed clone matches what was captured. Run static gap analysis always; run runtime diffs when both apps are available.

## When to use

- The user has run `app-reconstructor` and filled in the stubs.
- They want a coverage check before merging or shipping the clone.

## Setup check

```bash
test -d .chimera && echo "spec ok" || echo "MISSING: prior chimera skills"
test -d chimera-clone && echo "clone ok" || echo "MISSING: run app-reconstructor"
```

## Step 1 — Static gap analysis (always)

```bash
node skills/clone-auditor/scripts/discover.mjs
```

Walks `.chimera/api-spec/endpoint-map.json`, `func-map/screens.json`, and `model/entities.json`. For each, checks whether the corresponding artifact in `chimera-clone/` is present and is no longer a `TODO(chimera)` stub.

Output:
- **`audit/gap-analysis.json`** — structured list of gaps by category
- **`audit/recommendations.md`** — per-category guidance on which skill to re-run or which file to edit
- **`audit/report.md`** — top-level summary

Review `report.md` first. If `total_gaps` is 0, the clone covers everything the spec claims (structurally). Tell the user that's a good sign but they still need behavioral verification.

## Step 2 — Runtime API diff (optional)

If both servers are reachable:

```bash
# Clone running (pnpm dev or similar)
node skills/clone-auditor/scripts/diff-api.mjs \
  --original https://app.example.com \
  --clone http://localhost:4000 \
  --cookie "session=..."     # optional, for authed endpoints
```

This makes paired GET requests against both apps for every parameter-less GET endpoint in the OpenAPI doc, then writes shape diffs to `audit/api-diffs.json`. Pay attention to:

- `clone_status` mismatching `original_status` (e.g., clone 500 vs original 200) — the route is wired wrong
- `schema_diff.missing_in_b` — the clone returns less than the original (likely missing fields in the response shape)
- `schema_diff.type_mismatches` — a field's type differs (likely a typo or wrong Drizzle column type)

Skip parameterized endpoints (`/api/projects/{id}`) — the auditor doesn't pick sample IDs automatically. The LLM can extend this in follow-up if needed.

## Step 3 — Visual diff (optional)

If you have screenshots of the clone:

```bash
node skills/clone-auditor/scripts/diff-visual.mjs --clone-shots /path/to/clone/screenshots
```

For each screen with a captured screenshot, generates an HTML page in `audit/visual-diffs/<Name>.html` showing the original and the clone side-by-side. Open in a browser to eyeball.

To produce clone screenshots, the LLM can drive `browse open http://localhost:5173/<path>` then `browse screenshot --path .../<Name>.png` for each screen url.

## Reporting to the user

For static-only:
> "Audit found **{N}** gaps: **{M}** stubbed routes, **{K}** stubbed pages, **{S}** missing entities. See `audit/recommendations.md` for fixes."

When runtime diffs ran:
> "API diff: **{T}** endpoints compared, **{F}** had mismatches. Visual diffs: **{V}** screens. See `audit/api-diffs.json` and `audit/visual-diffs/`."

For a clean run:
> "No structural gaps detected. The clone implements every claimed surface. Runtime checks are still recommended (`diff-api.mjs`)."

## Iterating

Each gap should be fixable by re-running an earlier skill (see `recommendations.md`). Common workflow:

1. Auditor reports a stubbed page → user opens it, asks Claude to fill it in following `app-reconstructor` SKILL.md
2. Auditor reports a schema-mismatch on `GET /api/projects` → look at the route handler; ensure it returns the same fields as the original's response in `.chimera/traces/bodies/`
3. Auditor reports a missing entity → re-run `model-inferrer` after correcting OpenAPI or hand-edit `.chimera/model/schema.ts`, then re-copy to the clone

Re-running `discover.mjs` after fixes is idempotent — it overwrites `audit/` cleanly.
