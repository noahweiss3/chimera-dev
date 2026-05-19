import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { loadExchanges } from "../../../skills/api-mapper/scripts/lib/load.mjs";

const FIXTURE_ROOT = resolve(import.meta.dirname, "../../fixtures/api-mapper");

describe("loadExchanges", () => {
  const { exchanges, warnings } = loadExchanges({
    tracesDir: FIXTURE_ROOT,
    actionsDir: resolve(FIXTURE_ROOT, "actions"),
    bodiesDir: resolve(FIXTURE_ROOT, "bodies"),
    manifestPath: resolve(FIXTURE_ROOT, "manifest.json"),
  });

  it("pairs each request with its response by requestId", () => {
    const paired = exchanges.filter((e) => e.source === "trace");
    assert.equal(paired.length, 8);
    for (const ex of paired) {
      assert.ok(ex.status !== undefined, `no status for ${ex.request_id}`);
      assert.ok(ex.url, `no url for ${ex.request_id}`);
      assert.ok(ex.method, `no method for ${ex.request_id}`);
    }
  });

  it("attaches JSON response bodies when files exist", () => {
    const r5 = exchanges.find((e) => e.request_id === "r-5");
    assert.ok(r5);
    assert.ok(r5.response_body);
    assert.ok(Array.isArray(r5.response_body.projects));
    assert.equal(r5.response_body.projects[0].name, "Alpha");
  });

  it("tolerates missing body files", () => {
    const r1 = exchanges.find((e) => e.request_id === "r-1");
    assert.ok(r1);
    assert.equal(r1.response_body, null);
  });

  it("ingests actions/submitted as exchanges with paired request/response", () => {
    const actions = exchanges.filter((e) => e.source === "action");
    assert.equal(actions.length, 1);
    const act = actions[0];
    assert.equal(act.method, "POST");
    assert.equal(act.url, "https://app.example.com/api/projects");
    assert.equal(act.status, 201);
    assert.deepEqual(act.request_body, {
      name: "Gamma",
      description: "Third project",
    });
    assert.equal(act.response_body.id, 789);
  });

  it("captures mime_type from response", () => {
    const r5 = exchanges.find((e) => e.request_id === "r-5");
    assert.equal(r5.mime_type, "application/json");
    const r2 = exchanges.find((e) => e.request_id === "r-2");
    assert.equal(r2.mime_type, "font/woff2");
  });

  it("captures request headers (lowercased)", () => {
    const r5 = exchanges.find((e) => e.request_id === "r-5");
    assert.ok(r5.request_headers);
    assert.equal(r5.request_headers.cookie, "session=abc123");
    assert.equal(r5.request_headers.accept, "application/json");
  });

  it("returns empty result when trace files are missing", () => {
    const result = loadExchanges({
      tracesDir: "/nonexistent/path",
      actionsDir: "/nonexistent/path",
      bodiesDir: "/nonexistent/path",
      manifestPath: "/nonexistent/path/manifest.json",
    });
    assert.equal(result.exchanges.length, 0);
    assert.ok(result.warnings.length > 0);
  });
});
