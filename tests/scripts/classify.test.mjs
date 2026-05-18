import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyAction } from "../../skills/app-explorer/scripts/lib/classify.mjs";

describe("classifyAction", () => {
  it("classifies create/add/save as safe", () => {
    assert.equal(classifyAction("Create Project"), "safe");
    assert.equal(classifyAction("Add Member"), "safe");
    assert.equal(classifyAction("Save Changes"), "safe");
    assert.equal(classifyAction("Update Profile"), "safe");
    assert.equal(classifyAction("Submit"), "safe");
    assert.equal(classifyAction("Enable notifications"), "safe");
    assert.equal(classifyAction("Toggle dark mode"), "safe");
  });

  it("classifies delete/remove/archive as destructive", () => {
    assert.equal(classifyAction("Delete Project"), "destructive");
    assert.equal(classifyAction("Remove Member"), "destructive");
    assert.equal(classifyAction("Archive Team"), "destructive");
    assert.equal(classifyAction("Destroy Environment"), "destructive");
    assert.equal(classifyAction("Revoke Access"), "destructive");
    assert.equal(classifyAction("Disconnect Integration"), "destructive");
  });

  it("classifies ambiguous actions as unknown", () => {
    assert.equal(classifyAction("Submit"), "safe");
    assert.equal(classifyAction("Go"), "unknown");
    assert.equal(classifyAction("Process"), "unknown");
  });

  it("is case-insensitive", () => {
    assert.equal(classifyAction("DELETE"), "destructive");
    assert.equal(classifyAction("create"), "safe");
  });

  it("handles empty/whitespace input", () => {
    assert.equal(classifyAction(""), "unknown");
    assert.equal(classifyAction("   "), "unknown");
  });
});
