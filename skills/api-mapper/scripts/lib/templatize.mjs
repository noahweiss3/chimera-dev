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

export function groupByEndpoint(exchanges) {
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
  return [...groups.values()].sort((a, b) => {
    if (a.path_template !== b.path_template) {
      return a.path_template.localeCompare(b.path_template);
    }
    return a.method.localeCompare(b.method);
  });
}
