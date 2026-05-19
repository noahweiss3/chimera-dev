# model-inferrer — Spec

## Purpose

Cross-reference the OpenAPI spec, screen specs, and form definitions to infer the underlying data model: entities, fields, types, relationships, constraints. Output a Drizzle ORM schema (PostgreSQL flavor) ready for `app-reconstructor` to use.

## Inputs

- `.chimera/api-spec/openapi.json` (preferred over yaml — already parsed)
- `.chimera/api-spec/endpoint-map.json`
- `.chimera/func-map/screens.json` (used for hints, e.g., forms imply required fields)
- `.chimera/func-map/flows.json` (used to infer entity lifecycle ordering)
- `.chimera/forms/*.json`

## Outputs

```
.chimera/model/
├── schema.ts         Drizzle ORM PostgreSQL schema (pgTable, relations)
├── entities.json     { entities: [Entity] }
├── erd.md            Mermaid ER diagram
└── report.md         Summary, confidence, assumptions
```

### Entity format
```json
{
  "name": "Project",
  "table": "projects",
  "fields": [
    { "name": "id", "type": "uuid", "primary_key": true },
    { "name": "name", "type": "text", "required": true },
    { "name": "description", "type": "text", "required": false },
    { "name": "owner_id", "type": "uuid", "foreign_key": "users.id" },
    { "name": "created_at", "type": "timestamp" },
    { "name": "updated_at", "type": "timestamp" }
  ],
  "relationships": [
    { "type": "belongs_to", "entity": "User", "foreign_key": "owner_id" }
  ],
  "sources": [
    "GET /api/projects (response[].items)",
    "POST /api/projects (response)",
    "GET /api/projects/{id} (response)"
  ]
}
```

## Algorithm

### 1. Extract candidate entities
Walk the OpenAPI document looking for response object schemas. Each unique top-level object shape (set of properties) is a candidate entity.

- For `GET /api/projects` returning `{ projects: [Project] }`: extract `Project` from the array item schema. Entity name = singular of collection name (e.g., `projects` → `Project`).
- For `GET /api/projects/{id}` returning a single `Project`: confirm/merge with the existing `Project` entity.
- For `POST /api/projects` request body: merge fields into `Project` but mark them as `required` if present in the request schema's `required` list.
- Reject empty objects and obvious wrappers (`{ error, message }`).

Entity name resolution:
- Collection endpoint path's last segment, singularized (`projects` → `Project`, `companies` → `Company`).
- Fall back to the object's own `title` if OpenAPI provides one.

Merge entities discovered at multiple endpoints by structural similarity (shared `id` field and ≥50% property overlap).

### 2. Field typing
Map JSON Schema → PostgreSQL/Drizzle type:

| JSON Schema | Drizzle |
|-------------|---------|
| `{ type: integer }` | `integer` |
| `{ type: number }` | `doublePrecision` |
| `{ type: boolean }` | `boolean` |
| `{ type: string, format: date-time }` | `timestamp` |
| `{ type: string, format: email }` | `text` (validated upstream) |
| `{ type: string, format: uri }` | `text` |
| `{ type: string }` | `text` |
| `{ type: array, items: { type: object } }` | (relationship, not column) |
| `{ type: object }` | nested embed → relationship or `jsonb` |

Field-name overrides:
- `id` field with no type or `string` type → `uuid` (assumed UUID primary key)
- `*_id` foreign keys → `uuid`
- `*_at` timestamps when `string` format missing → `timestamp` (assumption)

### 3. Relationships
- **belongs_to**: any field named `<entity>_id` matching a known entity (singular form). Add to source entity.
- **has_many**: implicit reverse direction of every `belongs_to`. Added on the target entity.
- **URL nesting**: `/teams/{teamId}/members` → `Member belongs_to Team` (foreign key `team_id`).
- **Nested object**: `Project.owner` is an embedded `User` → `Project belongs_to User` via `owner_id`. If the property name doesn't already imply a FK column, generate one.

### 4. Constraints
- **Required**: union of (a) properties in the response schema's `required`, (b) properties in the request schema's `required` for POST/PUT/PATCH, (c) form fields marked required.
- **Enums**: from `enum` keywords in JSON Schema or from select fields in forms.
- **Defaults**: best-effort from response samples (e.g., `created_at` defaulting to "now()").

### 5. Emit
- **entities.json**: array of Entity records.
- **schema.ts**: Drizzle PostgreSQL schema:
  ```ts
  import { pgTable, uuid, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
  import { relations } from "drizzle-orm";
  
  export const projects = pgTable("projects", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    ownerId: uuid("owner_id").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  });
  
  export const projectsRelations = relations(projects, ({ one }) => ({
    owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  }));
  ```
- **erd.md**: a Mermaid `erDiagram` block.
- **report.md**: counts, confidence per entity (high if from multiple endpoints, low if single source), flagged ambiguities.

## Edge cases

- **Empty / wrapper objects**: skip (`{ error, message }` patterns, OpenAPI responses with no schema).
- **GraphQL-style endpoints**: heuristics fail; produce best-effort entities and flag in report.
- **Polymorphic responses (`oneOf`)**: split into multiple candidate entities; report.md flags.
- **Cycles in relationships**: emit both directions; let user resolve if loading order matters.

## Architecture

```
skills/model-inferrer/
├── SKILL.md
├── REFERENCE.md
├── package.json
└── scripts/
    ├── discover.mjs
    └── lib/
        ├── load.mjs
        ├── extract-entities.mjs
        ├── infer-relationships.mjs
        ├── emit-drizzle.mjs
        ├── emit-erd.mjs
        └── pluralize.mjs       # singular/plural helpers
```
