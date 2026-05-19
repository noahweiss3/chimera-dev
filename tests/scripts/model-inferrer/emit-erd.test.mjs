import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildErd } from "../../../skills/model-inferrer/scripts/lib/emit-erd.mjs";

const entities = [
  {
    name: "User",
    table: "users",
    fields: [
      { name: "id", type: "uuid", primary_key: true },
      { name: "email", type: "text", required: true },
    ],
    relationships: [{ type: "has_many", entity: "Project", foreign_key: "owner_id" }],
  },
  {
    name: "Project",
    table: "projects",
    fields: [
      { name: "id", type: "uuid", primary_key: true },
      { name: "name", type: "text", required: true },
      { name: "owner_id", type: "uuid", foreign_key: "users.id" },
    ],
    relationships: [{ type: "belongs_to", entity: "User", foreign_key: "owner_id" }],
  },
];

describe("buildErd", () => {
  const md = buildErd(entities);

  it("returns a string containing a mermaid block", () => {
    assert.match(md, /```mermaid/);
    assert.match(md, /erDiagram/);
    assert.match(md, /```\s*$/);
  });

  it("includes an entity block for each entity", () => {
    assert.match(md, /User \{/);
    assert.match(md, /Project \{/);
  });

  it("declares fields with type and name inside the entity block", () => {
    assert.match(md, /uuid id PK/);
    assert.match(md, /text email/);
    assert.match(md, /uuid owner_id FK/);
  });

  it("emits relationship lines", () => {
    assert.match(md, /User \|\|--o\{ Project : has/);
  });
});
