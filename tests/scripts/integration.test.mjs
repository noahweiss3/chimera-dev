import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const CHIMERA_DIR = resolve(ROOT, ".chimera");

describe("integration: init -> capture -> finalize", () => {
  before(() => {
    if (existsSync(CHIMERA_DIR)) rmSync(CHIMERA_DIR, { recursive: true });
  });

  after(() => {
    if (existsSync(CHIMERA_DIR)) rmSync(CHIMERA_DIR, { recursive: true });
  });

  it("init creates directory structure and manifest", () => {
    execFileSync(
      "node",
      [
        "skills/app-explorer/scripts/init.mjs",
        "--url",
        "https://test.example.com",
        "--explore",
      ],
      { cwd: ROOT, encoding: "utf-8" }
    );
    assert.ok(existsSync(CHIMERA_DIR));
    assert.ok(existsSync(resolve(CHIMERA_DIR, "manifest.json")));
    assert.ok(existsSync(resolve(CHIMERA_DIR, "pages")));
    assert.ok(existsSync(resolve(CHIMERA_DIR, "traces")));
    assert.ok(existsSync(resolve(CHIMERA_DIR, "forms")));
    assert.ok(existsSync(resolve(CHIMERA_DIR, "actions/submitted")));
    assert.ok(existsSync(resolve(CHIMERA_DIR, "actions/skipped")));

    const manifest = JSON.parse(
      readFileSync(resolve(CHIMERA_DIR, "manifest.json"), "utf-8")
    );
    assert.equal(manifest.mode, "explore");
    assert.equal(manifest.target_url, "https://test.example.com");
    assert.equal(manifest.version, "1.0.0");
  });

  it("simulated page captures write correct files", () => {
    const pageDir = resolve(CHIMERA_DIR, "pages/000");
    mkdirSync(pageDir, { recursive: true });

    const meta = {
      id: "000",
      url: "/",
      title: "Home",
      timestamp: new Date().toISOString(),
      auth: false,
      section: "public",
    };
    writeFileSync(resolve(pageDir, "meta.json"), JSON.stringify(meta, null, 2));

    const elements = {
      links: [{ text: "Login", href: "/login", ref: "@0-1" }],
      buttons: [],
      forms: [],
    };
    writeFileSync(
      resolve(pageDir, "elements.json"),
      JSON.stringify(elements, null, 2)
    );

    const page2Dir = resolve(CHIMERA_DIR, "pages/001");
    mkdirSync(page2Dir, { recursive: true });
    const meta2 = {
      id: "001",
      url: "/dashboard",
      title: "Dashboard",
      timestamp: new Date().toISOString(),
      auth: true,
      section: "dashboard",
    };
    writeFileSync(
      resolve(page2Dir, "meta.json"),
      JSON.stringify(meta2, null, 2)
    );

    assert.ok(existsSync(resolve(pageDir, "meta.json")));
    assert.ok(existsSync(resolve(page2Dir, "meta.json")));
  });

  it("finalize compiles nav-graph and updates manifest", () => {
    execFileSync("node", ["skills/app-explorer/scripts/finalize.mjs"], {
      cwd: ROOT,
      encoding: "utf-8",
    });

    const navGraph = JSON.parse(
      readFileSync(resolve(CHIMERA_DIR, "nav-graph.json"), "utf-8")
    );
    assert.equal(navGraph.nodes.length, 2);
    assert.equal(navGraph.nodes[0].url, "/");
    assert.equal(navGraph.nodes[1].url, "/dashboard");
    assert.equal(navGraph.edges.length, 1);
    assert.equal(navGraph.edges[0].from, "000");
    assert.equal(navGraph.edges[0].to, "001");

    const manifest = JSON.parse(
      readFileSync(resolve(CHIMERA_DIR, "manifest.json"), "utf-8")
    );
    assert.ok(manifest.timestamp_end);
    assert.equal(manifest.coverage.pages_visited, 2);
  });
});
