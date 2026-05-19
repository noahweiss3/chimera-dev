import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapEndpointsForScreen,
  isCollectionTemplate,
} from "../../../skills/functionality-mapper/scripts/lib/map-endpoints.mjs";

describe("isCollectionTemplate", () => {
  it("collection paths end without a templated id", () => {
    assert.equal(isCollectionTemplate("/api/projects"), true);
    assert.equal(isCollectionTemplate("/api/users/me"), false);
    assert.equal(isCollectionTemplate("/api/projects/{id}"), false);
  });
});

describe("mapEndpointsForScreen", () => {
  const endpointMap = {
    endpoints: [
      { method: "GET", path_template: "/api/projects", pages: ["001"], samples: 1 },
      { method: "POST", path_template: "/api/projects", pages: ["001"], samples: 1 },
      { method: "GET", path_template: "/api/projects/{id}", pages: ["002"], samples: 1 },
      { method: "GET", path_template: "/api/users/me", pages: ["001", "002"], samples: 2 },
    ],
  };

  it("returns endpoints whose pages include the screen id", () => {
    const deps = mapEndpointsForScreen({ pageId: "002", endpointMap });
    const refs = deps.map((d) => d.endpoint).sort();
    assert.deepEqual(refs, ["GET /api/projects/{id}", "GET /api/users/me"]);
  });

  it("flags on_load only for GETs (mutations don't fire on load)", () => {
    const deps = mapEndpointsForScreen({ pageId: "001", endpointMap });
    const get = deps.find((d) => d.endpoint === "GET /api/projects");
    const post = deps.find((d) => d.endpoint === "POST /api/projects");
    assert.equal(get.on_load, true);
    assert.equal(post.on_load, false);
  });

  it("uses 'list items' purpose for collection GET", () => {
    const deps = mapEndpointsForScreen({ pageId: "001", endpointMap });
    const get = deps.find((d) => d.endpoint === "GET /api/projects");
    assert.equal(get.purpose, "list items");
  });

  it("uses 'load resource' purpose for non-collection GET", () => {
    const deps = mapEndpointsForScreen({ pageId: "002", endpointMap });
    const detail = deps.find((d) => d.endpoint === "GET /api/projects/{id}");
    assert.equal(detail.purpose, "load resource");
  });

  it("returns empty array for unmapped page", () => {
    const deps = mapEndpointsForScreen({ pageId: "999", endpointMap });
    assert.deepEqual(deps, []);
  });

  it("returns empty array when endpoint-map is null/missing", () => {
    assert.deepEqual(mapEndpointsForScreen({ pageId: "001", endpointMap: null }), []);
  });
});
