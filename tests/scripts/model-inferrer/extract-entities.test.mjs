import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractEntities } from "../../../skills/model-inferrer/scripts/lib/extract-entities.mjs";

const openapi = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "../../fixtures/model-inferrer/api-spec/openapi.json"),
    "utf-8"
  )
);

describe("extractEntities", () => {
  const entities = extractEntities({ openapi });

  it("discovers Project entity from list, detail, and create endpoints", () => {
    const project = entities.find((e) => e.name === "Project");
    assert.ok(project, "expected Project entity");
    assert.equal(project.table, "projects");
  });

  it("discovers User entity from /api/users/me", () => {
    const user = entities.find((e) => e.name === "User");
    assert.ok(user, "expected User entity");
  });

  it("Project entity has expected fields", () => {
    const project = entities.find((e) => e.name === "Project");
    const names = project.fields.map((f) => f.name).sort();
    assert.ok(names.includes("id"));
    assert.ok(names.includes("name"));
    assert.ok(names.includes("description"));
    assert.ok(names.includes("owner_id"));
    assert.ok(names.includes("created_at"));
  });

  it("infers uuid for id and *_id fields", () => {
    const project = entities.find((e) => e.name === "Project");
    const id = project.fields.find((f) => f.name === "id");
    assert.equal(id.type, "uuid");
    assert.equal(id.primary_key, true);
    const ownerId = project.fields.find((f) => f.name === "owner_id");
    assert.equal(ownerId.type, "uuid");
  });

  it("infers timestamp for *_at fields", () => {
    const project = entities.find((e) => e.name === "Project");
    const createdAt = project.fields.find((f) => f.name === "created_at");
    assert.equal(createdAt.type, "timestamp");
  });

  it("marks required fields", () => {
    const project = entities.find((e) => e.name === "Project");
    const name = project.fields.find((f) => f.name === "name");
    assert.equal(name.required, true);
  });

  it("marks optional fields", () => {
    const project = entities.find((e) => e.name === "Project");
    const desc = project.fields.find((f) => f.name === "description");
    assert.equal(desc.required, false);
  });

  it("records sources for traceability", () => {
    const project = entities.find((e) => e.name === "Project");
    assert.ok(project.sources.length >= 2, `expected ≥2 sources, got ${project.sources.length}`);
  });

  it("skips wrapper schemas (no useful entity from { error, message })", () => {
    const errorOpenapi = {
      paths: {
        "/api/error": {
          get: {
            responses: {
              "500": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { error: { type: "string" }, message: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    const result = extractEntities({ openapi: errorOpenapi });
    assert.equal(result.length, 0);
  });
});
