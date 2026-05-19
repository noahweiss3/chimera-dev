#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { analyzeGaps } from "./lib/gap-analysis.mjs";

const RECOMMENDATIONS = {
  missing_routes: "Run app-reconstructor (it scaffolds routes from entity definitions). If the entity is wrong, fix model-inferrer's output first.",
  stubbed_routes: "Open the file and replace the TODO with CRUD handlers — see app-reconstructor SKILL.md step 'Generate API routes'.",
  missing_pages: "Run app-reconstructor again (it creates page stubs from func-map/screens.json).",
  stubbed_pages: "Open the file and replace the TODO with component code — see app-reconstructor SKILL.md step 'Generate page components'.",
  missing_entities_in_schema: "Update .chimera/model/schema.ts (manually or by re-running model-inferrer) and re-copy into the clone.",
};

export function discover({ chimeraDir, cloneDir }) {
  const outDir = resolve(chimeraDir, "audit");
  mkdirSync(outDir, { recursive: true });

  const gaps = analyzeGaps({ chimeraDir, cloneDir });

  writeFileSync(
    resolve(outDir, "gap-analysis.json"),
    JSON.stringify(gaps, null, 2) + "\n"
  );

  // Recommendations
  const recLines = ["# Recommendations", ""];
  for (const [category, items] of Object.entries(gaps).filter(([k]) => k !== "summary")) {
    if (!Array.isArray(items) || items.length === 0) continue;
    recLines.push(`## ${category} (${items.length})`);
    recLines.push("");
    recLines.push(RECOMMENDATIONS[category] ?? "");
    recLines.push("");
    for (const item of items) {
      recLines.push(`- ${JSON.stringify(item)}`);
    }
    recLines.push("");
  }
  if (gaps.summary.total_gaps === 0) {
    recLines.push("No gaps detected — every entity, route, and page traced into the clone.");
    recLines.push("");
  }
  writeFileSync(resolve(outDir, "recommendations.md"), recLines.join("\n"));

  // Report
  const reportLines = [
    "# Clone Auditor Report",
    "",
    `Total gaps: ${gaps.summary.total_gaps}`,
    "",
    "## Gaps by category",
    "",
    "| Category | Count |",
    "|----------|-------|",
    ...Object.entries(gaps.summary.by_category).map(([k, v]) => `| ${k} | ${v} |`),
    "",
  ];
  if (gaps.summary.total_gaps === 0) {
    reportLines.push("All claimed surfaces are implemented in the clone. (Runtime behavior not checked — run `diff-api.mjs` for that.)");
  } else {
    reportLines.push("See `recommendations.md` for per-gap guidance.");
  }
  writeFileSync(resolve(outDir, "report.md"), reportLines.join("\n") + "\n");

  return {
    status: "done",
    total_gaps: gaps.summary.total_gaps,
    by_category: gaps.summary.by_category,
    output_dir: outDir,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chimeraDir = resolve(process.cwd(), ".chimera");
  const cloneArg = process.argv.find((a, i) => process.argv[i - 1] === "--clone");
  const cloneDir = resolve(process.cwd(), cloneArg ?? "chimera-clone");
  if (!existsSync(chimeraDir)) {
    console.error(JSON.stringify({ error: "No .chimera/ directory in cwd." }));
    process.exit(1);
  }
  console.log(JSON.stringify(discover({ chimeraDir, cloneDir }), null, 2));
}
