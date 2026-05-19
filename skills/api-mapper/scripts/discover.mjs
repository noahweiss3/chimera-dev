#!/usr/bin/env node
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadExchanges } from "./lib/load.mjs";
import { filterExchanges } from "./lib/filter.mjs";
import { groupByEndpoint } from "./lib/templatize.mjs";
import { detectAuth } from "./lib/auth.mjs";
import { buildOpenApi } from "./lib/emit-openapi.mjs";
import { buildClient } from "./lib/emit-client.mjs";
import { toYaml } from "./lib/yaml.mjs";

export function discover({ chimeraDir }) {
  const outDir = resolve(chimeraDir, "api-spec");
  const tracesDir = resolve(chimeraDir, "traces");
  const actionsDir = resolve(chimeraDir, "actions");
  const bodiesDir = resolve(tracesDir, "bodies");
  const pagesDir = resolve(chimeraDir, "pages");
  const manifestPath = resolve(chimeraDir, "manifest.json");

  mkdirSync(outDir, { recursive: true });

  const { exchanges, warnings, manifest } = loadExchanges({
    tracesDir,
    actionsDir,
    bodiesDir,
    manifestPath,
  });

  const targetUrl = manifest?.target_url ?? "";
  const appOrigins = [];
  if (targetUrl) {
    try {
      appOrigins.push(new URL(targetUrl).origin);
    } catch {}
  }

  const filtered = filterExchanges(exchanges, { appOrigins });
  const endpoints = groupByEndpoint(filtered);
  const auth = detectAuth(filtered);

  const pageTimestamps = [];
  if (existsSync(pagesDir)) {
    for (const dir of readdirSync(pagesDir)) {
      const metaPath = resolve(pagesDir, dir, "meta.json");
      if (!existsSync(metaPath)) continue;
      try {
        const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
        pageTimestamps.push({
          id: meta.id,
          timestamp: new Date(meta.timestamp).getTime() / 1000,
        });
      } catch {}
    }
  }

  function pagesForExchange(ex) {
    const ts = typeof ex.timestamp === "number"
      ? ex.timestamp
      : ex.timestamp
        ? new Date(ex.timestamp).getTime() / 1000
        : null;
    if (ts === null || isNaN(ts)) return [];
    return pageTimestamps
      .filter((p) => Math.abs(p.timestamp - ts) <= 30)
      .map((p) => p.id);
  }

  const endpointMap = endpoints.map((ep) => {
    const pageSet = new Set();
    for (const ex of ep.exchanges) {
      for (const id of pagesForExchange(ex)) pageSet.add(id);
    }
    return {
      method: ep.method,
      path_template: ep.path_template,
      pages: [...pageSet].sort(),
      samples: ep.exchanges.length,
    };
  });

  const openapi = buildOpenApi({
    endpoints,
    auth,
    targetUrl,
  });

  const client = buildClient({
    endpoints,
    auth,
    baseUrl: targetUrl,
  });

  writeFileSync(resolve(outDir, "openapi.json"), JSON.stringify(openapi, null, 2) + "\n");
  writeFileSync(resolve(outDir, "openapi.yaml"), toYaml(openapi));
  writeFileSync(resolve(outDir, "endpoint-map.json"), JSON.stringify({ endpoints: endpointMap }, null, 2) + "\n");
  writeFileSync(resolve(outDir, "auth-scheme.json"), JSON.stringify(auth, null, 2) + "\n");
  writeFileSync(resolve(outDir, "client.mjs"), client);

  const totalSamples = endpoints.reduce((n, ep) => n + ep.exchanges.length, 0);
  const unmappedPages = pageTimestamps
    .filter((p) => !endpointMap.some((e) => e.pages.includes(p.id)))
    .map((p) => p.id);

  const lines = [
    "# API Mapper Report",
    "",
    `Target: ${targetUrl || "(unknown)"}`,
    `Endpoints discovered: ${endpoints.length}`,
    `Total samples: ${totalSamples}`,
    `Auth scheme: ${auth.type}`,
    "",
    "## Endpoints",
    "",
    "| Method | Path | Samples | Pages |",
    "|--------|------|---------|-------|",
    ...endpointMap.map((e) =>
      `| ${e.method} | \`${e.path_template}\` | ${e.samples} | ${e.pages.join(", ") || "—"} |`
    ),
    "",
  ];
  if (unmappedPages.length > 0) {
    lines.push(`## Unmapped pages\n\n${unmappedPages.map((p) => `- ${p}`).join("\n")}\n`);
  }
  if (warnings.length > 0) {
    lines.push("## Warnings\n\n" + warnings.map((w) => `- ${w}`).join("\n") + "\n");
  }
  writeFileSync(resolve(outDir, "report.md"), lines.join("\n"));

  return {
    status: "done",
    endpoints: endpoints.length,
    samples: totalSamples,
    auth: auth.type,
    output_dir: outDir,
    warnings: warnings.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chimeraDir = resolve(process.cwd(), ".chimera");
  if (!existsSync(chimeraDir)) {
    console.error(JSON.stringify({ error: "No .chimera/ directory in cwd. Run app-explorer first." }));
    process.exit(1);
  }
  const result = discover({ chimeraDir });
  console.log(JSON.stringify(result, null, 2));
}
