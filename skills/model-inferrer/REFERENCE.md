# Model Inferrer Reference

## Output

```
.chimera/model/
├── entities.json    { entities: [Entity] }
├── schema.ts        Drizzle PostgreSQL schema
├── erd.md           Mermaid ER diagram
└── report.md        Summary + confidence per entity
```

## Entity format

```json
{
  "name": "Project",
  "table": "projects",
  "fields": [
    { "name": "id", "type": "uuid", "primary_key": true, "required": true },
    { "name": "name", "type": "text", "required": true },
    { "name": "description", "type": "text", "required": false },
    { "name": "owner_id", "type": "uuid", "foreign_key": "users.id", "required": true },
    { "name": "created_at", "type": "timestamp", "required": false }
  ],
  "relationships": [
    { "type": "belongs_to", "entity": "User", "foreign_key": "owner_id" }
  ],
  "sources": [
    "GET /api/projects (response 200)",
    "POST /api/projects (response 201)",
    "GET /api/projects/{id} (response 200)"
  ]
}
```

## Type mapping

| Source | Drizzle |
|--------|---------|
| `id` field | `uuid` (primary key, defaultRandom) |
| `*_id` field | `uuid` (foreign key) |
| `*_at` field | `timestamp` (defaultNow) |
| `string` with `format: date-time` | `timestamp` |
| `integer` | `integer` |
| `number` | `doublePrecision` |
| `boolean` | `boolean` |
| `string` (any other) | `text` |
| `object` (non-relational) | `jsonb` |

## Relationship inference

1. **Direct FK**: `<entity_singular>_id` matches an entity name → `belongs_to`.
2. **Role aliases**: `owner_id`, `author_id`, `creator_id`, `assignee_id`, `reporter_id`, `requester_id`, `approver_id`, `reviewer_id`, `member_id`, `actor_id` → `User` (if a User entity exists).
3. **URL nesting**: `/api/teams/{id}/members` → `Member belongs_to Team` via `team_id`. Adds the FK column if missing.
4. **Nested response object**: `Project.owner` (nested object) → `Project belongs_to User` via `owner_id` (creates FK column if missing).

For every `belongs_to`, the reverse `has_many` is added on the target entity.

## Structural merging

After extraction, the inferrer collapses redundant entities. If entity A has fewer fields than entity B AND every field name in A is also in B AND both have an `id` field, A is merged into B. This catches cases like nested `owner` objects with `{id, email}` being absorbed by a full `User` entity.

## Drizzle output conventions

- `pgTable("snake_case_table", { … })` — snake-case DB column names
- camelCase JS property names: `created_at` → `createdAt`
- `id` (uuid type, primary key) → `uuid("id").primaryKey().defaultRandom()`
- FK reference → `.references(() => parent.id)`
- timestamp ending in `_at` → `.defaultNow()`
- required field → `.notNull()` (except primary keys, which are implicitly notNull via `.primaryKey()`)
- enum values from JSON Schema → emitted as `/* enum: "a", "b" */` comment (Drizzle's enum types vary by version, so this is left for the user to wire up)

## Confidence

An entity's confidence is `high` if it was sourced from ≥2 endpoints (e.g., list + detail), `low` if only one. Low-confidence entities are listed at the bottom of `report.md` for review.

## Dependencies

- Node 18+
- No npm dependencies
- Reads `.chimera/api-spec/openapi.json` and `.chimera/forms/*.json`
