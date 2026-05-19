# API Mapper Reference

## Output

```
.chimera/api-spec/
├── openapi.yaml          OpenAPI 3.1 in YAML
├── openapi.json          Same in JSON
├── endpoint-map.json     [{ method, path_template, pages, samples }]
├── auth-scheme.json      Detected auth scheme
├── client.mjs            Zero-dep async fetch client
└── report.md             Human-readable summary
```

## Algorithm

1. **Load** — Stream-parse `traces/requests.jsonl` and `traces/responses.jsonl`; pair by `requestId`; attach `bodies/<id>.{req,res}.json` if present. Also ingest `actions/submitted/*.json`.
2. **Filter** — Drop static assets (`.css`, `.js`, fonts, images), analytics hosts (`google-analytics`, `segment.io`, `sentry.io`, etc.), and exchanges whose origin doesn't match the explorer's `target_url`.
3. **Templatize** — For each remaining URL, replace UUIDs / 24-char hex / numeric segments with `{id}`. Group exchanges by `(method, template)`.
4. **Infer schemas** — Walk each JSON sample → JSON Schema (draft 2020-12). Merge across samples per endpoint: union properties; `required` = intersection of keys; conflicting types → `oneOf`; detect `date-time`, `email`, `uri` formats from strings.
5. **Detect auth** — Inspect request headers:
   - `Authorization: Bearer …` → `bearer`. JWT structure (3 dot-separated base64url parts) → `token_pattern: jwt`, else `opaque`.
   - `Cookie: …` containing a known session name (`session`, `sid`, `connect.sid`, `*_session`, etc.) → `cookie`.
   - `X-API-Key`, `Api-Key`, `X-Auth-Token` → `api-key`.
   - Otherwise → `none`.
6. **Map to pages** — For each endpoint, find page IDs whose `meta.json.timestamp` is within 30 seconds of an exchange in that endpoint.
7. **Emit** — Build the OpenAPI document, the endpoint map, the auth scheme, the client source, and the markdown report.

## OpenAPI document structure

- `openapi: "3.1.0"`
- `info.title`, `info.version`, `info.description` — defaults provided; the LLM can override these post-hoc.
- `servers` — single entry from manifest's `target_url`.
- `paths` — keyed by templated path. Each operation has `parameters` (path), optional `requestBody` with JSON schema, `responses` keyed by observed status codes.
- `components.securitySchemes` — populated when auth detected.
- `security` — references the appropriate scheme globally.

## Client conventions

- Each endpoint becomes `<method><Path>` (camelCase). `{id}` and `{slug}` segments become `ByX`.
- Path params: positional. Options: trailing object with `body`, `query`, `headers`, `baseUrl`, `token`/`apiKey`/`cookie`.
- Returns `{ status, headers, body }`. JSON bodies are auto-parsed.
- Credentials read from option first, then env: `CHIMERA_BASE_URL`, `CHIMERA_TOKEN`, `CHIMERA_API_KEY`.

## Limitations / known gaps

- **GraphQL** is not specially recognized — all POSTs to a single endpoint will look like one endpoint with widely varying request bodies, producing a `oneOf` request body schema.
- **WebSockets / SSE / streaming** responses aren't modeled.
- **OAuth flows** are not reconstructed; only the resulting bearer token usage is detected.
- **Required vs optional fields**: inferred from sample intersection. A field missing from one sample is treated as optional even if it's actually required (and just wasn't present in the response payload).

## Dependencies

- Node 18+ (uses built-in `fetch`, `URL`, `node:test`).
- No npm dependencies.
- The skill itself does not run `browse`; it only reads the `.chimera/` directory.
