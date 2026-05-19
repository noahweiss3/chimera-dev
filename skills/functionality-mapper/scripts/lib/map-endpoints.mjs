export function isCollectionTemplate(template) {
  if (!template) return false;
  const last = template.replace(/\/$/, "").split("/").pop() ?? "";
  if (/^\{[^}]+\}$/.test(last)) return false;
  if (/^(me|self|current)$/i.test(last)) return false;
  return true;
}

function purposeFor(method, template) {
  if (method === "GET") {
    return isCollectionTemplate(template) ? "list items" : "load resource";
  }
  if (method === "POST") return "create resource";
  if (method === "PUT" || method === "PATCH") return "update resource";
  if (method === "DELETE") return "delete resource";
  return "unknown";
}

export function mapEndpointsForScreen({ pageId, endpointMap }) {
  if (!endpointMap?.endpoints) return [];
  const deps = [];
  for (const ep of endpointMap.endpoints) {
    if (!(ep.pages ?? []).includes(pageId)) continue;
    deps.push({
      endpoint: `${ep.method} ${ep.path_template}`,
      purpose: purposeFor(ep.method, ep.path_template),
      on_load: ep.method === "GET",
    });
  }
  return deps;
}
