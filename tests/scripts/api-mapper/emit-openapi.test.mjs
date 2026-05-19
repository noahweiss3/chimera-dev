import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildOpenApi } from "../../../skills/api-mapper/scripts/lib/emit-openapi.mjs";
import { inferSchema } from "../../../skills/api-mapper/scripts/lib/infer.mjs";

const endpoints = [
  {
    method: "GET",
    path_template: "/api/projects",
    exchanges: [
      {
        method: "GET",
        url: "https://app.example.com/api/projects",
        status: 200,
        request_body: null,
        response_body: { projects: [{ id: 1, name: "A" }] },
      },
    ],
  },
  {
    method: "GET",
    path_template: "/api/projects/{id}",
    exchanges: [
      {
        method: "GET",
        url: "https://app.example.com/api/projects/123",
        status: 200,
        request_body: null,
        response_body: { id: 123, name: "Alpha" },
      },
    ],
  },
  {
    method: "POST",
    path_template: "/api/projects",
    exchanges: [
      {
        method: "POST",
        url: "https://app.example.com/api/projects",
        status: 201,
        request_body: { name: "New" },
        response_body: { id: 999, name: "New" },
      },
    ],
  },
];

describe("buildOpenApi", () => {
  const doc = buildOpenApi({
    endpoints,
    auth: { type: "cookie", cookie_name: "session" },
    targetUrl: "https://app.example.com",
  });

  it("emits valid OpenAPI 3.1 structure", () => {
    assert.equal(doc.openapi, "3.1.0");
    assert.ok(doc.info);
    assert.ok(doc.info.title);
    assert.ok(doc.info.version);
  });

  it("includes the target URL in servers", () => {
    assert.deepEqual(doc.servers, [{ url: "https://app.example.com" }]);
  });

  it("groups operations under a single path entry", () => {
    const path = doc.paths["/api/projects"];
    assert.ok(path);
    assert.ok(path.get);
    assert.ok(path.post);
  });

  it("templates paths use {id}", () => {
    assert.ok(doc.paths["/api/projects/{id}"]);
    assert.ok(doc.paths["/api/projects/{id}"].get);
  });

  it("includes path parameters declared as parameters[]", () => {
    const op = doc.paths["/api/projects/{id}"].get;
    assert.ok(Array.isArray(op.parameters));
    const idParam = op.parameters.find((p) => p.name === "id");
    assert.ok(idParam);
    assert.equal(idParam.in, "path");
    assert.equal(idParam.required, true);
  });

  it("includes request body schema for POST", () => {
    const post = doc.paths["/api/projects"].post;
    assert.ok(post.requestBody);
    const content = post.requestBody.content["application/json"];
    assert.ok(content.schema);
    assert.equal(content.schema.type, "object");
  });

  it("includes responses with inferred schemas", () => {
    const get = doc.paths["/api/projects"].get;
    assert.ok(get.responses["200"]);
    const schema = get.responses["200"].content["application/json"].schema;
    assert.equal(schema.type, "object");
    assert.ok(schema.properties.projects);
  });

  it("includes security scheme from auth detection", () => {
    assert.ok(doc.components.securitySchemes);
    const sec = doc.components.securitySchemes.sessionCookie;
    assert.ok(sec);
    assert.equal(sec.type, "apiKey");
    assert.equal(sec.in, "cookie");
    assert.equal(sec.name, "session");
    assert.deepEqual(doc.security, [{ sessionCookie: [] }]);
  });

  it("omits security scheme when auth is none", () => {
    const noAuth = buildOpenApi({
      endpoints: [],
      auth: { type: "none" },
      targetUrl: "https://app.example.com",
    });
    assert.equal(noAuth.security, undefined);
  });

  it("uses bearer scheme for bearer auth", () => {
    const withBearer = buildOpenApi({
      endpoints: [],
      auth: { type: "bearer", token_pattern: "jwt" },
      targetUrl: "https://app.example.com",
    });
    const sec = withBearer.components.securitySchemes.bearerAuth;
    assert.equal(sec.type, "http");
    assert.equal(sec.scheme, "bearer");
    assert.equal(sec.bearerFormat, "JWT");
  });
});
