import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { rmSync, existsSync, readFileSync, cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { discover } from "../../../skills/model-inferrer/scripts/discover.mjs";

const FIXTURE_ROOT = resolve(import.meta.dirname, "../../fixtures/model-inferrer");

describe("model-inferrer integration: discover()", () => {
  let workDir, chimeraDir, result;

  before(() => {
    workDir = mkdtempSync(resolve(tmpdir(), "chimera-mi-"));
    chimeraDir = resolve(workDir, ".chimera");
    cpSync(FIXTURE_ROOT, chimeraDir, { recursive: true });
    result = discover({ chimeraDir });
  });

  after(() => {
    if (workDir && existsSync(workDir)) rmSync(workDir, { recursive: true });
  });

  it("writes entities.json, schema.ts, erd.md, report.md", () => {
    for (const f of ["entities.json", "schema.ts", "erd.md", "report.md"]) {
      assert.ok(existsSync(resolve(chimeraDir, "model", f)), `missing ${f}`);
    }
  });

  it("discovers Project and User entities", () => {
    const { entities } = JSON.parse(
      readFileSync(resolve(chimeraDir, "model/entities.json"), "utf-8")
    );
    const names = entities.map((e) => e.name);
    assert.ok(names.includes("Project"));
    assert.ok(names.includes("User"));
  });

  it("Project entity has owner_id with FK to users.id", () => {
    const { entities } = JSON.parse(
      readFileSync(resolve(chimeraDir, "model/entities.json"), "utf-8")
    );
    const project = entities.find((e) => e.name === "Project");
    const owner = project.fields.find((f) => f.name === "owner_id");
    assert.equal(owner.foreign_key, "users.id");
  });

  it("Project belongs_to User", () => {
    const { entities } = JSON.parse(
      readFileSync(resolve(chimeraDir, "model/entities.json"), "utf-8")
    );
    const project = entities.find((e) => e.name === "Project");
    assert.ok(project.relationships.some((r) => r.type === "belongs_to" && r.entity === "User"));
  });

  it("schema.ts is valid-looking TypeScript", () => {
    const ts = readFileSync(resolve(chimeraDir, "model/schema.ts"), "utf-8");
    assert.match(ts, /import \{ pgTable/);
    assert.match(ts, /export const projects = pgTable/);
    assert.match(ts, /export const users = pgTable/);
  });

  it("erd.md contains a mermaid block", () => {
    const md = readFileSync(resolve(chimeraDir, "model/erd.md"), "utf-8");
    assert.match(md, /```mermaid[\s\S]*erDiagram/);
  });

  it("returns a summary with non-zero entity count", () => {
    assert.equal(result.status, "done");
    assert.ok(result.entities >= 2);
    assert.ok(result.relationships >= 1);
  });

  it("fails gracefully when openapi.json is missing", () => {
    const empty = mkdtempSync(resolve(tmpdir(), "chimera-mi-empty-"));
    const emptyChimera = resolve(empty, ".chimera");
    cpSync(resolve(FIXTURE_ROOT, "func-map"), resolve(emptyChimera, "func-map"), { recursive: true });
    const r = discover({ chimeraDir: emptyChimera });
    assert.equal(r.status, "failed");
    rmSync(empty, { recursive: true });
  });
});
