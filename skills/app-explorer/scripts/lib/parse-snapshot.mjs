const LINK_RE = /link "([^"]*)" (@[\d-]+) \[href=([^\]]+)\]/g;
const BUTTON_RE = /button "([^"]*)" (@[\d-]+)/g;
const FORM_RE = /form "([^"]*)"/g;
const INPUT_RE =
  /(textbox|searchbox|combobox|spinbutton|slider) "([^"]*)" (@[\d-]+)(?: \[name=([^\]]+)\])?/g;
const TITLE_RE = /^RootWebArea "([^"]*)"/;

export function parseSnapshot(text) {
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

  const allInputs = [];
  for (const m of text.matchAll(INPUT_RE)) {
    allInputs.push({
      name: m[4] ?? "",
      type: m[1],
      placeholder: m[2],
      ref: m[3],
    });
  }

  const forms = [];
  const formMatches = [...text.matchAll(FORM_RE)];
  for (const fm of formMatches) {
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
