import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectAuth } from "../../../skills/api-mapper/scripts/lib/auth.mjs";

const ex = (headers) => ({ request_headers: headers, source: "trace" });

describe("detectAuth", () => {
  it("detects Bearer tokens", () => {
    const result = detectAuth([
      ex({ authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc" }),
      ex({ authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0NTYifQ.def" }),
    ]);
    assert.equal(result.type, "bearer");
    assert.equal(result.token_pattern, "jwt");
  });

  it("detects non-JWT bearer tokens", () => {
    const result = detectAuth([
      ex({ authorization: "Bearer abc123def456" }),
    ]);
    assert.equal(result.type, "bearer");
    assert.equal(result.token_pattern, "opaque");
  });

  it("detects session cookies", () => {
    const result = detectAuth([
      ex({ cookie: "session=abc123; theme=dark" }),
      ex({ cookie: "session=xyz789" }),
    ]);
    assert.equal(result.type, "cookie");
    assert.equal(result.cookie_name, "session");
  });

  it("detects sid cookie name", () => {
    const result = detectAuth([
      ex({ cookie: "sid=abc; _ga=1" }),
      ex({ cookie: "sid=xyz" }),
    ]);
    assert.equal(result.type, "cookie");
    assert.equal(result.cookie_name, "sid");
  });

  it("detects connect.sid (Express session)", () => {
    const result = detectAuth([
      ex({ cookie: "connect.sid=s%3Aabc.def" }),
    ]);
    assert.equal(result.type, "cookie");
    assert.equal(result.cookie_name, "connect.sid");
  });

  it("detects API key in X-API-Key header", () => {
    const result = detectAuth([
      ex({ "x-api-key": "sk_test_abc123" }),
    ]);
    assert.equal(result.type, "api-key");
    assert.equal(result.header, "X-API-Key");
  });

  it("returns none when no auth signals present", () => {
    const result = detectAuth([
      ex({ accept: "application/json" }),
    ]);
    assert.equal(result.type, "none");
  });

  it("prefers bearer over cookie when both present", () => {
    const result = detectAuth([
      ex({
        authorization: "Bearer abc.def.ghi",
        cookie: "session=xyz",
      }),
    ]);
    assert.equal(result.type, "bearer");
  });
});
