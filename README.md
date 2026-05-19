# Chimera

> Reverse-engineer web applications into fully reconstructed clones.

Chimera is a pipeline of AI-powered skills that systematically explores a web application, extracts its API surface, infers its data model, and reconstructs a working clone.

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│ app-explorer │ ──▶ │  api-mapper  │ ──▶ │functionality-mapper│
│  Browse app  │     │Extract APIs  │     │  Map behaviors    │
└─────────────┘     └─────────────┘     └──────────────────┘
                                                  │
┌─────────────┐     ┌──────────────┐              ▼
│clone-auditor│ ◀── │reconstructor │ ◀── ┌──────────────┐
│  Verify it  │     │  Build clone │     │model-inferrer│
└─────────────┘     └──────────────┘     │ Infer schema │
                                          └──────────────┘
```

## Quick Start

```bash
# Install the skills
npx skills add noahweiss3/chimera-dev

# Open a browser session
browse open https://app.example.com

# Log in to the app, then start exploring
# (The app-explorer skill guides you interactively)
```

## Skills

| Skill | Status | Description |
|-------|--------|-------------|
| **app-explorer** | Available | Systematically explore a web app, capture structure + API traffic |
| **api-mapper** | Available | Extract OpenAPI 3.1 spec, endpoint map, auth scheme, and typed fetch client from captured traffic |
| **functionality-mapper** | Available | Map screens to types, data dependencies, actions, user flows, and state transitions |
| **model-inferrer** | Available | Infer entities, relationships, and a Drizzle PostgreSQL schema from OpenAPI + forms |
| app-reconstructor | Planned | Scaffold a working clone from all prior outputs |
| clone-auditor | Planned | Compare clone against original, identify gaps |

## Requirements

- Node.js 18+
- [browse CLI](https://github.com/browserbase/browse) (`npm install -g browse`)
- [browser-trace](https://github.com/browserbase/skills) (`npx skills add browserbase/skills --skill browser-trace`)
- An AI coding agent that supports skills (Claude Code, Cursor, Copilot, Gemini, etc.)

## Output

The explorer produces a `.chimera/` directory containing:

- **Page captures** — screenshots, accessibility snapshots, extracted elements
- **Navigation graph** — how pages connect to each other
- **Network traces** — all HTTP request/response pairs
- **Form definitions** — every form's fields, types, and validation
- **Action log** — which actions were taken and which were skipped (and why)

## Exploration Modes

- **safe** — Read-only. Clicks navigation, views pages, never submits forms.
- **explore** — Cautious mutations. Fills forms with test data, submits safe actions, skips destructive ones.

## License

MIT
