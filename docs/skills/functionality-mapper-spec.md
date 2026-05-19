# functionality-mapper — Spec

## Purpose

Map each captured screen to its functional behavior: what data it depends on, which buttons/links trigger which actions, what flows it participates in. Produces structured input for `model-inferrer` and `app-reconstructor`.

This skill is hybrid: scripts handle the mechanical cross-referencing (timestamp matching, heuristic classification), the LLM handles the interpretive synthesis (flow reconstruction, state-machine inference) when run inside Claude. The output files are written by the scripts; the LLM may augment them after review.

## Inputs

- `.chimera/nav-graph.json` — `{ nodes, edges }` from app-explorer
- `.chimera/pages/<id>/meta.json` — timestamps, url, title, section
- `.chimera/pages/<id>/elements.json` — links, buttons (with classification), forms
- `.chimera/forms/*.json` — form structure
- `.chimera/actions/submitted/*.json` + `.chimera/actions/skipped/*.json`
- `.chimera/api-spec/endpoint-map.json` — endpoints + their page references
- `.chimera/api-spec/openapi.yaml` (for downstream consumers; not directly read)

## Outputs

```
.chimera/func-map/
├── screens.json          Array of screen specs
├── flows.json            Reconstructed user flows
├── state-machine.json    Detected state transitions
└── report.md             Summary + flagged ambiguities
```

### Screen spec
```json
{
  "id": "002",
  "name": "Dashboard",
  "url": "/dashboard",
  "type": "list|detail|form|settings|empty|unknown",
  "section": "dashboard",
  "auth": true,
  "data_dependencies": [
    { "endpoint": "GET /api/projects", "purpose": "list items", "on_load": true }
  ],
  "actions": [
    { "trigger": "button:Create Project", "ref": "@0-6", "classification": "safe", "endpoint": "POST /api/projects", "navigates_to": "003" },
    { "trigger": "link:Project Alpha", "ref": "@0-8", "endpoint": null, "navigates_to": "005" }
  ],
  "forms": ["002-search"],
  "destructive_actions_skipped": [
    { "trigger": "button:Delete Account", "ref": "@0-12" }
  ]
}
```

### Flow spec
```json
{
  "name": "Visit dashboard -> view project",
  "steps": [
    { "screen": "002", "action": "click link:Project Alpha" },
    { "screen": "005", "action": "land on project detail" }
  ]
}
```

### State machine entry
```json
{
  "name": "project.create",
  "from_screen": "002",
  "to_screen": "003",
  "trigger": "button:Create Project",
  "endpoint": "POST /api/projects"
}
```

## Algorithm

### 1. Load
Read all inputs into memory. Tolerate missing optional inputs (no `endpoint-map.json` → `data_dependencies` is empty).

### 2. Classify each screen
Heuristic based on `elements.json` + URL pattern + section:
- **form**: ≥1 form with ≥2 input fields and a submit button
- **list**: ≥3 links sharing a path prefix (e.g., `/projects/1`, `/projects/2`, `/projects/3`)
- **detail**: URL ends with `/{id}`-shaped segment AND no list pattern AND ≥1 heading/button
- **settings**: section name contains `settings` OR ≥2 toggle/checkbox inputs and no list pattern
- **empty**: ≤2 links and 0 buttons and 0 forms (suspected empty state)
- **unknown**: otherwise

Falls back to `unknown` when ambiguous.

### 3. Map endpoints to screens
For each endpoint in `endpoint-map.json`:
- Use the endpoint's `pages: [page_ids]` list directly when available
- Otherwise: compute from page meta.json timestamps ± 30s window vs the exchange's timestamp

For each screen, assemble `data_dependencies`:
- GET endpoints mapped to this screen → `purpose: "list items"` if endpoint template ends in collection-ish segment, else `"load resource"`
- `on_load: true` if endpoint was first hit during the page's load window (first 5 seconds after page timestamp)

### 4. Map actions
For each button in `elements.json`:
- If the button's classification is `destructive`, record under `destructive_actions_skipped`
- Else, look for a matching `actions/submitted/*.json` that came from this `page_ref` — that gives us the endpoint
- Without a submitted action, record `endpoint: null` (the LLM can resolve later from naming patterns)
- `navigates_to`: from nav-graph edges where `from === this.id`

For each link in `elements.json`:
- Match `href` against other pages' URLs to find `navigates_to`
- `endpoint: null` (links don't trigger XHRs in the general case)

### 5. Reconstruct flows
From `nav-graph.edges`, build linear flow chains:
- Start from screens with `type: list` or `section: dashboard`
- Walk edges depth-first until hitting a visited screen or a detail page
- Each chain becomes a Flow

### 6. State machine
Each `actions/submitted/*.json` whose response status is 2xx becomes a transition:
- `from_screen`: action's `page_ref`
- `to_screen`: nav-graph edge target from that page after the submit timestamp
- `trigger`: button text + ref
- `endpoint`: `<method> <templated path>`

### 7. Emit
Write the four output files. `report.md` summarizes counts, lists screens by type, flags ambiguities (screens with `type: unknown`, actions with `endpoint: null`, flows that loop).

## Edge cases

- **Missing api-spec/**: skip endpoint mapping; emit screens.json without `data_dependencies`; report.md flags this.
- **Page with no elements.json**: skip; report.md lists it.
- **Conflicting classifications**: prefer `form` > `list` > `detail` > `settings` > `empty` > `unknown`.

## Architecture

```
skills/functionality-mapper/
├── SKILL.md
├── REFERENCE.md
├── package.json
└── scripts/
    ├── discover.mjs
    └── lib/
        ├── load.mjs              # Load all .chimera/ inputs
        ├── classify-screens.mjs  # Heuristic screen type
        ├── map-endpoints.mjs     # Endpoint ↔ screen mapping
        ├── map-actions.mjs       # Button/link → action records
        ├── reconstruct-flows.mjs # Nav-graph → linear flows
        └── emit.mjs              # Write the four output files
```

Tests under `tests/scripts/functionality-mapper/`. Fixtures share format with `app-explorer` and `api-mapper`.
