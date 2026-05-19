import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  templatizePath,
  groupByEndpoint,
} from "../../../skills/api-mapper/scripts/lib/templatize.mjs";

describe("templatizePath", () => {
  it("replaces numeric IDs with {id}", () => {
    assert.equal(templatizePath("/api/projects/123").template, "/api/projects/{id}");
    assert.equal(templatizePath("/api/users/7/posts/42").template, "/api/users/{id}/posts/{id}");
  });

  it("replaces UUIDs with {id}", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    assert.equal(
      templatizePath(`/api/items/${uuid}`).template,
      "/api/items/{id}"
    );
  });

  it("replaces 24-char hex Mongo ObjectIds with {id}", () => {
    assert.equal(
      templatizePath("/api/docs/507f1f77bcf86cd799439011").template,
      "/api/docs/{id}"
    );
  });

  it("leaves static segments alone", () => {
    assert.equal(
      templatizePath("/api/projects/search").template,
      "/api/projects/search"
    );
  });

  it("strips query string from template", () => {
    assert.equal(
      templatizePath("/api/projects?page=2").template,
      "/api/projects"
    );
  });

  it("handles full URLs", () => {
    assert.equal(
      templatizePath("https://app.example.com/api/projects/123").template,
      "/api/projects/{id}"
    );
  });

  it("returns captured params with names matching position", () => {
    const result = templatizePath("/api/projects/123/tasks/456");
    assert.deepEqual(result.params, [
      { name: "id", value: "123" },
      { name: "id", value: "456" },
    ]);
  });
});

describe("groupByEndpoint", () => {
  const ex = (method, url) => ({ method, url, status: 200, request_body: null, response_body: { ok: true } });

  it("groups exchanges with same method + template", () => {
    const exchanges = [
      ex("GET", "/api/projects/123"),
      ex("GET", "/api/projects/456"),
      ex("GET", "/api/projects"),
      ex("POST", "/api/projects"),
    ];
    const endpoints = groupByEndpoint(exchanges);
    assert.equal(endpoints.length, 3);
    const getDetail = endpoints.find(
      (e) => e.method === "GET" && e.path_template === "/api/projects/{id}"
    );
    assert.ok(getDetail);
    assert.equal(getDetail.exchanges.length, 2);

    const getList = endpoints.find(
      (e) => e.method === "GET" && e.path_template === "/api/projects"
    );
    assert.equal(getList.exchanges.length, 1);

    const postList = endpoints.find(
      (e) => e.method === "POST" && e.path_template === "/api/projects"
    );
    assert.equal(postList.exchanges.length, 1);
  });

  it("sorts endpoints by template then method", () => {
    const exchanges = [
      ex("POST", "/api/projects"),
      ex("GET", "/api/users/me"),
      ex("GET", "/api/projects"),
    ];
    const endpoints = groupByEndpoint(exchanges);
    assert.deepEqual(
      endpoints.map((e) => `${e.method} ${e.path_template}`),
      ["GET /api/projects", "POST /api/projects", "GET /api/users/me"]
    );
  });
});
