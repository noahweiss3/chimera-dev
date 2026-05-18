#!/usr/bin/env node
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  cpSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const outDir = resolve(process.cwd(), ".chimera");

if (!existsSync(resolve(outDir, "manifest.json"))) {
  console.error(
    JSON.stringify({
      error: "No .chimera/manifest.json found. Run init.mjs first.",
    })
  );
  process.exit(1);
}

const traceSkillPath = process.argv.find(
  (a, i) => process.argv[i - 1] === "--trace-scripts"
);
if (traceSkillPath) {
  try {
    execFileSync(
      "node",
      [resolve(traceSkillPath, "stop-capture.mjs"), "chimera-run"],
      { stdio: "inherit" }
    );
    execFileSync(
      "node",
      [resolve(traceSkillPath, "bisect-cdp.mjs"), "chimera-run"],
      { stdio: "inherit" }
    );
  } catch {
    console.error(JSON.stringify({ trace: "stop_failed" }));
  }
}

const o11yNetworkDir = resolve(
  process.cwd(),
  ".o11y/chimera-run/cdp/network"
);
if (existsSync(o11yNetworkDir)) {
  const tracesDir = resolve(outDir, "traces");
  cpSync(o11yNetworkDir, tracesDir, { recursive: true });
}

try {
  const networkPathOutput = execFileSync("browse", ["network", "path"], {
    encoding: "utf-8",
  }).trim();
  const parsed = JSON.parse(networkPathOutput);
  if (parsed.path && existsSync(parsed.path)) {
    cpSync(parsed.path, resolve(outDir, "traces/bodies"), { recursive: true });
  }
} catch {
  // no bodies captured
}

try {
  execFileSync("browse", ["network", "off"], { stdio: "pipe" });
} catch {
  // may not be on
}

const pagesDir = resolve(outDir, "pages");
const nodes = [];
const edges = [];

if (existsSync(pagesDir)) {
  const pageDirs = readdirSync(pagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  let prevId = null;
  for (const dir of pageDirs) {
    const metaPath = resolve(pagesDir, dir.name, "meta.json");
    if (!existsSync(metaPath)) continue;

    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
    nodes.push({
      id: meta.id,
      url: meta.url,
      title: meta.title,
      auth: meta.auth,
    });

    if (prevId) {
      edges.push({
        from: prevId,
        to: meta.id,
        action: "navigate",
        label: `Navigated to ${meta.title}`,
      });
    }
    prevId = meta.id;
  }
}

writeFileSync(
  resolve(outDir, "nav-graph.json"),
  JSON.stringify({ nodes, edges }, null, 2) + "\n"
);

const formsDir = resolve(outDir, "forms");
const formsCount = existsSync(formsDir)
  ? readdirSync(formsDir).filter((f) => f.endsWith(".json")).length
  : 0;

const submittedDir = resolve(outDir, "actions/submitted");
const submittedCount = existsSync(submittedDir)
  ? readdirSync(submittedDir).filter((f) => f.endsWith(".json")).length
  : 0;

const skippedDir = resolve(outDir, "actions/skipped");
const skippedCount = existsSync(skippedDir)
  ? readdirSync(skippedDir).filter((f) => f.endsWith(".json")).length
  : 0;

let networkCount = 0;
const networkJsonl = resolve(outDir, "traces/requests.jsonl");
if (existsSync(networkJsonl)) {
  const content = readFileSync(networkJsonl, "utf-8");
  networkCount = content.split("\n").filter((l) => l.trim()).length;
}

const manifest = JSON.parse(
  readFileSync(resolve(outDir, "manifest.json"), "utf-8")
);
manifest.timestamp_end = new Date().toISOString();
manifest.coverage = {
  pages_visited: nodes.length,
  forms_found: formsCount,
  forms_submitted: submittedCount,
  actions_skipped: skippedCount,
  api_calls_captured: networkCount,
  unvisited_links: 0,
};

writeFileSync(
  resolve(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n"
);

const report = {
  status: "finalized",
  pages: nodes.length,
  forms: formsCount,
  actions_submitted: submittedCount,
  actions_skipped: skippedCount,
  api_calls: networkCount,
  duration_seconds: Math.round(
    (new Date(manifest.timestamp_end) - new Date(manifest.timestamp_start)) /
      1000
  ),
};

console.log(JSON.stringify(report, null, 2));
