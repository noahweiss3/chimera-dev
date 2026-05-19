function pathnameOf(url) {
  if (!url) return "";
  try {
    return new URL(url, "http://placeholder.invalid").pathname;
  } catch {
    return url;
  }
}

function findPageByHref(href, currentPageUrl, pages) {
  if (!href) return null;
  if (href.startsWith("javascript:") || href === "#") return null;

  let absolute;
  try {
    absolute = new URL(href, currentPageUrl || "http://placeholder.invalid").toString();
  } catch {
    return null;
  }
  const targetPath = pathnameOf(absolute);
  for (const p of pages) {
    if (pathnameOf(p.url) === targetPath) return p.id;
  }
  return null;
}

function findEdgeTargetByLabel(label, fromId, navGraph) {
  if (!navGraph?.edges) return null;
  for (const edge of navGraph.edges) {
    if (edge.from !== fromId) continue;
    if ((edge.label ?? "") === label) return edge.to;
  }
  return null;
}

function endpointForSubmittedAction(action) {
  if (!action?.request) return null;
  const method = action.request.method;
  const path = pathnameOf(action.request.url);
  if (!method || !path) return null;
  return `${method} ${path}`;
}

export function mapActionsForScreen({
  pageId,
  elements,
  submittedActions,
  navGraph,
  pages,
  endpointMap,
}) {
  const actions = [];
  const destructive_actions_skipped = [];

  const currentPage = (pages ?? []).find((p) => p.id === pageId);
  const currentPageUrl = currentPage?.url ?? "";

  const submittedByRef = new Map();
  const submittedByText = new Map();
  for (const a of submittedActions ?? []) {
    if (a.page_ref !== pageId) continue;
    if (a.trigger_ref) submittedByRef.set(a.trigger_ref, a);
    if (a.trigger_text) submittedByText.set(a.trigger_text, a);
  }

  function matchedEndpoint(submitted) {
    if (!submitted) return null;
    const raw = endpointForSubmittedAction(submitted);
    if (!raw || !endpointMap?.endpoints) return raw;
    const [method, path] = raw.split(" ", 2);
    for (const ep of endpointMap.endpoints) {
      if (ep.method !== method) continue;
      const re = new RegExp(
        "^" + ep.path_template.replace(/\{[^}]+\}/g, "[^/]+") + "$"
      );
      if (re.test(path)) return `${ep.method} ${ep.path_template}`;
    }
    return raw;
  }

  for (const button of elements.buttons ?? []) {
    const trigger = `button:${button.text}`;
    if (button.classification === "destructive") {
      destructive_actions_skipped.push({ trigger, ref: button.ref });
      continue;
    }
    const submitted =
      submittedByRef.get(button.ref) ?? submittedByText.get(button.text) ?? null;
    actions.push({
      trigger,
      ref: button.ref,
      classification: button.classification ?? "unknown",
      endpoint: matchedEndpoint(submitted),
      navigates_to: findEdgeTargetByLabel(button.text, pageId, navGraph),
    });
  }

  for (const link of elements.links ?? []) {
    const trigger = `link:${link.text}`;
    actions.push({
      trigger,
      ref: link.ref,
      classification: "navigation",
      endpoint: null,
      navigates_to:
        findPageByHref(link.href, currentPageUrl, pages ?? []) ??
        findEdgeTargetByLabel(link.text, pageId, navGraph),
    });
  }

  return { actions, destructive_actions_skipped };
}
