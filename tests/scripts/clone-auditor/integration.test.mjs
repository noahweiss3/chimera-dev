import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  cpSync,
  mkdtempSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { discover } from "../../../skills/clone-auditor/scripts/discover.mjs";
import { diffVisual } from "../../../skills/clone-auditor/scripts/diff-visual.mjs";

const FIXTURE = resolve(import.meta.dirname, "../../fixtures/clone-auditor");

describe("clone-auditor integration: discover()", () => {
  let workDir, chimeraDir, cloneDir, result;

  before(() => {
    workDir = mkdtempSync(resolve(tmpdir(), "chimera-audit-"));
    chimeraDir = resolve(workDir, ".chimera");
    cloneDir = resolve(workDir, "chimera-clone");
    cpSync(resolve(FIXTURE, "chimera"), chimeraDir, { recursive: true });
    cpSync(resolve(FIXTURE, "clone"), cloneDir, { recursive: true });
    result = discover({ chimeraDir, cloneDir });
  });

  after(() => {
    if (workDir && existsSync(workDir)) rmSync(workDir, { recursive: true });
  });

  it("writes gap-analysis.json, recommendations.md, report.md", () => {
    for (const f of ["gap-analysis.json", "recommendations.md", "report.md"]) {
      assert.ok(existsSync(resolve(chimeraDir, "audit", f)), `missing ${f}`);
    }
  });

  it("reports the expected gaps in the fixture clone", () => {
    const gaps = JSON.parse(
      readFileSync(resolve(chimeraDir, "audit/gap-analysis.json"), "utf-8")
    );
    assert.ok(gaps.stubbed_routes.find((r) => r.entity === "users"));
    assert.ok(gaps.stubbed_pages.find((p) => p.screen === "002"));
    assert.ok(gaps.missing_entities_in_schema.find((e) => e.entity === "User"));
  });

  it("returns a summary with non-zero gap count", () => {
    assert.equal(result.status, "done");
    assert.ok(result.total_gaps >= 3);
  });

  it("recommendations.md mentions stubbed_routes and stubbed_pages sections", () => {
    const md = readFileSync(resolve(chimeraDir, "audit/recommendations.md"), "utf-8");
    assert.match(md, /stubbed_routes/);
    assert.match(md, /stubbed_pages/);
  });
});

describe("diffVisual()", () => {
  let workDir, chimeraDir;

  before(() => {
    workDir = mkdtempSync(resolve(tmpdir(), "chimera-audit-vis-"));
    chimeraDir = resolve(workDir, ".chimera");
    cpSync(resolve(FIXTURE, "chimera"), chimeraDir, { recursive: true });
    // Create a fake screenshot file to exercise the path
    const pagesShotsDir = resolve(chimeraDir, "pages/001");
    mkdirSync(pagesShotsDir, { recursive: true });
    writeFileSync(resolve(pagesShotsDir, "screenshot.png"), "fake-png-bytes");
  });

  after(() => {
    if (workDir && existsSync(workDir)) rmSync(workDir, { recursive: true });
  });

  it("generates an HTML diff page when a screenshot exists", () => {
    // We need to write a fake screenshot at the expected path
    const r = diffVisual({ chimeraDir });
    assert.equal(r.status, "done");
    assert.ok(r.generated >= 1, `expected ≥1 html file, got ${r.generated}`);
    const expectedHtml = resolve(chimeraDir, "audit/visual-diffs/Projects.html");
    assert.ok(existsSync(expectedHtml));
    const html = readFileSync(expectedHtml, "utf-8");
    assert.match(html, /<title>Projects/);
    assert.match(html, /Original/);
    assert.match(html, /Clone/);
  });
});
