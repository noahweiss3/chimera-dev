---
name: functionality-mapper
description: "Map each captured screen to its functional behavior: data dependencies, action triggers, user flows, and state transitions. Use after api-mapper. Produces .chimera/func-map/ consumed by model-inferrer and app-reconstructor."
compatibility: "Requires Node 18+ and a .chimera/ directory containing app-explorer + api-mapper outputs."
license: MIT
allowed-tools: Bash, Read, Grep
---

# Chimera Functionality Mapper

Cross-reference the captured data to figure out what each screen *does*: which endpoints it loads, which buttons trigger which API calls, what user flows exist, and how state transitions on submit.

## When to use

- The user has run `app-explorer` and `api-mapper` and now wants a screen-level behavior map before reconstruction.
- `model-inferrer` and `app-reconstructor` consume this output, so run it before them.

## Setup check

```bash
test -d .chimera && echo "ok" || echo "MISSING: run app-explorer first"
test -f .chimera/api-spec/endpoint-map.json && echo "api-spec ok" || echo "WARNING: api-mapper not run yet — data_dependencies will be empty"
```

If `api-spec/` is missing, the skill still runs but produces a less complete map. Tell the user and offer to run `api-mapper` first.

## Run the mapping

```bash
node skills/functionality-mapper/scripts/discover.mjs
```

This loads pages, elements, forms, actions, and the endpoint map; classifies each screen; attaches endpoint dependencies and action records; reconstructs linear user flows from the nav-graph; and emits transitions for every 2xx submitted action.

## Review the output

1. **`report.md`** — top-level summary: screens by type, ambiguities, warnings.
2. **`screens.json`** — array of screen specs. For each screen, check:
   - `type` — does the heuristic classification look right? (`unknown` flags need attention.)
   - `data_dependencies` — does the list of endpoints match what you'd expect on that page?
   - `actions` — do `navigates_to` IDs line up with the nav-graph? Are buttons with `endpoint: null` expected to be no-ops?
3. **`flows.json`** — reconstructed user flows. Each chain is a valid path through the nav-graph. The LLM can rename flows and merge/split them.
4. **`state-machine.json`** — transitions inferred from submitted actions. Each entry has `from_screen`, `to_screen`, `trigger`, `endpoint`.

## When the heuristic is wrong

The scripts make best-effort classifications. As the host LLM, you can correct mistakes in-place by editing `screens.json` directly:

- Re-classify a screen by changing its `type` field.
- Fill in a missing endpoint on a button action when the naming pattern strongly suggests it (e.g., button "Save" on a form view → likely POST/PATCH for that resource).
- Rename flows or rewrite their steps to reflect actual product semantics.

Always preserve the JSON structure. Re-running `discover.mjs` overwrites the files, so capture any manual edits in commits before re-running.

## Reporting to the user

> "Mapped **{S}** screens (**{L}** list, **{F}** form, **{D}** detail, **{U}** unknown). Reconstructed **{N}** flows and **{T}** state transitions. **{K}** screens flagged as ambiguous — see `report.md`."

## Edge cases

- **No api-spec/**: data_dependencies empty; action endpoints fall back to whatever was captured in `actions/submitted/`. Flag this to the user.
- **No actions/submitted/**: state-machine.json will be empty; safe-mode runs of app-explorer produce no submitted actions.
- **Loops in nav-graph**: flow reconstruction stops at re-visited nodes; deeply cyclic apps may surface short flows.
