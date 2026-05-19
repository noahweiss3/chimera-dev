import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

export function loadInputs(chimeraDir) {
  const warnings = [];
  const manifest = readJson(resolve(chimeraDir, "manifest.json"));
  if (!manifest) warnings.push("manifest.json missing or invalid");

  const navGraph = readJson(resolve(chimeraDir, "nav-graph.json")) ?? { nodes: [], edges: [] };

  const pagesDir = resolve(chimeraDir, "pages");
  const pages = [];
  if (existsSync(pagesDir)) {
    for (const dir of readdirSync(pagesDir).sort()) {
      const meta = readJson(resolve(pagesDir, dir, "meta.json"));
      const elements = readJson(resolve(pagesDir, dir, "elements.json"));
      if (!meta) {
        warnings.push(`page ${dir}: meta.json missing`);
        continue;
      }
      pages.push({
        id: meta.id ?? dir,
        url: meta.url ?? "",
        meta,
        elements: elements ?? { links: [], buttons: [], forms: [] },
      });
    }
  } else {
    warnings.push("pages/ directory missing");
  }

  const formsDir = resolve(chimeraDir, "forms");
  const forms = [];
  if (existsSync(formsDir)) {
    for (const file of readdirSync(formsDir).filter((f) => f.endsWith(".json"))) {
      const form = readJson(resolve(formsDir, file));
      if (form) forms.push(form);
    }
  }

  function readActionDir(name) {
    const dir = resolve(chimeraDir, "actions", name);
    if (!existsSync(dir)) return [];
    const out = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const action = readJson(resolve(dir, file));
      if (action) out.push({ ...action, _file: file });
    }
    return out;
  }
  const submittedActions = readActionDir("submitted");
  const skippedActions = readActionDir("skipped");

  const endpointMap = readJson(resolve(chimeraDir, "api-spec", "endpoint-map.json"));
  if (!endpointMap) warnings.push("api-spec/endpoint-map.json missing — data_dependencies will be empty");

  return {
    manifest,
    navGraph,
    pages,
    forms,
    submittedActions,
    skippedActions,
    endpointMap,
    warnings,
  };
}
