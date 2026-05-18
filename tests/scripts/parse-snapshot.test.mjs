import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSnapshot } from "../../skills/app-explorer/scripts/lib/parse-snapshot.mjs";

const fixture = readFileSync(
  new URL("../fixtures/snapshot-dashboard.txt", import.meta.url),
  "utf-8"
);

describe("parseSnapshot", () => {
  const result = parseSnapshot(fixture);

  it("extracts links with text, href, and ref", () => {
    const navLinks = result.links.filter((l) => l.href.startsWith("/"));
    assert.ok(navLinks.length >= 5);
    const dashboard = navLinks.find((l) => l.text === "Dashboard");
    assert.deepStrictEqual(dashboard, {
      text: "Dashboard",
      href: "/dashboard",
      ref: "@0-1",
    });
  });

  it("extracts external links", () => {
    const ext = result.links.find((l) =>
      l.href.startsWith("https://external")
    );
    assert.ok(ext);
    assert.equal(ext.href, "https://external.com/docs");
  });

  it("deduplicates links by href", () => {
    const projectLinks = result.links.filter((l) => l.href === "/projects");
    assert.equal(projectLinks.length, 1);
  });

  it("extracts buttons with text and ref", () => {
    assert.ok(result.buttons.length >= 4);
    const create = result.buttons.find((b) => b.text === "Create Project");
    assert.deepStrictEqual(create, {
      text: "Create Project",
      ref: "@0-6",
    });
  });

  it("extracts forms with name and fields", () => {
    assert.equal(result.forms.length, 1);
    assert.equal(result.forms[0].name, "Search");
    assert.deepStrictEqual(result.forms[0].fields, [
      { name: "query", type: "textbox", placeholder: "Search projects...", ref: "@0-10" },
    ]);
  });

  it("extracts page title", () => {
    assert.equal(result.title, "Dashboard - My App");
  });
});
