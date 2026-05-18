#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const mode = process.argv.includes("--explore") ? "explore" : "safe";
const targetUrl =
  process.argv.find((a, i) => process.argv[i - 1] === "--url") ?? "";
const outDir = resolve(process.cwd(), ".chimera");

const dirs = [
  outDir,
  resolve(outDir, "pages"),
  resolve(outDir, "traces"),
  resolve(outDir, "forms"),
  resolve(outDir, "actions/submitted"),
  resolve(outDir, "actions/skipped"),
];

for (const dir of dirs) {
  mkdirSync(dir, { recursive: true });
}

const manifest = {
  version: "1.0.0",
  tool: "chimera-dev",
  skill: "app-explorer",
  timestamp_start: new Date().toISOString(),
  timestamp_end: null,
  target_url: targetUrl,
  mode,
  coverage: {
    pages_visited: 0,
    forms_found: 0,
    forms_submitted: 0,
    actions_skipped: 0,
    api_calls_captured: 0,
    unvisited_links: 0,
  },
};

writeFileSync(
  resolve(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n"
);
writeFileSync(
  resolve(outDir, "nav-graph.json"),
  JSON.stringify({ nodes: [], edges: [] }, null, 2) + "\n"
);

console.log(
  JSON.stringify({
    status: "initialized",
    mode,
    output_dir: outDir,
    target_url: targetUrl,
  })
);

const traceSkillPath = process.argv.find(
  (a, i) => process.argv[i - 1] === "--trace-scripts"
);
if (traceSkillPath) {
  try {
    const cdpTarget =
      process.argv.find((a, i) => process.argv[i - 1] === "--cdp") ?? "";
    if (cdpTarget) {
      execFileSync(
        "node",
        [resolve(traceSkillPath, "start-capture.mjs"), cdpTarget, "chimera-run"],
        { stdio: "inherit" }
      );
      console.log(JSON.stringify({ trace: "started", run: "chimera-run" }));
    }
  } catch {
    console.error(
      JSON.stringify({
        trace: "failed",
        message:
          "Could not start browser-trace. Network capture will be unavailable.",
      })
    );
  }
}

try {
  execFileSync("browse", ["network", "on"], { stdio: "pipe" });
  console.log(JSON.stringify({ network_bodies: "enabled" }));
} catch {
  console.error(
    JSON.stringify({
      network_bodies: "unavailable",
      message:
        "browse network on failed. Response bodies will not be captured.",
    })
  );
}
