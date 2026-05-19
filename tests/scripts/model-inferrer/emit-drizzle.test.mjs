import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDrizzleSchema } from "../../../skills/model-inferrer/scripts/lib/emit-drizzle.mjs";

const entities = [
  {
    name: "User",
    table: "users",
    fields: [
      { name: "id", type: "uuid", primary_key: true, required: true },
      { name: "email", type: "text", required: true },
      { name: "name", type: "text", required: false },
      { name: "created_at", type: "timestamp", required: false },
    ],
    relationships: [
      { type: "has_many", entity: "Project", foreign_key: "owner_id" },
    ],
  },
  {
    name: "Project",
    table: "projects",
    fields: [
      { name: "id", type: "uuid", primary_key: true, required: true },
      { name: "name", type: "text", required: true },
      { name: "description", type: "text", required: false },
      { name: "owner_id", type: "uuid", foreign_key: "users.id", required: true },
      { name: "created_at", type: "timestamp", required: false },
    ],
    relationships: [
      { type: "belongs_to", entity: "User", foreign_key: "owner_id" },
    ],
  },
];

describe("buildDrizzleSchema", () => {
  const src = buildDrizzleSchema(entities);

  it("returns a string", () => {
    assert.equal(typeof src, "string");
  });

  it("imports the drizzle-orm packages", () => {
    assert.match(src, /from "drizzle-orm\/pg-core"/);
    assert.match(src, /from "drizzle-orm"/);
  });

  it("emits a pgTable for each entity using the table name", () => {
    assert.match(src, /export const users = pgTable\("users",/);
    assert.match(src, /export const projects = pgTable\("projects",/);
  });

  it("uses camelCase column names with the snake_case DB column", () => {
    assert.match(src, /createdAt:\s*timestamp\("created_at"\)/);
    assert.match(src, /ownerId:\s*uuid\("owner_id"\)/);
  });

  it("emits primaryKey().defaultRandom() for uuid id", () => {
    assert.match(src, /id:\s*uuid\("id"\)\.primaryKey\(\)\.defaultRandom\(\)/);
  });

  it("emits .notNull() for required columns", () => {
    assert.match(src, /email:\s*text\("email"\)\.notNull\(\)/);
    assert.match(src, /name:\s*text\("name"\)(?!\.notNull)/);
  });

  it("emits foreign-key references", () => {
    assert.match(src, /\.references\(\(\) => users\.id\)/);
  });

  it("emits relations() blocks for belongs_to", () => {
    assert.match(src, /export const projectsRelations = relations\(projects, /);
    assert.match(src, /one\(users, \{ fields: \[projects\.ownerId\], references: \[users\.id\] \}\)/);
  });

  it("emits relations() blocks for has_many", () => {
    assert.match(src, /export const usersRelations = relations\(users, /);
    assert.match(src, /many\(projects\)/);
  });
});
