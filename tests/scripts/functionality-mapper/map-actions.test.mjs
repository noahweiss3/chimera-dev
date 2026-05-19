import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapActionsForScreen } from "../../../skills/functionality-mapper/scripts/lib/map-actions.mjs";

const elements = {
  links: [
    { text: "Project Alpha", href: "/projects/123", ref: "@0-10" },
    { text: "Project Beta", href: "/projects/456", ref: "@0-11" },
  ],
  buttons: [
    { text: "Create Project", ref: "@0-20", classification: "safe" },
    { text: "Delete All", ref: "@0-21", classification: "destructive" },
  ],
  forms: [],
};

const submittedActions = [
  {
    file: "create-project.json",
    page_ref: "001",
    trigger_ref: "@0-20",
    trigger_text: "Create Project",
    request: { method: "POST", url: "https://app.example.com/api/projects" },
    response: { status: 201 },
  },
];

const pages = [
  { id: "001", url: "https://app.example.com/projects" },
  { id: "002", url: "https://app.example.com/projects/123" },
  { id: "003", url: "https://app.example.com/projects/456" },
];

const navGraph = {
  edges: [
    { from: "001", to: "002", action: "click link", label: "Project Alpha" },
  ],
};

const endpointMap = {
  endpoints: [
    { method: "POST", path_template: "/api/projects", pages: ["001"], samples: 1 },
  ],
};

describe("mapActionsForScreen", () => {
  const result = mapActionsForScreen({
    pageId: "001",
    elements,
    submittedActions,
    navGraph,
    pages,
    endpointMap,
  });

  it("emits one action per non-destructive button", () => {
    const buttonActions = result.actions.filter((a) => a.trigger.startsWith("button:"));
    assert.equal(buttonActions.length, 1);
    assert.equal(buttonActions[0].trigger, "button:Create Project");
  });

  it("attaches endpoint info from submitted action with matching ref", () => {
    const create = result.actions.find((a) => a.ref === "@0-20");
    assert.equal(create.endpoint, "POST /api/projects");
  });

  it("captures destructive buttons separately", () => {
    assert.equal(result.destructive_actions_skipped.length, 1);
    assert.equal(result.destructive_actions_skipped[0].trigger, "button:Delete All");
    assert.equal(result.destructive_actions_skipped[0].ref, "@0-21");
  });

  it("emits one action per link with navigates_to from URL match", () => {
    const links = result.actions.filter((a) => a.trigger.startsWith("link:"));
    assert.equal(links.length, 2);
    const alpha = links.find((l) => l.trigger === "link:Project Alpha");
    assert.equal(alpha.navigates_to, "002");
    assert.equal(alpha.endpoint, null);
  });

  it("falls back to nav-graph edges when URL match fails", () => {
    const noUrlMatch = mapActionsForScreen({
      pageId: "001",
      elements: {
        links: [{ text: "Mystery", href: "javascript:void(0)", ref: "@0-99" }],
        buttons: [],
        forms: [],
      },
      submittedActions: [],
      navGraph: {
        edges: [{ from: "001", to: "002", action: "click link", label: "Mystery" }],
      },
      pages,
      endpointMap: null,
    });
    const link = noUrlMatch.actions.find((a) => a.trigger === "link:Mystery");
    assert.equal(link.navigates_to, "002");
  });

  it("returns null endpoint for buttons without a matching submitted action", () => {
    const result2 = mapActionsForScreen({
      pageId: "001",
      elements: {
        links: [],
        buttons: [{ text: "Unknown Btn", ref: "@99", classification: "safe" }],
        forms: [],
      },
      submittedActions: [],
      navGraph: { edges: [] },
      pages,
      endpointMap: null,
    });
    assert.equal(result2.actions[0].endpoint, null);
  });
});
