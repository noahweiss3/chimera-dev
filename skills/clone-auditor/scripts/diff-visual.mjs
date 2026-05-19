#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };
  return {
    chimeraDir: resolve(process.cwd(), get("--chimera") ?? ".chimera"),
    cloneScreenshotsDir: get("--clone-shots")
      ? resolve(process.cwd(), get("--clone-shots"))
      : null,
  };
}

function pascalCase(text) {
  return text
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w[0]?.toUpperCase() ?? "") + w.slice(1))
    .join("");
}

function htmlFor(screen, originalRel, cloneRel) {
  const cloneSection = cloneRel
    ? `<figure><figcaption>Clone</figcaption><img src="${cloneRel}" alt="clone" /></figure>`
    : `<figure><figcaption>Clone</figcaption><p>(no screenshot — capture one by visiting the path in the clone)</p></figure>`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${screen.name} — visual diff</title>
<style>
body { font-family: system-ui, sans-serif; margin: 1.5rem; }
h1 { margin: 0 0 .25rem 0; }
.meta { color: #666; font-size: 0.9rem; margin-bottom: 1rem; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
figure { margin: 0; border: 1px solid #ddd; padding: .5rem; }
figcaption { font-weight: 600; margin-bottom: .25rem; }
img { max-width: 100%; height: auto; }
</style></head>
<body>
<h1>${screen.name}</h1>
<p class="meta">Screen <code>${screen.id}</code> &middot; <code>${screen.url}</code> &middot; type: ${screen.type}</p>
<div class="row">
<figure><figcaption>Original</figcaption><img src="${originalRel}" alt="original" /></figure>
${cloneSection}
</div>
</body></html>
`;
}

export function diffVisual({ chimeraDir, cloneScreenshotsDir }) {
  const screensPath = resolve(chimeraDir, "func-map/screens.json");
  if (!existsSync(screensPath)) {
    return { status: "failed", error: "func-map/screens.json missing" };
  }
  const { screens } = JSON.parse(readFileSync(screensPath, "utf-8"));
  const outDir = resolve(chimeraDir, "audit/visual-diffs");
  mkdirSync(outDir, { recursive: true });

  let generated = 0;
  for (const screen of screens) {
    const originalPath = resolve(chimeraDir, "pages", screen.id, "screenshot.png");
    if (!existsSync(originalPath)) continue;
    const name = pascalCase(screen.name) || screen.id;
    const cloneShot = cloneScreenshotsDir
      ? resolve(cloneScreenshotsDir, `${name}.png`)
      : null;
    const cloneRel = cloneShot && existsSync(cloneShot)
      ? relative(outDir, cloneShot)
      : null;
    const originalRel = relative(outDir, originalPath);
    const html = htmlFor(screen, originalRel, cloneRel);
    writeFileSync(resolve(outDir, `${name}.html`), html);
    generated++;
  }

  return { status: "done", generated, output_dir: outDir };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  console.log(JSON.stringify(diffVisual(args), null, 2));
}
