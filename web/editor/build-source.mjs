#!/usr/bin/env node
import { build } from "esbuild";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const outHtml = resolve(root, "dist/source-viewer.html");
const PAGE_CSS = `
:root {
  --blink-source-color-scheme: dark;
  color-scheme: var(--blink-source-color-scheme);
  --blink-font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
  --blink-mono-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, monospace;
  --blink-source-font-size: 12px;
  --blink-source-line-height: 1.62;
  --blink-text: rgba(235, 241, 251, 0.88);
  --blink-text-strong: rgba(255, 255, 255, 0.96);
  --blink-text-muted: rgba(197, 210, 232, 0.48);
  --blink-accent: #9fc0f7;
  --blink-code-bg: rgba(255, 255, 255, 0.07);
  --blink-selection: rgba(122, 166, 238, 0.26);
  --blink-source-anchor: rgba(89, 137, 211, 0.16);
  --blink-source-match: rgba(214, 174, 91, 0.24);
  --blink-source-panel: rgba(12, 17, 28, 0.96);
  --blink-source-rule: rgba(255, 255, 255, 0.12);
  --blink-source-keyword: #8db8ff;
  --blink-source-type: #7fd7d0;
  --blink-source-function: #d8b5ff;
  --blink-source-string: #9bd49b;
  --blink-source-literal: #e7bd86;
  --blink-source-meta: #b8c7df;
}
* { box-sizing: border-box; }
html, body, #source { width: 100%; height: 100%; margin: 0; overflow: hidden; }
html, body { background: transparent; }
#source, .cm-editor, .cm-scroller, .cm-content, .cm-gutters { background: transparent !important; }
.cm-editor { height: 100%; }
`;

async function main() {
  const result = await build({
    entryPoints: [resolve(root, "src/source-main.ts")],
    bundle: true,
    write: false,
    minify: true,
    format: "iife",
    platform: "browser",
    target: ["safari17"],
  });
  const js = result.outputFiles[0].text;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${PAGE_CSS}</style></head>
<body><main id="source" aria-label="Read-only source file"></main><script>${js}</script></body></html>`;

  if (/contentChanged|saveRequested|getContent/.test(html)) {
    throw new Error("Source viewer contains a mutating editor bridge capability");
  }
  for (const required of ["readOnly", "editable", "lineNumbers", "setDocument", "showFind"]) {
    if (!html.includes(required)) throw new Error(`Source viewer is missing ${required}`);
  }
  await mkdir(dirname(outHtml), { recursive: true });
  await writeFile(outHtml, html, "utf8");
  const { size } = await stat(outHtml);
  if (size > 1.5 * 1024 * 1024) throw new Error("source-viewer.html exceeds 1.5 MB");
  console.log(`[BLINK] Wrote ${outHtml} (${(size / 1024).toFixed(1)} KB, self-contained, read-only)`);
}

main().catch((error) => { console.error(error); process.exit(1); });
