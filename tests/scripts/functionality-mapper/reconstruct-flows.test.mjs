import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  reconstructFlows,
  buildStateMachine,
} from "../../../skills/functionality-mapper/scripts/lib/reconstruct-flows.mjs";

const screens = [
  { id: "000", name: "Welcome", type: "empty", section: "public" },
  { id: "001", name: "Projects", type: "list", section: "projects" },
  { id: "002", name: "Project Alpha", type: "detail", section: "projects" },
];

const navGraph = {
  nodes: screens.map((s) => ({ id: s.id, url: "", title: s.name, auth: false })),
  edges: [
    { from: "000", to: "001", action: "navigate", label: "log in" },
    { from: "001", to: "002", action: "click link", label: "Project Alpha" },
  ],
};

describe("reconstructFlows", () => {
  const flows = reconstructFlows({ screens, navGraph });

  it("produces at least one flow", () => {
    assert.ok(flows.length >= 1);
  });

  it("includes the full chain 000 -> 001 -> 002", () => {
    const chain = flows.find((f) =>
      f.steps.map((s) => s.screen).join(",") === "000,001,002"
    );
    assert.ok(chain, "expected the 000->001->002 chain");
  });

  it("each step has screen and action fields", () => {
    for (const flow of flows) {
      for (const step of flow.steps) {
        assert.ok(typeof step.screen === "string");
        assert.ok(typeof step.action === "string");
      }
    }
  });
});

describe("buildStateMachine", () => {
  const submittedActions = [
    {
      page_ref: "001",
      trigger_text: "Create Project",
      trigger_ref: "@0-20",
      timestamp: "2026-05-18T20:12:00Z",
      request: { method: "POST", url: "https://app.example.com/api/projects" },
      response: { status: 201 },
    },
    {
      page_ref: "001",
      trigger_text: "Failed action",
      trigger_ref: "@0-99",
      timestamp: "2026-05-18T20:13:00Z",
      request: { method: "POST", url: "https://app.example.com/api/x" },
      response: { status: 500 },
    },
  ];
  const endpointMap = {
    endpoints: [
      { method: "POST", path_template: "/api/projects", pages: ["001"], samples: 1 },
    ],
  };

  it("emits transitions for 2xx responses", () => {
    const sm = buildStateMachine({ submittedActions, navGraph, endpointMap });
    assert.ok(sm.find((t) => t.endpoint === "POST /api/projects"));
  });

  it("skips non-2xx responses", () => {
    const sm = buildStateMachine({ submittedActions, navGraph, endpointMap });
    assert.equal(sm.find((t) => t.endpoint === "POST /api/x"), undefined);
  });

  it("includes from/to/trigger fields", () => {
    const sm = buildStateMachine({ submittedActions, navGraph, endpointMap });
    const create = sm[0];
    assert.equal(create.from_screen, "001");
    assert.equal(create.trigger, "button:Create Project");
  });
});
