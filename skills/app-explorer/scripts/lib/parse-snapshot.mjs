// Parses the `browse snapshot` accessibility tree.
//
// `browse` >= 0.8 emits JSON: { tree: "<text>", urlMap: {...}, xpathMap: {...} }
// where each tree line is `<indent>[<ref>] <role>[: <name>]`.
// Older `browse` emitted plain text (`link "x" @0-1 [href=/y]`). This module
// detects which format it was given and parses accordingly.

// --- legacy plain-text format -------------------------------------------------

const LINK_RE = /link "([^"]*)" (@[\d-]+) \[href=([^\]]+)\]/g;
const BUTTON_RE = /button "([^"]*)" (@[\d-]+)/g;
const FORM_RE = /form "([^"]*)"/g;
const INPUT_RE =
  /(textbox|searchbox|combobox|spinbutton|slider) "([^"]*)" (@[\d-]+)(?: \[name=([^\]]+)\])?/g;
const TITLE_RE = /^RootWebArea "([^"]*)"/;

function parseLegacy(text) {
  const title = text.match(TITLE_RE)?.[1] ?? "";

  const seenHrefs = new Set();
  const links = [];
  for (const m of text.matchAll(LINK_RE)) {
    const href = m[3];
    if (seenHrefs.has(href)) continue;
    seenHrefs.add(href);
    links.push({ text: m[1], href, ref: m[2] });
  }

  const buttons = [];
  for (const m of text.matchAll(BUTTON_RE)) {
    buttons.push({ text: m[1], ref: m[2] });
  }

  const forms = [];
  for (const fm of text.matchAll(FORM_RE)) {
    const formStart = fm.index;
    const formIndent = text.lastIndexOf("\n", formStart);
    const formIndentLevel = formStart - formIndent - 1;

    const afterForm = text.slice(formStart + fm[0].length);
    const formFields = [];
    for (const line of afterForm.split("\n")) {
      const stripped = line.trimStart();
      const indent = line.length - stripped.length;
      if (indent <= formIndentLevel && stripped.length > 0) break;
      for (const inputMatch of line.matchAll(INPUT_RE)) {
        formFields.push({
          name: inputMatch[4] ?? "",
          type: inputMatch[1],
          placeholder: inputMatch[2],
          ref: inputMatch[3],
        });
      }
    }
    forms.push({ name: fm[1], fields: formFields });
  }

  return { title, links, buttons, forms };
}

// --- current JSON tree format -------------------------------------------------

const INPUT_ROLES = new Set([
  "textbox",
  "searchbox",
  "combobox",
  "spinbutton",
  "slider",
]);

const LINE_RE = /^(\s*)\[([^\]]+)\]\s+([A-Za-z][\w-]*)(?:[:,]\s?(.*))?$/;

function fieldType(role, label) {
  if (/password/i.test(label)) return "password";
  if (/e-?mail/i.test(label)) return "email";
  if (role === "spinbutton") return "number";
  if (role === "combobox") return "select";
  return "text";
}

function fieldName(label) {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "field"
  );
}

function normalizeHref(href, origin) {
  if (!href) return "";
  try {
    const u = new URL(href);
    if (origin && u.origin === origin) return u.pathname + u.search;
    return href;
  } catch {
    return href;
  }
}

function parseTree(input, origin) {
  const tree = input?.tree ?? "";
  const urlMap = input?.urlMap ?? {};
  let title = "";
  const links = [];
  const buttons = [];
  const inputs = [];
  const seenHref = new Set();

  for (const line of tree.split("\n")) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    const ref = m[2];
    const role = m[3];
    const name = (m[4] ?? "").trim();

    if (role === "RootWebArea") {
      title = name;
    } else if (role === "link") {
      const href = normalizeHref(urlMap[ref], origin);
      if (href && seenHref.has(href)) continue;
      if (href) seenHref.add(href);
      links.push({ text: name, href, ref: `@${ref}` });
    } else if (role === "button") {
      buttons.push({ text: name, ref: `@${ref}` });
    } else if (INPUT_ROLES.has(role)) {
      inputs.push({
        name: fieldName(name),
        type: fieldType(role, name),
        placeholder: name,
        ref: `@${ref}`,
      });
    }
  }

  // The JSON tree exposes no <form> grouping, so synthesize a single form
  // from the inputs present on the page.
  const forms = inputs.length
    ? [{ name: title || "form", fields: inputs }]
    : [];
  return { title, links, buttons, forms };
}

// --- dispatch -----------------------------------------------------------------

export function parseSnapshot(input, origin = "") {
  if (typeof input === "string") {
    const trimmed = input.trimStart();
    if (trimmed.startsWith("{")) {
      try {
        return parseTree(JSON.parse(input), origin);
      } catch {
        return parseLegacy(input);
      }
    }
    return parseLegacy(input);
  }
  return parseTree(input, origin);
}
