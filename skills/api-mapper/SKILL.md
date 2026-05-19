---
name: api-mapper
description: "Generate an OpenAPI 3.1 specification, endpoint map, auth scheme, and typed fetch client from network traffic captured by app-explorer. Use after app-explorer when the user wants to reverse-engineer an app's API surface."
compatibility: "Requires Node 18+ and a .chimera/ directory produced by app-explorer."
license: MIT
allowed-tools: Bash, Read, Grep
---

# Chimera API Mapper

Consume the captured `.chimera/` traces and produce a structured OpenAPI spec plus a zero-dependency JS client.

## When to use

- The user has already run `app-explorer` and has a `.chimera/` directory.
- They want an OpenAPI document, an endpoint inventory, or a fetch client for the explored app.

## Setup check

```bash
test -d .chimera && echo "ok" || echo "MISSING: run app-explorer first"
test -f .chimera/manifest.json && echo "manifest ok"
```

If `.chimera/` is missing, ask the user to run `app-explorer` first.

## Run the discovery

```bash
node skills/api-mapper/scripts/discover.mjs
```

This loads `.chimera/traces/*.jsonl`, the body files, and `.chimera/actions/submitted/*.json`; filters noise (analytics, fonts, third-party); templatizes URLs (numeric IDs and UUIDs → `{id}`); infers JSON Schema from request and response bodies; detects the auth scheme; and writes everything to `.chimera/api-spec/`.

## Review the output

Inspect the emitted files. Pay attention to:

1. **`report.md`** — top-level summary. Sanity-check endpoint count and the auth scheme.
2. **`endpoint-map.json`** — list of `(method, path_template)` pairs. Look for surprises: duplicate templates that should merge, endpoints with only one sample (likely lower confidence).
3. **`openapi.yaml`** — the spec. Spot-check 1-2 endpoints: are required fields correct? Are types reasonable? If response samples disagreed, you'll see `oneOf` — flag these to the user.
4. **`auth-scheme.json`** — the detected scheme. If `type: none`, the explorer may have run unauthenticated; ask the user whether that's expected.
5. **`client.mjs`** — generated fetch client. One function per endpoint. Reads base URL and credentials from options/env.

## Reporting to the user

Summarize concisely:

> "Mapped **{N}** endpoints from {M} samples. Auth: **{scheme}**. Output in `.chimera/api-spec/`. **{K}** endpoints have only one sample (lower confidence). See `report.md` for the full breakdown."

If the report flags unmapped pages or warnings, surface them.

## Edge cases to communicate

- **No JSON bodies captured**: spec will have empty request/response schemas. Bodies require `browse network on` during exploration.
- **Empty `traces/`**: discovery falls back to `actions/submitted/`. Coverage will be limited to forms exercised in `explore` mode.
- **`oneOf` in responses**: indicates two samples disagreed structurally. May be a real polymorphic response, or noise. Flag to the user.

## Iterating

If the user wants to expand coverage, suggest they re-run `app-explorer` over the missing sections, then re-run `api-mapper`. The script is idempotent — it overwrites `.chimera/api-spec/` cleanly.
