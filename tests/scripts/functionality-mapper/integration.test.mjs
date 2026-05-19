import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { rmSync, existsSync, readFileSync, cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { discover } from "../../../skills/functionality-mapper/scripts/discover.mjs";

const FIXTURE_ROOT = resolve(import.meta.dirname, "../../fixtures/functionality-mapper");

describe("functionality-mapper integration: discover()", () => {
  let workDir, chimeraDir, result;

  before(() => {
    workDir = mkdtempSync(resolve(tmpdir(), "chimera-fm-"));
    chimeraDir = resolve(workDir, ".chimera");
    cpSync(FIXTURE_ROOT, chimeraDir, { recursive: true });
    result = discover({ chimeraDir });
  });

  after(() => {
    if (workDir && existsSync(workDir)) rmSync(workDir, { recursive: true });
  });

  it("writes screens.json, flows.json, state-machine.json, report.md", () => {
    for (const f of ["screens.json", "flows.json", "state-machine.json", "report.md"]) {
      assert.ok(existsSync(resolve(chimeraDir, "func-map", f)), `missing ${f}`);
    }
  });

  it("classifies screens by type", () => {
    const { screens } = JSON.parse(
      readFileSync(resolve(chimeraDir, "func-map/screens.json"), "utf-8")
    );
    const byId = Object.fromEntries(screens.map((s) => [s.id, s.type]));
    assert.equal(byId["000"], "empty");
    assert.equal(byId["001"], "list");
    assert.equal(byId["002"], "detail");
  });

  it("attaches data_dependencies to screens from endpoint-map", () => {
    const { screens } = JSON.parse(
      readFileSync(resolve(chimeraDir, "func-map/screens.json"), "utf-8")
    );
    const list = screens.find((s) => s.id === "001");
    const endpoints = list.data_dependencies.map((d) => d.endpoint);
    assert.ok(endpoints.includes("GET /api/projects"));
    assert.ok(endpoints.includes("POST /api/projects"));
  });

  it("captures destructive actions separately", () => {
    const { screens } = JSON.parse(
      readFileSync(resolve(chimeraDir, "func-map/screens.json"), "utf-8")
    );
    const list = screens.find((s) => s.id === "001");
    assert.equal(list.destructive_actions_skipped.length, 1);
    assert.equal(list.destructive_actions_skipped[0].trigger, "button:Delete All");
  });

  it("resolves link navigation via URL matching", () => {
    const { screens } = JSON.parse(
      readFileSync(resolve(chimeraDir, "func-map/screens.json"), "utf-8")
    );
    const list = screens.find((s) => s.id === "001");
    const alpha = list.actions.find((a) => a.trigger === "link:Project Alpha");
    assert.equal(alpha.navigates_to, "002");
  });

  it("emits a state-machine transition for the submitted action", () => {
    const { transitions } = JSON.parse(
      readFileSync(resolve(chimeraDir, "func-map/state-machine.json"), "utf-8")
    );
    const create = transitions.find((t) => t.trigger === "button:Create Project");
    assert.ok(create);
    assert.equal(create.endpoint, "POST /api/projects");
    assert.equal(create.from_screen, "001");
  });

  it("reconstructs the 000 -> 001 -> 002 flow", () => {
    const { flows } = JSON.parse(
      readFileSync(resolve(chimeraDir, "func-map/flows.json"), "utf-8")
    );
    const chain = flows.find(
      (f) => f.steps.map((s) => s.screen).join(",") === "000,001,002"
    );
    assert.ok(chain);
  });

  it("returns a summary with non-zero counts", () => {
    assert.equal(result.status, "done");
    assert.equal(result.screens, 3);
    assert.ok(result.flows >= 1);
    assert.equal(result.state_transitions, 1);
  });
});
