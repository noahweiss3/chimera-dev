# Functionality Mapper Reference

## Output

```
.chimera/func-map/
├── screens.json          { screens: [ScreenSpec] }
├── flows.json            { flows: [Flow] }
├── state-machine.json    { transitions: [Transition] }
└── report.md             Counts + flagged ambiguities
```

## Screen spec

```json
{
  "id": "001",
  "name": "Projects",
  "url": "https://app.example.com/projects",
  "type": "list",
  "section": "projects",
  "auth": true,
  "data_dependencies": [
    { "endpoint": "GET /api/projects", "purpose": "list items", "on_load": true }
  ],
  "actions": [
    {
      "trigger": "button:Create Project",
      "ref": "@0-20",
      "classification": "safe",
      "endpoint": "POST /api/projects",
      "navigates_to": null
    },
    {
      "trigger": "link:Project Alpha",
      "ref": "@0-10",
      "classification": "navigation",
      "endpoint": null,
      "navigates_to": "002"
    }
  ],
  "forms": ["001-search"],
  "destructive_actions_skipped": [
    { "trigger": "button:Delete All", "ref": "@0-21" }
  ]
}
```

## Screen types

| Type | Heuristic |
|------|-----------|
| `form` | ≥1 form with ≥2 input fields |
| `list` | ≥3 links sharing a path prefix |
| `detail` | URL ends in `/{id}`-shaped segment, no list pattern, has content |
| `settings` | section contains "setting"/"preference" or ≥2 toggle-ish buttons |
| `empty` | ≤2 links, 0 buttons, 0 forms |
| `unknown` | none of the above |

Precedence (when multiple match): `form` > `list` > `detail` > `settings` > `empty` > `unknown`.

## Flow spec

```json
{
  "name": "Welcome -> Project Alpha",
  "steps": [
    { "screen": "000", "action": "start" },
    { "screen": "001", "action": "navigate: log in" },
    { "screen": "002", "action": "click link: Project Alpha" }
  ]
}
```

Built by DFS over `nav-graph.edges` starting from screens with no incoming edges (roots). Visited nodes within a chain are not re-entered.

## State machine transition

```json
{
  "name": "action.create-project",
  "from_screen": "001",
  "to_screen": "002",
  "trigger": "button:Create Project",
  "endpoint": "POST /api/projects"
}
```

Emitted for every entry in `actions/submitted/` whose response is 2xx. `to_screen` uses the first nav-graph edge out of `from_screen` after the submit timestamp (best-effort).

## Algorithm

1. Load: read manifest, nav-graph, pages (meta + elements), forms, submitted/skipped actions, and api-spec/endpoint-map (optional).
2. For each page, classify the screen type (heuristic).
3. For each page, derive `data_dependencies` by selecting endpoints whose `pages` list includes the page id.
4. For each page, derive `actions`:
   - Non-destructive buttons: match to a submitted action by `trigger_ref` or `trigger_text` to attribute an endpoint.
   - Links: resolve `navigates_to` by matching `href` against other page URLs; fall back to nav-graph edge labels.
   - Destructive buttons recorded under `destructive_actions_skipped`.
5. Reconstruct flows via DFS over the nav-graph; cap depth at 8.
6. Build state-machine transitions from successful submitted actions.
7. Emit the four files.

## Dependencies

- Node 18+
- No npm dependencies
- Reads `.chimera/` only — does not run `browse`
