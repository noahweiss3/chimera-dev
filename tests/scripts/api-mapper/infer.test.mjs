import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  inferSchema,
  mergeSchemas,
} from "../../../skills/api-mapper/scripts/lib/infer.mjs";

describe("inferSchema", () => {
  it("infers null", () => {
    assert.deepEqual(inferSchema(null), { type: "null" });
  });

  it("infers boolean", () => {
    assert.deepEqual(inferSchema(true), { type: "boolean" });
  });

  it("infers integer vs number", () => {
    assert.deepEqual(inferSchema(42), { type: "integer" });
    assert.deepEqual(inferSchema(3.14), { type: "number" });
  });

  it("infers string with date-time format", () => {
    const s = inferSchema("2026-05-18T20:00:00Z");
    assert.equal(s.type, "string");
    assert.equal(s.format, "date-time");
  });

  it("infers string with email format", () => {
    const s = inferSchema("user@example.com");
    assert.equal(s.type, "string");
    assert.equal(s.format, "email");
  });

  it("infers string with uri format", () => {
    const s = inferSchema("https://example.com/path");
    assert.equal(s.type, "string");
    assert.equal(s.format, "uri");
  });

  it("infers plain string without format", () => {
    const s = inferSchema("Hello world");
    assert.deepEqual(s, { type: "string" });
  });

  it("infers array with item schema", () => {
    const s = inferSchema([1, 2, 3]);
    assert.equal(s.type, "array");
    assert.deepEqual(s.items, { type: "integer" });
  });

  it("infers object schema with properties and required", () => {
    const s = inferSchema({ id: 1, name: "Alpha" });
    assert.equal(s.type, "object");
    assert.deepEqual(s.properties.id, { type: "integer" });
    assert.deepEqual(s.properties.name, { type: "string" });
    assert.deepEqual(s.required.sort(), ["id", "name"]);
  });

  it("infers nested object", () => {
    const s = inferSchema({ id: 1, owner: { id: 7, email: "a@b.com" } });
    assert.equal(s.properties.owner.type, "object");
    assert.equal(s.properties.owner.properties.email.format, "email");
  });
});

describe("mergeSchemas", () => {
  it("returns the input when only one schema", () => {
    const s = { type: "integer" };
    assert.deepEqual(mergeSchemas([s]), s);
  });

  it("unions properties across object samples", () => {
    const a = inferSchema({ id: 1, name: "A" });
    const b = inferSchema({ id: 2, name: "B", description: "x" });
    const merged = mergeSchemas([a, b]);
    assert.ok(merged.properties.id);
    assert.ok(merged.properties.name);
    assert.ok(merged.properties.description);
  });

  it("intersects required properties (only present in all)", () => {
    const a = inferSchema({ id: 1, name: "A" });
    const b = inferSchema({ id: 2, name: "B", description: "x" });
    const merged = mergeSchemas([a, b]);
    assert.deepEqual(merged.required.sort(), ["id", "name"]);
  });

  it("merges integer and number into number", () => {
    const merged = mergeSchemas([{ type: "integer" }, { type: "number" }]);
    assert.equal(merged.type, "number");
  });

  it("returns oneOf when types conflict", () => {
    const merged = mergeSchemas([{ type: "string" }, { type: "boolean" }]);
    assert.ok(merged.oneOf);
    assert.equal(merged.oneOf.length, 2);
  });

  it("merges array item schemas", () => {
    const a = inferSchema([{ id: 1, name: "A" }]);
    const b = inferSchema([{ id: 2, name: "B", extra: true }]);
    const merged = mergeSchemas([a, b]);
    assert.equal(merged.type, "array");
    assert.ok(merged.items.properties.extra);
  });

  it("drops format when only some samples have it", () => {
    const merged = mergeSchemas([
      { type: "string", format: "date-time" },
      { type: "string" },
    ]);
    assert.equal(merged.type, "string");
    assert.equal(merged.format, undefined);
  });
});
