import { singularize, pluralize, capitalize } from "./pluralize.mjs";

const WRAPPER_KEYS = new Set(["error", "message", "errors", "detail", "code"]);

function isWrapper(properties) {
  const keys = Object.keys(properties ?? {});
  if (keys.length === 0) return true;
  if (keys.every((k) => WRAPPER_KEYS.has(k.toLowerCase()))) return true;
  return false;
}

function jsonSchemaTypeFor(name, schema) {
  if (!schema || typeof schema !== "object") return "text";
  if (name === "id") return "uuid";
  if (name.endsWith("_id")) return "uuid";
  if (name.endsWith("_at")) return "timestamp";
  if (schema.format === "date-time") return "timestamp";
  switch (schema.type) {
    case "integer": return "integer";
    case "number": return "doublePrecision";
    case "boolean": return "boolean";
    case "string": return "text";
    case "array": return "array";
    case "object": return "object";
    default: return "text";
  }
}

function fieldFromProperty(name, schema, required) {
  const type = jsonSchemaTypeFor(name, schema);
  const field = {
    name,
    type,
    required: required.has(name),
  };
  if (name === "id") field.primary_key = true;
  if (schema?.enum) field.enum = schema.enum;
  return field;
}

function extractScalarFields(objectSchema) {
  const properties = objectSchema?.properties ?? {};
  const required = new Set(objectSchema?.required ?? []);
  const fields = [];
  const nestedObjects = [];
  for (const [name, propSchema] of Object.entries(properties)) {
    if (propSchema?.type === "object" && propSchema.properties) {
      nestedObjects.push({ name, schema: propSchema });
      continue;
    }
    if (propSchema?.type === "array" && propSchema.items?.type === "object") {
      // nested array of objects → relationship, not scalar
      continue;
    }
    fields.push(fieldFromProperty(name, propSchema, required));
  }
  return { fields, nestedObjects };
}

function structuralKey(fields) {
  return fields.map((f) => f.name).sort().join(",");
}

function entityNameFromPath(path) {
  // /api/projects → projects → Project
  // /api/users/me → users → User
  // /api/projects/{id} → projects → Project
  const segments = path.split("/").filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (seg.startsWith("{") || seg === "me" || seg === "self" || seg === "current") continue;
    return capitalize(singularize(seg));
  }
  return "Resource";
}

function collectResponseSchemas(openapi) {
  const out = []; // { path, method, status, schema, sourceLabel }
  const paths = openapi.paths ?? {};
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const responses = op.responses ?? {};
      for (const [status, response] of Object.entries(responses)) {
        const schema = response?.content?.["application/json"]?.schema;
        if (!schema) continue;
        out.push({
          path,
          method: method.toUpperCase(),
          status,
          schema,
          sourceLabel: `${method.toUpperCase()} ${path} (response ${status})`,
        });
      }
      const reqSchema = op.requestBody?.content?.["application/json"]?.schema;
      if (reqSchema) {
        out.push({
          path,
          method: method.toUpperCase(),
          status: "request",
          schema: reqSchema,
          sourceLabel: `${method.toUpperCase()} ${path} (request body)`,
          isRequest: true,
        });
      }
    }
  }
  return out;
}

function unwrap(schema, path) {
  // If schema is { properties: { <collection>: { type: array, items: object } } }, return items
  if (schema?.type === "object" && schema.properties) {
    const props = Object.entries(schema.properties);
    if (props.length === 1) {
      const [key, child] = props[0];
      if (child?.type === "array" && child.items?.type === "object") {
        return { schema: child.items, hintName: key };
      }
    }
  }
  return { schema, hintName: null };
}

function mergeFields(existing, incoming) {
  const byName = new Map(existing.map((f) => [f.name, { ...f }]));
  for (const f of incoming) {
    const cur = byName.get(f.name);
    if (!cur) {
      byName.set(f.name, { ...f });
    } else {
      if (f.required) cur.required = true;
      if (f.primary_key) cur.primary_key = true;
      if (f.enum && !cur.enum) cur.enum = f.enum;
      if (cur.type === "text" && f.type !== "text") cur.type = f.type;
    }
  }
  return [...byName.values()];
}

export function extractEntities({ openapi }) {
  const candidates = new Map();

  const samples = collectResponseSchemas(openapi);
  for (const sample of samples) {
    const { schema: unwrapped, hintName } = unwrap(sample.schema, sample.path);
    if (!unwrapped || unwrapped.type !== "object") continue;
    if (isWrapper(unwrapped.properties)) continue;
    const { fields, nestedObjects } = extractScalarFields(unwrapped);
    if (fields.length === 0) continue;

    let name;
    if (hintName) {
      name = capitalize(singularize(hintName));
    } else {
      name = entityNameFromPath(sample.path);
    }
    if (!name) continue;

    if (!candidates.has(name)) {
      candidates.set(name, {
        name,
        table: pluralizeTable(name),
        fields,
        relationships: [],
        sources: [sample.sourceLabel],
        nestedObjects,
      });
    } else {
      const existing = candidates.get(name);
      existing.fields = mergeFields(existing.fields, fields);
      if (!existing.sources.includes(sample.sourceLabel)) {
        existing.sources.push(sample.sourceLabel);
      }
      existing.nestedObjects.push(...nestedObjects);
    }

    // Each nested object becomes a candidate entity too
    for (const nested of nestedObjects) {
      const nestedName = capitalize(singularize(nested.name));
      if (!nestedName) continue;
      const { fields: nestedFields } = extractScalarFields(nested.schema);
      if (nestedFields.length === 0) continue;
      const nestedLabel = `${sample.sourceLabel} via ${nested.name}`;
      if (!candidates.has(nestedName)) {
        candidates.set(nestedName, {
          name: nestedName,
          table: pluralizeTable(nestedName),
          fields: nestedFields,
          relationships: [],
          sources: [nestedLabel],
          nestedObjects: [],
        });
      } else {
        const existing = candidates.get(nestedName);
        existing.fields = mergeFields(existing.fields, nestedFields);
        if (!existing.sources.includes(nestedLabel)) {
          existing.sources.push(nestedLabel);
        }
      }
    }
  }

  return [...candidates.values()];
}

function pluralizeTable(name) {
  return pluralize(name.toLowerCase());
}
