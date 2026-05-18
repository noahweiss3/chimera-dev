#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { parseSnapshot } from "./lib/parse-snapshot.mjs";
import { classifyAction } from "./lib/classify.mjs";

const pageId =
  process.argv.find((a, i) => process.argv[i - 1] === "--id") ?? "000";
const section =
  process.argv.find((a, i) => process.argv[i - 1] === "--section") ?? "unknown";
const isAuth = process.argv.includes("--auth");
const outDir = resolve(process.cwd(), ".chimera");
const pageDir = resolve(outDir, "pages", pageId);

mkdirSync(pageDir, { recursive: true });

function run(args) {
  try {
    return execFileSync("browse", args, {
      encoding: "utf-8",
      timeout: 15000,
    }).trim();
  } catch {
    return "";
  }
}

const url = run(["get", "url"]);
const title = run(["get", "title"]);
const snapshotText = run(["snapshot"]);

const screenshotPath = resolve(pageDir, "screenshot.png");
try {
  execFileSync("browse", ["screenshot", "--path", screenshotPath], {
    timeout: 15000,
  });
} catch {
  // screenshot optional
}

const meta = {
  id: pageId,
  url,
  title,
  timestamp: new Date().toISOString(),
  auth: isAuth,
  section,
};

writeFileSync(
  resolve(pageDir, "meta.json"),
  JSON.stringify(meta, null, 2) + "\n"
);
writeFileSync(
  resolve(pageDir, "snapshot.json"),
  JSON.stringify({ raw: snapshotText }, null, 2) + "\n"
);

const parsed = parseSnapshot(snapshotText);

const classifiedButtons = parsed.buttons.map((b) => ({
  ...b,
  classification: classifyAction(b.text),
}));

const elements = {
  links: parsed.links,
  buttons: classifiedButtons,
  forms: parsed.forms,
};

writeFileSync(
  resolve(pageDir, "elements.json"),
  JSON.stringify(elements, null, 2) + "\n"
);

for (const form of parsed.forms) {
  const slug = form.name.toLowerCase().replace(/\s+/g, "-");
  const formFile = resolve(outDir, "forms", `${pageId}-${slug}.json`);
  const formData = {
    id: `${pageId}-${slug}`,
    page_ref: pageId,
    fields: form.fields,
    submit_button: null,
    method: null,
    action_url: null,
  };
  writeFileSync(formFile, JSON.stringify(formData, null, 2) + "\n");
}

const navTargets = parsed.links
  .filter((l) => l.href.startsWith("/"))
  .map((l) => l.href);

const summary = {
  id: pageId,
  title: title || parsed.title,
  url,
  links: parsed.links.length,
  buttons: classifiedButtons.length,
  forms: parsed.forms.length,
  safe_actions: classifiedButtons.filter((b) => b.classification === "safe")
    .length,
  destructive_actions: classifiedButtons.filter(
    (b) => b.classification === "destructive"
  ).length,
  navigation_targets: [...new Set(navTargets)],
};

console.log(JSON.stringify(summary));
