# App Explorer Reference

## Output Directory

The explorer writes all captured data to `.chimera/` in the current working directory.

### Directory Structure

```
.chimera/
├── manifest.json              Run metadata, config, timestamps, coverage
├── nav-graph.json             Directed graph of pages and navigation edges
├── pages/
│   └── <page-id>/
│       ├── meta.json          URL, title, timestamp, auth status, section
│       ├── snapshot.json      Raw accessibility tree from browse snapshot
│       ├── screenshot.png     Visual capture
│       └── elements.json      Extracted links, buttons, forms with classifications
├── traces/
│   ├── requests.jsonl         CDP network request events (from browser-trace)
│   ├── responses.jsonl        CDP network response events
│   └── bodies/                Request/response bodies (if browse network was enabled)
├── forms/
│   └── <page-id>-<form-name>.json   Form structure with fields
└── actions/
    ├── submitted/             Actions that were executed (explore mode)
    └── skipped/               Destructive actions identified but not taken
```

### Page IDs

Pages are numbered sequentially: `000`, `001`, `002`, etc. The number reflects visit order, not hierarchy.

### Modes

| Mode | Navigation | Forms | Safe Actions | Destructive Actions |
|------|-----------|-------|-------------|-------------------|
| `safe` | Yes | View only | No | No |
| `explore` | Yes | Fill + submit | Yes | Skipped + recorded |

### Action Classification

Buttons are classified by keyword matching:

**Safe:** create, add, new, save, update, edit, submit, enable, disable, toggle, send, invite, share, publish, upload, import, export, copy, duplicate, rename, assign, approve, confirm, accept

**Destructive:** delete, remove, archive, destroy, revoke, disconnect, unlink, purge, wipe, erase, drop, terminate, cancel, deauthorize, ban, block, reject

**Unknown:** anything else — the explorer will ask the user how to handle these

## Dependencies

- **Node.js 18+**: Required for helper scripts
- **browse CLI**: `npm install -g browse` — browser automation
- **browser-trace**: Install via `npx skills add browserbase/skills --skill browser-trace`

## Troubleshooting

**"No active browser session"**: Run `browse open <url>` first, then invoke the skill.

**Network trace not capturing**: Ensure `browser-trace` is installed. The init script will report if trace startup fails. Network capture is optional — the explorer still captures page structure without it.

**Screenshots missing**: `browse screenshot` requires a visible browser window. In headless/remote mode, screenshots may be blank. This doesn't affect exploration quality.

**SPA navigation not detected**: Some SPAs don't change the URL when navigating. The explorer uses the accessibility tree to detect content changes, but may need user guidance for unusual routing patterns.
