#!/usr/bin/env node
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { extractEntities } from "./lib/extract-entities.mjs";
import { inferRelationships } from "./lib/infer-relationships.mjs";
import { buildDrizzleSchema } from "./lib/emit-drizzle.mjs";
import { buildErd } from "./lib/emit-erd.mjs";

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

export function discover({ chimeraDir }) {
  const outDir = resolve(chimeraDir, "model");
  mkdirSync(outDir, { recursive: true });

  const openapi = readJson(resolve(chimeraDir, "api-spec/openapi.json"));
  if (!openapi) {
    const err = "api-spec/openapi.json missing. Run api-mapper first.";
    writeFileSync(resolve(outDir, "report.md"), `# Model Inferrer Report\n\nFAILED: ${err}\n`);
    return { status: "failed", error: err };
  }

  const formsDir = resolve(chimeraDir, "forms");
  const forms = [];
  if (existsSync(formsDir)) {
    for (const f of readdirSync(formsDir).filter((n) => n.endsWith(".json"))) {
      const form = readJson(resolve(formsDir, f));
      if (form) forms.push(form);
    }
  }

  let entities = extractEntities({ openapi });

  // Augment required-ness from forms
  for (const form of forms) {
    for (const field of form.fields ?? []) {
      // Best effort: any entity that has a field with this name; mark required from form
      for (const entity of entities) {
        const match = entity.fields.find((f) => f.name === field.name);
        if (match) match.required = true;
      }
    }
  }

  entities = inferRelationships({ entities, openapi });

  // Strip the internal nestedObjects field before emitting
  const cleanEntities = entities.map(({ nestedObjects, ...rest }) => rest);

  writeFileSync(
    resolve(outDir, "entities.json"),
    JSON.stringify({ entities: cleanEntities }, null, 2) + "\n"
  );

  const schemaTs = buildDrizzleSchema(entities);
  writeFileSync(resolve(outDir, "schema.ts"), schemaTs);

  const erd = buildErd(entities);
  writeFileSync(resolve(outDir, "erd.md"), erd);

  // Confidence: high if entity appears in ≥2 sources, low if 1
  const byConfidence = entities.map((e) => ({
    name: e.name,
    sources: e.sources.length,
    confidence: e.sources.length >= 2 ? "high" : "low",
  }));

  const lines = [
    "# Model Inferrer Report",
    "",
    `Entities discovered: ${entities.length}`,
    `Total relationships: ${entities.reduce((n, e) => n + e.relationships.length, 0)}`,
    "",
    "## Entities",
    "",
    "| Entity | Fields | Relationships | Sources | Confidence |",
    "|--------|--------|---------------|---------|------------|",
    ...entities.map(
      (e) => `| ${e.name} | ${e.fields.length} | ${e.relationships.length} | ${e.sources.length} | ${e.sources.length >= 2 ? "high" : "low"} |`
    ),
    "",
    "## Single-source entities (lower confidence)",
    "",
    ...byConfidence
      .filter((e) => e.confidence === "low")
      .map((e) => `- ${e.name}`),
  ];
  writeFileSync(resolve(outDir, "report.md"), lines.join("\n") + "\n");

  return {
    status: "done",
    entities: entities.length,
    relationships: entities.reduce((n, e) => n + e.relationships.length, 0),
    output_dir: outDir,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chimeraDir = resolve(process.cwd(), ".chimera");
  if (!existsSync(chimeraDir)) {
    console.error(JSON.stringify({ error: "No .chimera/ directory in cwd." }));
    process.exit(1);
  }
  console.log(JSON.stringify(discover({ chimeraDir }), null, 2));
}
