import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  existsSync,
  readFileSync,
  rmSync,
  cpSync,
  mkdtempSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { scaffold } from "../../../skills/app-reconstructor/scripts/scaffold.mjs";

const FIXTURE = resolve(import.meta.dirname, "../../fixtures/app-reconstructor");

describe("scaffold()", () => {
  let workDir, chimeraDir, outDir, summary;

  before(() => {
    workDir = mkdtempSync(resolve(tmpdir(), "chimera-recon-"));
    chimeraDir = resolve(workDir, ".chimera");
    outDir = resolve(workDir, "chimera-clone");
    cpSync(FIXTURE, chimeraDir, { recursive: true });
    summary = scaffold({ chimeraDir, outDir });
  });

  after(() => {
    if (workDir && existsSync(workDir)) rmSync(workDir, { recursive: true });
  });

  it("creates the monorepo root files", () => {
    for (const f of ["package.json", "pnpm-workspace.yaml", "tsconfig.base.json", ".gitignore", "README.md"]) {
      assert.ok(existsSync(resolve(outDir, f)), `missing ${f}`);
    }
  });

  it("creates apps/api directory with required files", () => {
    for (const f of [
      "apps/api/package.json",
      "apps/api/tsconfig.json",
      "apps/api/drizzle.config.ts",
      "apps/api/src/index.ts",
      "apps/api/src/db/client.ts",
      "apps/api/src/db/schema.ts",
    ]) {
      assert.ok(existsSync(resolve(outDir, f)), `missing ${f}`);
    }
  });

  it("copies the Drizzle schema into apps/api/src/db/schema.ts", () => {
    const original = readFileSync(resolve(FIXTURE, "model/schema.ts"), "utf-8");
    const copied = readFileSync(resolve(outDir, "apps/api/src/db/schema.ts"), "utf-8");
    assert.equal(copied, original);
  });

  it("creates apps/web directory with required files", () => {
    for (const f of [
      "apps/web/package.json",
      "apps/web/tsconfig.json",
      "apps/web/vite.config.ts",
      "apps/web/index.html",
      "apps/web/src/main.tsx",
      "apps/web/src/App.tsx",
      "apps/web/src/lib/api.ts",
    ]) {
      assert.ok(existsSync(resolve(outDir, f)), `missing ${f}`);
    }
  });

  it("creates packages/shared", () => {
    for (const f of [
      "packages/shared/package.json",
      "packages/shared/tsconfig.json",
      "packages/shared/src/schemas.ts",
    ]) {
      assert.ok(existsSync(resolve(outDir, f)), `missing ${f}`);
    }
  });

  it("creates a route stub per entity", () => {
    for (const entity of ["projects", "users"]) {
      const path = resolve(outDir, `apps/api/src/routes/${entity}.ts`);
      assert.ok(existsSync(path), `missing route ${entity}`);
      const content = readFileSync(path, "utf-8");
      assert.match(content, /TODO\(chimera\)/);
    }
  });

  it("creates a page stub per screen", () => {
    for (const page of ["Projects", "ProjectAlpha"]) {
      const path = resolve(outDir, `apps/web/src/pages/${page}.tsx`);
      assert.ok(existsSync(path), `missing page ${page}`);
      const content = readFileSync(path, "utf-8");
      assert.match(content, /TODO\(chimera\)/);
    }
  });

  it("returns a summary with non-zero counts and a TODO list", () => {
    assert.equal(summary.status, "done");
    assert.equal(summary.entities_scaffolded, 2);
    assert.equal(summary.screens_scaffolded, 2);
    assert.ok(summary.llm_todos.length > 0);
  });

  it("aborts when outDir exists and force is not passed", () => {
    const r = scaffold({ chimeraDir, outDir });
    assert.equal(r.status, "aborted");
  });

  it("overwrites when force=true", () => {
    const r = scaffold({ chimeraDir, outDir, force: true });
    assert.equal(r.status, "done");
  });

  it("root package.json declares workspaces correctly", () => {
    const pkg = JSON.parse(readFileSync(resolve(outDir, "package.json"), "utf-8"));
    assert.equal(pkg.name, "chimera-clone");
    assert.equal(pkg.private, true);
  });

  it("workspace yaml lists apps and packages", () => {
    const yaml = readFileSync(resolve(outDir, "pnpm-workspace.yaml"), "utf-8");
    assert.match(yaml, /apps\/\*/);
    assert.match(yaml, /packages\/\*/);
  });
});

describe("scaffold() — failure modes", () => {
  let workDir;

  before(() => {
    workDir = mkdtempSync(resolve(tmpdir(), "chimera-recon-fail-"));
  });

  after(() => {
    if (workDir && existsSync(workDir)) rmSync(workDir, { recursive: true });
  });

  it("fails when entities.json is missing", () => {
    const emptyChimera = resolve(workDir, ".chimera");
    cpSync(resolve(FIXTURE, "api-spec"), resolve(emptyChimera, "api-spec"), { recursive: true });
    const r = scaffold({
      chimeraDir: emptyChimera,
      outDir: resolve(workDir, "out"),
    });
    assert.equal(r.status, "failed");
  });
});
