#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadInputs } from "./lib/load.mjs";
import { classifyScreen } from "./lib/classify-screens.mjs";
import { mapEndpointsForScreen } from "./lib/map-endpoints.mjs";
import { mapActionsForScreen } from "./lib/map-actions.mjs";
import { reconstructFlows, buildStateMachine } from "./lib/reconstruct-flows.mjs";

export function discover({ chimeraDir }) {
  const inputs = loadInputs(chimeraDir);
  const outDir = resolve(chimeraDir, "func-map");
  mkdirSync(outDir, { recursive: true });

  const pagesForLookup = inputs.pages.map((p) => ({ id: p.id, url: p.url }));

  const screens = inputs.pages.map((p) => {
    const type = classifyScreen({ meta: p.meta, elements: p.elements });
    const data_dependencies = mapEndpointsForScreen({
      pageId: p.id,
      endpointMap: inputs.endpointMap,
    });
    const { actions, destructive_actions_skipped } = mapActionsForScreen({
      pageId: p.id,
      elements: p.elements,
      submittedActions: inputs.submittedActions,
      navGraph: inputs.navGraph,
      pages: pagesForLookup,
      endpointMap: inputs.endpointMap,
    });
    const formsOnPage = inputs.forms
      .filter((f) => f.page_ref === p.id)
      .map((f) => f.id);
    return {
      id: p.id,
      name: p.meta.title ?? p.id,
      url: p.meta.url ?? "",
      type,
      section: p.meta.section ?? "",
      auth: !!p.meta.auth,
      data_dependencies,
      actions,
      forms: formsOnPage,
      destructive_actions_skipped,
    };
  });

  const flows = reconstructFlows({ screens, navGraph: inputs.navGraph });
  const stateMachine = buildStateMachine({
    submittedActions: inputs.submittedActions,
    navGraph: inputs.navGraph,
    endpointMap: inputs.endpointMap,
  });

  writeFileSync(
    resolve(outDir, "screens.json"),
    JSON.stringify({ screens }, null, 2) + "\n"
  );
  writeFileSync(
    resolve(outDir, "flows.json"),
    JSON.stringify({ flows }, null, 2) + "\n"
  );
  writeFileSync(
    resolve(outDir, "state-machine.json"),
    JSON.stringify({ transitions: stateMachine }, null, 2) + "\n"
  );

  const ambiguous = screens.filter((s) => s.type === "unknown");
  const endpointlessActions = screens
    .flatMap((s) => s.actions.map((a) => ({ screen: s.id, ...a })))
    .filter((a) => a.trigger.startsWith("button:") && a.endpoint === null);

  const lines = [
    "# Functionality Map Report",
    "",
    `Screens: ${screens.length}`,
    `Flows reconstructed: ${flows.length}`,
    `State transitions: ${stateMachine.length}`,
    "",
    "## Screens by type",
    "",
    "| Type | Count |",
    "|------|-------|",
    ...Object.entries(
      screens.reduce((acc, s) => ((acc[s.type] = (acc[s.type] ?? 0) + 1), acc), {})
    )
      .sort()
      .map(([t, n]) => `| ${t} | ${n} |`),
    "",
  ];
  if (ambiguous.length > 0) {
    lines.push("## Ambiguous screens (type: unknown)\n");
    for (const s of ambiguous) lines.push(`- \`${s.id}\` ${s.name} (${s.url})`);
    lines.push("");
  }
  if (endpointlessActions.length > 0) {
    lines.push("## Buttons with no inferred endpoint\n");
    for (const a of endpointlessActions) {
      lines.push(`- screen \`${a.screen}\`: ${a.trigger}`);
    }
    lines.push("");
  }
  if (inputs.warnings.length > 0) {
    lines.push("## Warnings\n");
    for (const w of inputs.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  writeFileSync(resolve(outDir, "report.md"), lines.join("\n"));

  return {
    status: "done",
    screens: screens.length,
    flows: flows.length,
    state_transitions: stateMachine.length,
    output_dir: outDir,
    warnings: inputs.warnings.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chimeraDir = resolve(process.cwd(), ".chimera");
  if (!existsSync(chimeraDir)) {
    console.error(JSON.stringify({ error: "No .chimera/ directory in cwd. Run app-explorer first." }));
    process.exit(1);
  }
  console.log(JSON.stringify(discover({ chimeraDir }), null, 2));
}
