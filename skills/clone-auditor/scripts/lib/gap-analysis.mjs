import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const TODO_MARKER = /TODO\(chimera\)/;

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function pascalCase(text) {
  return text
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w[0]?.toUpperCase() ?? "") + w.slice(1))
    .join("");
}

function pluralize(s) {
  if (!s) return s;
  if (/[sxz]$/.test(s) || /ch$|sh$/.test(s)) return s + "es";
  if (/[^aeiou]y$/.test(s)) return s.slice(0, -1) + "ies";
  return s + "s";
}

export function analyzeGaps({ chimeraDir, cloneDir }) {
  const endpointMap = readJson(resolve(chimeraDir, "api-spec/endpoint-map.json"));
  const screensDoc = readJson(resolve(chimeraDir, "func-map/screens.json"));
  const entitiesDoc = readJson(resolve(chimeraDir, "model/entities.json"));

  const missing_routes = [];
  const stubbed_routes = [];
  const missing_pages = [];
  const stubbed_pages = [];
  const missing_entities_in_schema = [];

  const cloneExists = existsSync(cloneDir);

  // Routes: derive entity table from endpoint paths or from entities.json
  const tablesFromEndpoints = new Map(); // table -> [{ method, path }]
  if (endpointMap?.endpoints) {
    for (const ep of endpointMap.endpoints) {
      const segments = ep.path_template.split("/").filter(Boolean);
      let table = null;
      for (let i = segments.length - 1; i >= 0; i--) {
        const seg = segments[i];
        if (seg.startsWith("{") || ["me", "self", "current"].includes(seg)) continue;
        table = seg;
        break;
      }
      if (!table) continue;
      if (!tablesFromEndpoints.has(table)) tablesFromEndpoints.set(table, []);
      tablesFromEndpoints.get(table).push({ method: ep.method, path: ep.path_template });
    }
  }

  for (const [table, endpoints] of tablesFromEndpoints) {
    const routePath = resolve(cloneDir, `apps/api/src/routes/${table}.ts`);
    if (!cloneExists || !existsSync(routePath)) {
      for (const ep of endpoints) {
        missing_routes.push({ entity: table, method: ep.method, path: ep.path });
      }
      continue;
    }
    const src = readFileSync(routePath, "utf-8");
    if (TODO_MARKER.test(src)) {
      stubbed_routes.push({ entity: table, file: `apps/api/src/routes/${table}.ts` });
    }
  }

  // Pages
  if (screensDoc?.screens) {
    for (const screen of screensDoc.screens) {
      const name = pascalCase(screen.name);
      const pagePath = resolve(cloneDir, `apps/web/src/pages/${name}.tsx`);
      if (!cloneExists || !existsSync(pagePath)) {
        missing_pages.push({ screen: screen.id, expected_file: `apps/web/src/pages/${name}.tsx` });
        continue;
      }
      const src = readFileSync(pagePath, "utf-8");
      if (TODO_MARKER.test(src)) {
        stubbed_pages.push({ screen: screen.id, file: `apps/web/src/pages/${name}.tsx` });
      }
    }
  }

  // Entities in schema
  const schemaPath = resolve(cloneDir, "apps/api/src/db/schema.ts");
  const schemaSrc = existsSync(schemaPath) ? readFileSync(schemaPath, "utf-8") : "";
  if (entitiesDoc?.entities) {
    for (const entity of entitiesDoc.entities) {
      const re = new RegExp(`pgTable\\(["']${entity.table}["']`);
      if (!re.test(schemaSrc)) {
        missing_entities_in_schema.push({ entity: entity.name, table: entity.table });
      }
    }
  }

  const total =
    missing_routes.length +
    stubbed_routes.length +
    missing_pages.length +
    stubbed_pages.length +
    missing_entities_in_schema.length;

  return {
    missing_routes,
    stubbed_routes,
    missing_pages,
    stubbed_pages,
    missing_entities_in_schema,
    summary: {
      total_gaps: total,
      by_category: {
        missing_routes: missing_routes.length,
        stubbed_routes: stubbed_routes.length,
        missing_pages: missing_pages.length,
        stubbed_pages: stubbed_pages.length,
        missing_entities_in_schema: missing_entities_in_schema.length,
      },
    },
  };
}
