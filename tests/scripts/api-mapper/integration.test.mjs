import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { rmSync, existsSync, readFileSync, cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { discover } from "../../../skills/api-mapper/scripts/discover.mjs";

const FIXTURE_ROOT = resolve(import.meta.dirname, "../../fixtures/api-mapper");

describe("api-mapper integration: discover()", () => {
  let workDir;
  let chimeraDir;
  let result;

  before(() => {
    workDir = mkdtempSync(resolve(tmpdir(), "chimera-api-mapper-"));
    chimeraDir = resolve(workDir, ".chimera");
    cpSync(FIXTURE_ROOT, chimeraDir, { recursive: true });
    cpSync(
      resolve(chimeraDir, "requests.jsonl"),
      resolve(chimeraDir, "traces", "requests.jsonl")
    );
    cpSync(
      resolve(chimeraDir, "responses.jsonl"),
      resolve(chimeraDir, "traces", "responses.jsonl")
    );
    cpSync(
      resolve(chimeraDir, "bodies"),
      resolve(chimeraDir, "traces", "bodies"),
      { recursive: true }
    );
    result = discover({ chimeraDir });
  });

  after(() => {
    if (workDir && existsSync(workDir)) rmSync(workDir, { recursive: true });
  });

  it("emits all expected files", () => {
    const outDir = resolve(chimeraDir, "api-spec");
    for (const f of [
      "openapi.json",
      "openapi.yaml",
      "endpoint-map.json",
      "auth-scheme.json",
      "client.mjs",
      "report.md",
    ]) {
      assert.ok(existsSync(resolve(outDir, f)), `missing ${f}`);
    }
  });

  it("identifies expected endpoints", () => {
    const map = JSON.parse(
      readFileSync(resolve(chimeraDir, "api-spec/endpoint-map.json"), "utf-8")
    );
    const templates = new Set(
      map.endpoints.map((e) => `${e.method} ${e.path_template}`)
    );
    assert.ok(templates.has("GET /api/projects"));
    assert.ok(templates.has("POST /api/projects"));
    assert.ok(templates.has("GET /api/projects/{id}"));
    assert.ok(templates.has("GET /api/users/me"));
  });

  it("groups multiple samples under the same endpoint", () => {
    const map = JSON.parse(
      readFileSync(resolve(chimeraDir, "api-spec/endpoint-map.json"), "utf-8")
    );
    const detail = map.endpoints.find(
      (e) => e.method === "GET" && e.path_template === "/api/projects/{id}"
    );
    assert.equal(detail.samples, 2);
  });

  it("detects the session cookie auth scheme", () => {
    const auth = JSON.parse(
      readFileSync(resolve(chimeraDir, "api-spec/auth-scheme.json"), "utf-8")
    );
    assert.equal(auth.type, "cookie");
    assert.equal(auth.cookie_name, "session");
  });

  it("openapi.json is valid OpenAPI 3.1", () => {
    const doc = JSON.parse(
      readFileSync(resolve(chimeraDir, "api-spec/openapi.json"), "utf-8")
    );
    assert.equal(doc.openapi, "3.1.0");
    assert.ok(doc.paths["/api/projects"]);
    assert.ok(doc.paths["/api/projects"].get);
    assert.ok(doc.paths["/api/projects"].post);
    assert.ok(doc.paths["/api/projects/{id}"]);
  });

  it("generated client.mjs is importable JS", async () => {
    const src = readFileSync(
      resolve(chimeraDir, "api-spec/client.mjs"),
      "utf-8"
    );
    const dataUrl =
      "data:text/javascript;base64," + Buffer.from(src).toString("base64");
    const mod = await import(dataUrl);
    assert.equal(typeof mod.getApiProjects, "function");
    assert.equal(typeof mod.postApiProjects, "function");
    assert.equal(typeof mod.getApiProjectsById, "function");
    assert.equal(typeof mod.getApiUsersMe, "function");
  });

  it("returns a summary with non-zero endpoint count", () => {
    assert.equal(result.status, "done");
    assert.ok(result.endpoints >= 4);
    assert.equal(result.auth, "cookie");
  });
});
