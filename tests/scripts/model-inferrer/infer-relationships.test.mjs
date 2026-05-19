import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inferRelationships } from "../../../skills/model-inferrer/scripts/lib/infer-relationships.mjs";

function ent(name, fields) {
  return {
    name,
    table: name.toLowerCase() + "s",
    fields,
    relationships: [],
    sources: [],
    nestedObjects: [],
  };
}

describe("inferRelationships", () => {
  it("adds belongs_to from *_id fields matching another entity", () => {
    const entities = [
      ent("Project", [
        { name: "id", type: "uuid", primary_key: true },
        { name: "owner_id", type: "uuid" },
      ]),
      ent("User", [{ name: "id", type: "uuid", primary_key: true }]),
    ];
    const result = inferRelationships({ entities, openapi: { paths: {} } });
    const project = result.find((e) => e.name === "Project");
    const belongsTo = project.relationships.find((r) => r.type === "belongs_to");
    assert.ok(belongsTo);
    assert.equal(belongsTo.entity, "User");
    assert.equal(belongsTo.foreign_key, "owner_id");
  });

  it("sets foreign_key reference on the *_id field", () => {
    const entities = [
      ent("Project", [
        { name: "owner_id", type: "uuid" },
      ]),
      ent("User", [{ name: "id", type: "uuid" }]),
    ];
    const result = inferRelationships({ entities, openapi: { paths: {} } });
    const fk = result.find((e) => e.name === "Project").fields.find((f) => f.name === "owner_id");
    assert.equal(fk.foreign_key, "users.id");
  });

  it("adds has_many reverse on the target entity", () => {
    const entities = [
      ent("Project", [{ name: "owner_id", type: "uuid" }]),
      ent("User", [{ name: "id", type: "uuid" }]),
    ];
    const result = inferRelationships({ entities, openapi: { paths: {} } });
    const user = result.find((e) => e.name === "User");
    const hasMany = user.relationships.find((r) => r.type === "has_many");
    assert.ok(hasMany);
    assert.equal(hasMany.entity, "Project");
    assert.equal(hasMany.foreign_key, "owner_id");
  });

  it("infers nested URL relationships /teams/{id}/members -> Member belongs_to Team", () => {
    const entities = [
      ent("Team", [{ name: "id", type: "uuid" }]),
      ent("Member", [{ name: "id", type: "uuid" }]),
    ];
    const openapi = {
      paths: {
        "/api/teams/{id}/members": {
          get: { responses: {} },
        },
      },
    };
    const result = inferRelationships({ entities, openapi });
    const member = result.find((e) => e.name === "Member");
    const belongsTo = member.relationships.find((r) => r.type === "belongs_to" && r.entity === "Team");
    assert.ok(belongsTo);
    assert.equal(belongsTo.foreign_key, "team_id");
    const teamFk = member.fields.find((f) => f.name === "team_id");
    assert.ok(teamFk, "expected team_id to be added to Member entity");
  });

  it("handles nested response objects (Project.owner -> User)", () => {
    const project = ent("Project", [
      { name: "id", type: "uuid", primary_key: true },
      { name: "owner_id", type: "uuid" },
    ]);
    project.nestedObjects = [{ name: "owner", schema: { type: "object" } }];
    const entities = [project, ent("User", [{ name: "id", type: "uuid" }])];
    const result = inferRelationships({ entities, openapi: { paths: {} } });
    const proj = result.find((e) => e.name === "Project");
    const owner = proj.relationships.find((r) => r.type === "belongs_to" && r.entity === "User");
    assert.ok(owner);
  });

  it("doesn't create relationships when the target entity doesn't exist", () => {
    const entities = [
      ent("Project", [{ name: "missing_id", type: "uuid" }]),
    ];
    const result = inferRelationships({ entities, openapi: { paths: {} } });
    assert.equal(result[0].relationships.length, 0);
  });
});
