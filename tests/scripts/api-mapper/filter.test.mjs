import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isNoise, filterExchanges } from "../../../skills/api-mapper/scripts/lib/filter.mjs";

const ex = (overrides) => ({
  source: "trace",
  url: "https://app.example.com/api/projects",
  method: "GET",
  mime_type: "application/json",
  status: 200,
  request_headers: {},
  response_headers: {},
  ...overrides,
});

describe("isNoise", () => {
  it("flags font mime types", () => {
    assert.equal(
      isNoise(ex({ mime_type: "font/woff2", url: "https://fonts.gstatic.com/font.woff2" })),
      true
    );
  });

  it("flags image/css/script mime types", () => {
    assert.equal(isNoise(ex({ mime_type: "image/png" })), true);
    assert.equal(isNoise(ex({ mime_type: "text/css" })), true);
    assert.equal(isNoise(ex({ mime_type: "application/javascript", url: "https://app.example.com/static/app.js" })), true);
    assert.equal(isNoise(ex({ mime_type: "text/html", url: "https://app.example.com/" })), true);
  });

  it("flags static file extensions in path", () => {
    assert.equal(isNoise(ex({ url: "https://app.example.com/assets/logo.svg", mime_type: "" })), true);
    assert.equal(isNoise(ex({ url: "https://app.example.com/style.css", mime_type: "" })), true);
    assert.equal(isNoise(ex({ url: "https://app.example.com/bundle.js.map", mime_type: "" })), true);
  });

  it("flags known analytics hosts", () => {
    assert.equal(isNoise(ex({ url: "https://www.google-analytics.com/g/collect" })), true);
    assert.equal(isNoise(ex({ url: "https://api.segment.io/v1/track" })), true);
    assert.equal(isNoise(ex({ url: "https://app.posthog.com/capture/" })), true);
    assert.equal(isNoise(ex({ url: "https://sentry.io/api/123/store/" })), true);
  });

  it("keeps JSON API calls", () => {
    assert.equal(isNoise(ex()), false);
    assert.equal(
      isNoise(ex({ url: "https://app.example.com/api/users/me", mime_type: "application/json" })),
      false
    );
  });

  it("keeps action exchanges regardless of mime", () => {
    assert.equal(isNoise(ex({ source: "action", mime_type: "" })), false);
  });
});

describe("filterExchanges", () => {
  it("filters out noise and only keeps app-origin API calls", () => {
    const input = [
      ex({ url: "https://app.example.com/", mime_type: "text/html" }),
      ex({ url: "https://fonts.gstatic.com/x.woff2", mime_type: "font/woff2" }),
      ex({ url: "https://www.google-analytics.com/g/collect", mime_type: "text/plain" }),
      ex({ url: "https://app.example.com/static/app.js", mime_type: "application/javascript" }),
      ex({ url: "https://app.example.com/api/projects", mime_type: "application/json" }),
      ex({ url: "https://app.example.com/api/users/me", mime_type: "application/json" }),
    ];
    const out = filterExchanges(input, { appOrigins: ["https://app.example.com"] });
    assert.equal(out.length, 2);
    assert.ok(out.every((e) => e.url.startsWith("https://app.example.com/api/")));
  });

  it("keeps action exchanges even from unfamiliar origins", () => {
    const input = [ex({ source: "action", url: "https://api.example.com/v1/projects" })];
    const out = filterExchanges(input, { appOrigins: ["https://app.example.com"] });
    assert.equal(out.length, 1);
  });
});
