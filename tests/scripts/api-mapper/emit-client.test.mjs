import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildClient, functionNameFor } from "../../../skills/api-mapper/scripts/lib/emit-client.mjs";

describe("functionNameFor", () => {
  it("derives camelCase name from method + template", () => {
    assert.equal(functionNameFor("GET", "/api/projects"), "getApiProjects");
    assert.equal(functionNameFor("POST", "/api/projects"), "postApiProjects");
    assert.equal(functionNameFor("DELETE", "/api/users/me"), "deleteApiUsersMe");
  });

  it("turns {id} into ById segments", () => {
    assert.equal(
      functionNameFor("GET", "/api/projects/{id}"),
      "getApiProjectsById"
    );
    assert.equal(
      functionNameFor("PATCH", "/api/users/{id}/posts/{id}"),
      "patchApiUsersByIdPostsById"
    );
  });

  it("handles {slug} similarly", () => {
    assert.equal(
      functionNameFor("GET", "/api/posts/{slug}"),
      "getApiPostsBySlug"
    );
  });
});

describe("buildClient", () => {
  const endpoints = [
    { method: "GET", path_template: "/api/projects", exchanges: [] },
    { method: "POST", path_template: "/api/projects", exchanges: [] },
    { method: "GET", path_template: "/api/projects/{id}", exchanges: [] },
  ];

  it("returns a string containing a module", () => {
    const src = buildClient({
      endpoints,
      auth: { type: "cookie", cookie_name: "session" },
      baseUrl: "https://app.example.com",
    });
    assert.equal(typeof src, "string");
    assert.match(src, /export async function getApiProjects/);
    assert.match(src, /export async function postApiProjects/);
    assert.match(src, /export async function getApiProjectsById/);
  });

  it("generated source is syntactically valid JavaScript", async () => {
    const src = buildClient({
      endpoints,
      auth: { type: "bearer" },
      baseUrl: "https://app.example.com",
    });
    const dataUrl = "data:text/javascript;base64," + Buffer.from(src).toString("base64");
    const mod = await import(dataUrl);
    assert.equal(typeof mod.getApiProjects, "function");
    assert.equal(typeof mod.postApiProjects, "function");
    assert.equal(typeof mod.getApiProjectsById, "function");
  });

  it("path-parameter functions accept positional args", async () => {
    const src = buildClient({
      endpoints,
      auth: { type: "none" },
      baseUrl: "https://example.com",
    });
    const dataUrl = "data:text/javascript;base64," + Buffer.from(src).toString("base64");
    const mod = await import(dataUrl);
    assert.equal(mod.getApiProjectsById.length, 2);
  });
});
