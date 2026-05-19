# api-mapper — Spec

## Purpose

Consume the network traces and page metadata produced by `app-explorer`. Deduplicate API endpoints, templatize URLs, infer JSON Schema for request/response bodies, detect the auth scheme, and emit an OpenAPI 3.1 specification plus a zero-dependency JS client.

## Inputs

- `.chimera/traces/requests.jsonl` — one CDP `Network.requestWillBeSent` event per line
- `.chimera/traces/responses.jsonl` — one CDP `Network.responseReceived` event per line
- `.chimera/traces/bodies/<requestId>.{req,res}.{json,bin}` — request/response bodies keyed by CDP requestId (optional; missing files are tolerated)
- `.chimera/pages/<id>/meta.json` — page timestamps for cross-referencing API calls to pages
- `.chimera/actions/submitted/*.json` — mutation request/response pairs (already paired, used as ground truth for POST/PATCH/DELETE)
- `.chimera/manifest.json` — target_url (origin) used as the default "app origin" filter

## Outputs

```
.chimera/api-spec/
├── openapi.yaml          # OpenAPI 3.1 document
├── openapi.json          # Same spec in JSON form
├── endpoint-map.json     # { endpoints: [{ method, path_template, pages: [page_ids], samples: count }] }
├── auth-scheme.json      # { type, header?, cookie_name?, token_pattern? }
├── client.mjs            # Zero-dep fetch client with one async function per endpoint
└── report.md             # Coverage summary
```

## Algorithm

### 1. Load
Stream-parse `requests.jsonl` and `responses.jsonl` (one JSON per line, ignore blank lines, surface parse errors with line numbers). Index by `requestId`. Pair request with response. Attach body files if present (`<requestId>.req.json`, `<requestId>.res.json`, `<requestId>.res.bin`). Result: array of `Exchange` objects.

```
Exchange = {
  request_id, method, url, request_headers, request_body,
  status, response_headers, response_body, mime_type, timestamp
}
```

