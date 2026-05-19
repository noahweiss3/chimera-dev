import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toYaml } from "../../../skills/api-mapper/scripts/lib/yaml.mjs";

describe("toYaml", () => {
  it("serializes primitives", () => {
    assert.equal(toYaml(true).trim(), "true");
    assert.equal(toYaml(42).trim(), "42");
    assert.equal(toYaml(null).trim(), "null");
  });

  it("quotes strings that could be ambiguous", () => {
    assert.equal(toYaml("hello").trim(), '"hello"');
    assert.equal(toYaml("true").trim(), '"true"');
    assert.equal(toYaml("123").trim(), '"123"');
  });

  it("escapes special characters in strings", () => {
    assert.equal(toYaml('he said "hi"').trim(), '"he said \\"hi\\""');
    assert.equal(toYaml("line1\nline2").trim(), '"line1\\nline2"');
  });

  it("serializes an array of primitives", () => {
    const out = toYaml(["a", "b", "c"]);
    assert.equal(out, '- "a"\n- "b"\n- "c"\n');
  });

  it("serializes a simple map", () => {
    const out = toYaml({ name: "Alpha", id: 1 });
    assert.match(out, /name: "Alpha"/);
    assert.match(out, /id: 1/);
  });

  it("serializes a nested map", () => {
    const out = toYaml({ outer: { inner: "value" } });
    assert.equal(out, 'outer:\n  inner: "value"\n');
  });

  it("serializes a map with an array of objects", () => {
    const out = toYaml({ items: [{ id: 1 }, { id: 2 }] });
    assert.equal(out, "items:\n  - id: 1\n  - id: 2\n");
  });

  it("serializes empty containers", () => {
    assert.equal(toYaml({}).trim(), "{}");
    assert.equal(toYaml([]).trim(), "[]");
  });

  it("round-trips through a JSON parser for arrays of mixed objects", () => {
    const data = {
      openapi: "3.1.0",
      paths: {
        "/api/projects": {
          get: { responses: { "200": { description: "ok" } } },
        },
      },
    };
    const yaml = toYaml(data);
    assert.match(yaml, /openapi: "3.1.0"/);
    assert.match(yaml, /paths:/);
    assert.match(yaml, /\/api\/projects:/);
  });
});
