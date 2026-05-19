import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyScreen } from "../../../skills/functionality-mapper/scripts/lib/classify-screens.mjs";

const make = (overrides = {}) => ({
  meta: { id: "x", url: "/x", title: "X", section: "x", auth: true, ...overrides.meta },
  elements: { links: [], buttons: [], forms: [], ...overrides.elements },
});

describe("classifyScreen", () => {
  it("classifies a list view by similar link prefixes", () => {
    const s = make({
      elements: {
        links: [
          { text: "Project Alpha", href: "/projects/1", ref: "@1" },
          { text: "Project Beta", href: "/projects/2", ref: "@2" },
          { text: "Project Gamma", href: "/projects/3", ref: "@3" },
        ],
        buttons: [{ text: "Create", ref: "@10", classification: "safe" }],
      },
    });
    assert.equal(classifyScreen(s), "list");
  });

  it("classifies a form view when a form with multi-field exists", () => {
    const s = make({
      elements: {
        forms: [
          {
            name: "Sign up",
            fields: [
              { name: "email", type: "textbox", ref: "@1" },
              { name: "password", type: "textbox", ref: "@2" },
            ],
          },
        ],
        buttons: [{ text: "Submit", ref: "@3", classification: "safe" }],
      },
    });
    assert.equal(classifyScreen(s), "form");
  });

  it("classifies a detail view from URL ending in numeric id", () => {
    const s = make({
      meta: { url: "/projects/123" },
      elements: {
        buttons: [{ text: "Edit", ref: "@1", classification: "safe" }],
        links: [{ text: "Back", href: "/projects", ref: "@2" }],
      },
    });
    assert.equal(classifyScreen(s), "detail");
  });

  it("classifies a settings view by section", () => {
    const s = make({ meta: { section: "settings" } });
    assert.equal(classifyScreen(s), "settings");
  });

  it("classifies empty state when there's almost no content", () => {
    const s = make({
      elements: { links: [{ text: "Home", href: "/", ref: "@1" }] },
    });
    assert.equal(classifyScreen(s), "empty");
  });

  it("returns unknown when nothing matches", () => {
    const s = make({
      elements: {
        links: [{ text: "About", href: "/about", ref: "@1" }],
        buttons: [{ text: "Foo", ref: "@2", classification: "unknown" }],
      },
    });
    assert.equal(classifyScreen(s), "unknown");
  });

  it("prefers form over list when both signals present", () => {
    const s = make({
      elements: {
        links: [
          { text: "Item 1", href: "/items/1", ref: "@1" },
          { text: "Item 2", href: "/items/2", ref: "@2" },
          { text: "Item 3", href: "/items/3", ref: "@3" },
        ],
        forms: [
          {
            name: "Filter",
            fields: [
              { name: "q", type: "textbox", ref: "@10" },
              { name: "sort", type: "combobox", ref: "@11" },
            ],
          },
        ],
        buttons: [{ text: "Apply", ref: "@12", classification: "safe" }],
      },
    });
    assert.equal(classifyScreen(s), "form");
  });
});
