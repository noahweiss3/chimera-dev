import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  singularize,
  pluralize,
  capitalize,
} from "../../../skills/model-inferrer/scripts/lib/pluralize.mjs";

describe("singularize", () => {
  it("handles -s", () => {
    assert.equal(singularize("projects"), "project");
    assert.equal(singularize("users"), "user");
  });
  it("handles -ies", () => {
    assert.equal(singularize("companies"), "company");
    assert.equal(singularize("categories"), "category");
  });
  it("handles -es after sibilant", () => {
    assert.equal(singularize("boxes"), "box");
    assert.equal(singularize("addresses"), "address");
  });
  it("leaves already singular alone", () => {
    assert.equal(singularize("user"), "user");
    assert.equal(singularize("data"), "data");
  });
  it("returns input for unknown forms", () => {
    assert.equal(singularize(""), "");
  });
});

describe("pluralize", () => {
  it("handles common -s", () => {
    assert.equal(pluralize("project"), "projects");
    assert.equal(pluralize("user"), "users");
  });
  it("handles -y -> -ies", () => {
    assert.equal(pluralize("company"), "companies");
    assert.equal(pluralize("category"), "categories");
  });
  it("handles sibilant endings", () => {
    assert.equal(pluralize("box"), "boxes");
    assert.equal(pluralize("address"), "addresses");
  });
});

describe("capitalize", () => {
  it("capitalizes the first letter", () => {
    assert.equal(capitalize("project"), "Project");
    assert.equal(capitalize("user"), "User");
  });
  it("handles empty", () => {
    assert.equal(capitalize(""), "");
  });
});
