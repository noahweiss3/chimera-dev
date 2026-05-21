const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_RE = /^\d+$/;
const HEX24_RE = /^[0-9a-f]{24}$/i;

function classifySegment(segment) {
  if (UUID_RE.test(segment)) return { param: true, name: "id" };
  if (NUMERIC_RE.test(segment)) return { param: true, name: "id" };
  if (HEX24_RE.test(segment)) return { param: true, name: "id" };
  return { param: false };
}

function pathnameOf(url) {
  try {
    return new URL(url, "http://placeholder.invalid").pathname;
  } catch {
    return url.split("?")[0];
  }
}

export function templatizePath(url) {
  const pathname = pathnameOf(url);
  const segments = pathname.split("/");
  const params = [];
  const out = segments.map((seg) => {
    if (!seg) return seg;
    const c = classifySegment(seg);
    if (!c.param) return seg;
    params.push({ name: c.name, value: seg });
    return `{${c.name}}`;
  });
  return { template: out.join("/"), params };
}

// Cross-URL structural inference: a segment position is a path parameter when
// sibling paths — same method, same length, identical at every other position
// — show two or more distinct literal values there. This catches slug params
// (`/articles/<slug>`) that no per-URL signal can identify, without
// misclassifying one-off static segments like `/projects/search`.
function inferStructuralParams(endpoints) {
  const positions = new Map(); // key -> Set(literal values)
  for (const ep of endpoints) {
    const segs = ep.path_template.split("/");
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (!s || s.startsWith("{")) continue;
      const mask = segs.map((x, j) => (j === i ? "*" : x)).join("/");
      const key = `${ep.method}|${mask}`;
      if (!positions.has(key)) positions.set(key, new Set());
      positions.get(key).add(s);
    }
  }

  return endpoints.map((ep) => {
    const segs = ep.path_template.split("/");
    const out = segs.map((s, i) => {
      if (!s || s.startsWith("{")) return s;
      const mask = segs.map((x, j) => (j === i ? "*" : x)).join("/");
      const values = positions.get(`${ep.method}|${mask}`);
      if (!values || values.size < 2) return s;
      const name = [...values].every((v) => NUMERIC_RE.test(v))
        ? "id"
        : "slug";
      return `{${name}}`;
    });
    return { ...ep, path_template: out.join("/") };
  });
}

export function groupByEndpoint(exchanges) {
  // Phase 1: per-URL hard-signal templatization, then group.
  const groups = new Map();
  for (const ex of exchanges) {
    const { template } = templatizePath(ex.url);
    const key = `${ex.method.toUpperCase()} ${template}`;
    if (!groups.has(key)) {
      groups.set(key, {
        method: ex.method.toUpperCase(),
        path_template: template,
        exchanges: [],
      });
    }
    groups.get(key).exchanges.push(ex);
  }

  // Phase 2: structural inference, then re-group on the refined templates.
  const refined = inferStructuralParams([...groups.values()]);
  const merged = new Map();
  for (const ep of refined) {
    const key = `${ep.method} ${ep.path_template}`;
    if (!merged.has(key)) {
      merged.set(key, {
        method: ep.method,
        path_template: ep.path_template,
        exchanges: [],
      });
    }
    merged.get(key).exchanges.push(...ep.exchanges);
  }

  return [...merged.values()].sort((a, b) => {
    if (a.path_template !== b.path_template) {
      return a.path_template.localeCompare(b.path_template);
    }
    return a.method.localeCompare(b.method);
  });
}
