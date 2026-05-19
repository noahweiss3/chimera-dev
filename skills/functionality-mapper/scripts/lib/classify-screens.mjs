const ID_TAIL_RE = /\/(?:\d+|[0-9a-f]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i;

function isFormView(elements) {
  return (elements.forms ?? []).some((f) => (f.fields ?? []).length >= 2);
}

function isListView(elements) {
  const links = elements.links ?? [];
  if (links.length < 3) return false;
  const prefixes = new Map();
  for (const link of links) {
    const m = link.href?.match(/^(\/[^/]+\/)[^/?#]+/);
    if (!m) continue;
    prefixes.set(m[1], (prefixes.get(m[1]) ?? 0) + 1);
  }
  for (const count of prefixes.values()) {
    if (count >= 3) return true;
  }
  return false;
}

function isDetailView(meta, elements) {
  if (!ID_TAIL_RE.test(meta.url ?? "")) return false;
  if (isListView(elements)) return false;
  const hasContent =
    (elements.buttons ?? []).length > 0 ||
    (elements.links ?? []).length > 0 ||
    (elements.forms ?? []).length > 0;
  return hasContent;
}

function isSettingsView(meta, elements) {
  const section = (meta.section ?? "").toLowerCase();
  if (section.includes("setting") || section.includes("preference")) return true;
  const toggleish = (elements.buttons ?? []).filter((b) => {
    const t = (b.text ?? "").toLowerCase();
    return /(toggle|enable|disable|switch)/.test(t);
  });
  if (toggleish.length >= 2) return true;
  return false;
}

function isEmptyState(elements) {
  const links = (elements.links ?? []).length;
  const buttons = (elements.buttons ?? []).length;
  const forms = (elements.forms ?? []).length;
  return links <= 2 && buttons === 0 && forms === 0;
}

export function classifyScreen({ meta, elements }) {
  if (isFormView(elements)) return "form";
  if (isListView(elements)) return "list";
  if (isDetailView(meta, elements)) return "detail";
  if (isSettingsView(meta, elements)) return "settings";
  if (isEmptyState(elements)) return "empty";
  return "unknown";
}
