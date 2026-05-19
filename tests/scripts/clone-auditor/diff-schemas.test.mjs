import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffSchemas } from "../../../skills/clone-auditor/scripts/lib/diff-schemas.mjs";

describe("diffSchemas", () => {
  it("returns no differences for identical objects", () => {
    const result = diffSchemas({ id: 1, name: "x" }, { id: 1, name: "x" });
    assert.equal(result.missing_in_b.length, 0);
    assert.equal(result.missing_in_a.length, 0);
    assert.equal(result.type_mismatches.length, 0);
  });

  it("detects keys missing in B", () => {
    const result = diffSchemas({ id: 1, name: "x", description: "y" }, { id: 1, name: "x" });
    assert.deepEqual(result.missing_in_b, ["description"]);
  });

  it("detects keys missing in A (extra in B)", () => {
    const result = diffSchemas({ id: 1 }, { id: 1, extra: true });
    assert.deepEqual(result.missing_in_a, ["extra"]);
  });

  it("detects type mismatches at top level", () => {
    const result = diffSchemas({ count: 5 }, { count: "5" });
    assert.equal(result.type_mismatches.length, 1);
    assert.equal(result.type_mismatches[0].path, "count");
    assert.equal(result.type_mismatches[0].a_type, "integer");
    assert.equal(result.type_mismatches[0].b_type, "string");
  });

  it("recurses into nested objects", () => {
    const result = diffSchemas(
      { owner: { id: 1, email: "x" } },
      { owner: { id: 1 } }
    );
    assert.deepEqual(result.missing_in_b, ["owner.email"]);
  });

  it("recurses into arrays", () => {
    const result = diffSchemas(
      { items: [{ id: 1, name: "x" }] },
      { items: [{ id: 1 }] }
    );
    assert.deepEqual(result.missing_in_b, ["items[].name"]);
  });

  it("handles null vs object as a type mismatch", () => {
    const result = diffSchemas({ owner: null }, { owner: { id: 1 } });
    assert.equal(result.type_mismatches.length, 1);
    assert.equal(result.type_mismatches[0].path, "owner");
  });

  it("handles top-level non-object values", () => {
    const result = diffSchemas([1, 2, 3], [1, "x"]);
    assert.ok(result.type_mismatches.find((m) => m.path === "[]"));
  });
});
