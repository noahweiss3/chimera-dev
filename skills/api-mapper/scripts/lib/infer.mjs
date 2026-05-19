const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URI_RE = /^https?:\/\/\S+$/;

function detectStringFormat(s) {
  if (ISO_DATETIME_RE.test(s)) return "date-time";
  if (EMAIL_RE.test(s)) return "email";
  if (URI_RE.test(s)) return "uri";
  return null;
}

export function inferSchema(value) {
  if (value === null) return { type: "null" };
  if (typeof value === "boolean") return { type: "boolean" };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
  }
  if (typeof value === "string") {
    const format = detectStringFormat(value);
    return format ? { type: "string", format } : { type: "string" };
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return { type: "array", items: {} };
    const itemSchemas = value.map(inferSchema);
    return { type: "array", items: mergeSchemas(itemSchemas) };
  }
  if (typeof value === "object") {
    const properties = {};
    const required = [];
    for (const [k, v] of Object.entries(value)) {
      properties[k] = inferSchema(v);
      required.push(k);
    }
    return { type: "object", properties, required };
  }
  return {};
}

function mergeTwo(a, b) {
  if (!a) return b;
  if (!b) return a;

  if (a.oneOf || b.oneOf) {
    const variants = [...(a.oneOf ?? [a]), ...(b.oneOf ?? [b])];
    return collapseVariants(variants);
  }

  if (a.type === "integer" && b.type === "number") return { type: "number" };
  if (a.type === "number" && b.type === "integer") return { type: "number" };
  if (a.type === b.type && b.type === "null") return { type: "null" };

  if (a.type === "null" && b.type !== "null") return { ...b, nullable: true };
  if (b.type === "null" && a.type !== "null") return { ...a, nullable: true };

  if (a.type !== b.type) {
    return collapseVariants([a, b]);
  }

  if (a.type === "string") {
    const merged = { type: "string" };
    if (a.format && b.format && a.format === b.format) {
      merged.format = a.format;
    }
    return merged;
  }

  if (a.type === "array") {
    return { type: "array", items: mergeTwo(a.items ?? {}, b.items ?? {}) };
  }

  if (a.type === "object") {
    const allKeys = new Set([
      ...Object.keys(a.properties ?? {}),
      ...Object.keys(b.properties ?? {}),
    ]);
    const aReq = new Set(a.required ?? []);
    const bReq = new Set(b.required ?? []);
    const properties = {};
    const required = [];
    for (const key of allKeys) {
      const aProp = a.properties?.[key];
      const bProp = b.properties?.[key];
      properties[key] = aProp && bProp ? mergeTwo(aProp, bProp) : aProp ?? bProp;
      if (aReq.has(key) && bReq.has(key)) required.push(key);
    }
    return { type: "object", properties, required };
  }

  return a;
}

function collapseVariants(variants) {
  const seen = new Set();
  const out = [];
  for (const v of variants) {
    const key = JSON.stringify(v);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  if (out.length === 1) return out[0];
  return { oneOf: out };
}

export function mergeSchemas(schemas) {
  if (schemas.length === 0) return {};
  if (schemas.length === 1) return schemas[0];
  return schemas.reduce((a, b) => mergeTwo(a, b));
}
