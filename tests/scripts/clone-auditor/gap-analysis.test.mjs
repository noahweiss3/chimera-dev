import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { analyzeGaps } from "../../../skills/clone-auditor/scripts/lib/gap-analysis.mjs";

const FIXTURE = resolve(import.meta.dirname, "../../fixtures/clone-auditor");
const chimeraDir = resolve(FIXTURE, "chimera");
const cloneDir = resolve(FIXTURE, "clone");

describe("analyzeGaps", () => {
  const result = analyzeGaps({ chimeraDir, cloneDir });

  it("flags routes still containing TODO(chimera) markers", () => {
    const stubbed = result.stubbed_routes.find((r) => r.entity === "users");
    assert.ok(stubbed, "expected users route to be flagged as stubbed");
  });

  it("does not flag routes that have been filled in", () => {
    const filled = result.stubbed_routes.find((r) => r.entity === "projects");
    assert.equal(filled, undefined);
  });

  it("flags pages still containing TODO(chimera) markers", () => {
    const stubbed = result.stubbed_pages.find((p) => p.screen === "002");
    assert.ok(stubbed);
  });

  it("does not flag pages that have been filled in", () => {
    const filled = result.stubbed_pages.find((p) => p.screen === "001");
    assert.equal(filled, undefined);
  });

  it("flags entities missing from schema.ts", () => {
    const missing = result.missing_entities_in_schema.find((e) => e.entity === "User");
    assert.ok(missing);
  });

  it("does not flag entities present in schema.ts", () => {
    const present = result.missing_entities_in_schema.find((e) => e.entity === "Project");
    assert.equal(present, undefined);
  });

  it("populates summary with counts by category", () => {
    assert.ok(result.summary);
    assert.ok(typeof result.summary.total_gaps === "number");
    assert.ok(result.summary.total_gaps >= 3);
  });

  it("flags ALL endpoints/pages/entities as gaps when clone is missing", () => {
    const r2 = analyzeGaps({ chimeraDir, cloneDir: "/nonexistent" });
    assert.ok(r2.summary.total_gaps >= 5);
    assert.equal(r2.missing_routes.length >= 1, true);
    assert.equal(r2.missing_pages.length >= 1, true);
  });
});