Also: ingest `.chimera/actions/submitted/*.json` and convert to `Exchange` objects (they're already paired and contain the cleanest data).

### 2. Filter
Drop exchanges that are not API calls:
- MIME types: anything starting with `image/`, `font/`, `text/css`, `text/html`, `video/`, `audio/`
- File extensions in URL path: `.css`, `.js`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.woff`, `.woff2`, `.ttf`, `.ico`, `.map`
- Known analytics/tracking origins: hosts containing `google-analytics`, `googletagmanager`, `segment.io`, `mixpanel`, `amplitude`, `sentry.io`, `datadog`, `intercom`, `hotjar`, `fullstory`, `posthog`
- Methods: keep only GET, POST, PUT, PATCH, DELETE, OPTIONS (OPTIONS recorded but not emitted as endpoints — used for CORS auth inference)
- Origin filter: keep exchanges whose URL origin matches the manifest's `target_url` origin OR an origin that appears with relative paths in `actions/submitted/*.json`

### 3. Templatize
For each remaining exchange, derive a path template:
- Split path on `/`
- For each segment, classify:
  - UUID v1-v5 (regex `^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`) → `{id}`
  - All-numeric (`^\d+$`) → `{id}`
  - 24-char hex (Mongo ObjectId, `^[0-9a-f]{24}$`) → `{id}`
  - Slug heuristic: segment that varies across same-shape paths AND contains `-` AND length 4-80 → `{slug}`
- Group exchanges by `(method, template)`. Each group becomes one Endpoint.

### 4. Schema inference
For each Endpoint, collect all request bodies and all response bodies (by status code). For each set of JSON samples:
- Infer JSON Schema (draft 2020-12) by walking the tree:
  - `null` → `{ "type": "null" }`
  - boolean → `{ "type": "boolean" }`
  - number → `{ "type": "integer" }` if all samples are integers else `{ "type": "number" }`
  - string → `{ "type": "string" }`; if all samples match ISO-8601 timestamp, add `"format": "date-time"`; if all match email, add `"format": "email"`; if all match URL, add `"format": "uri"`
  - array → `{ "type": "array", "items": <merged-schema-of-items> }`
  - object → `{ "type": "object", "properties": {...}, "required": [...] }` where `required` is the intersection of keys across samples
- Merge across samples: union of property keys; a property is `required` only if present in all samples; types within `oneOf` if conflicting.

Skip schema inference for non-JSON bodies (record as `application/octet-stream`).

### 5. Auth detection
Inspect request headers across all exchanges:
- If `Authorization: Bearer <token>` consistently appears → `type: "bearer"`, capture the token pattern (e.g., JWT structure detected by 3 base64url parts separated by `.`)
- Else if `Cookie:` header includes a recurring session-name pattern (`session`, `sid`, `auth_token`, `connect.sid`, `_session`, `*_sess`) → `type: "cookie"`, capture cookie name
- Else if `X-API-Key` or `Api-Key` header → `type: "api-key"`, capture header name
- Else `type: "none"`

### 6. Page mapping
For each Endpoint, look up which page meta.json timestamps bracket the earliest exchange of that endpoint. Record `pages: [page_ids]` listing every page that triggered this endpoint at least once (window: page timestamp ± 30s).

### 7. Emit
- **openapi.json / openapi.yaml**: standard OpenAPI 3.1 doc. Paths from templates; methods from endpoint methods; request body from inferred request schema (when present); responses keyed by status code with inferred response schemas; `components.securitySchemes` from auth detection; global `security` entry referencing the scheme.
- **endpoint-map.json**: array of `{ method, path_template, pages, samples }` sorted by path_template then method.
- **auth-scheme.json**: detected scheme.
- **client.mjs**: For each endpoint, an exported async function. Function name derives from method + path: `getUsersById`, `postProjects`, etc. Function takes path params as positional args, then an `{ body, query, headers }` options object. Uses `fetch`. Reads base URL and auth from `options.baseUrl` and `options.token` (or environment).
- **report.md**: counts (endpoints, samples, coverage), top endpoints by sample count, list of unmapped pages, auth scheme summary.

## Edge Cases

- **Missing trace files**: If `requests.jsonl` is absent but `actions/submitted/*.json` exist, run from actions only.
- **No JSON bodies**: Emit endpoints with no request/response schema; record `content-type` from headers.
- **Conflicting schemas**: Use `oneOf` rather than collapsing; the LLM can simplify later.
- **Empty traces**: Emit a valid-but-empty OpenAPI doc and a report.md that flags the issue.
- **Yaml emission**: Use a tiny built-in YAML emitter (no dependencies). Only emit a safe subset: scalars (quoted strings, numbers, booleans, null), arrays, maps, all 2-space indented.

## Architecture & File Layout

```
skills/api-mapper/
├── SKILL.md
├── REFERENCE.md
├── package.json
└── scripts/
    ├── discover.mjs              # Orchestrator
    ├── lib/
    │   ├── load.mjs              # Parse JSONL, pair, attach bodies
    │   ├── filter.mjs            # Noise filter
    │   ├── templatize.mjs        # URL → template
    │   ├── infer.mjs             # JSON → JSON Schema
    │   ├── auth.mjs              # Auth scheme detection
    │   ├── emit-openapi.mjs      # OpenAPI doc builder
    │   ├── emit-client.mjs       # client.mjs generator
    │   └── yaml.mjs              # Minimal YAML serializer
```

Tests under `tests/scripts/api-mapper/*.test.mjs` with fixtures in `tests/fixtures/api-mapper/`.

## Conventions

- All scripts ESM, no npm deps, Node 18+
- Each script importable as a library (`export function X`) and runnable as a CLI (`if (import.meta.url === ...)`)
- Scripts emit JSON to stdout on completion; errors as `{ "error": "...", "context": {...} }`
- Idempotent: re-running `discover.mjs` overwrites `.chimera/api-spec/` cleanly
