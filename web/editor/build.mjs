#!/usr/bin/env node
// Build the Blink v2 editor into a single self-contained dist/editor.html.
//
// 1. Bundle src/main.ts with esbuild (iife, minified, no external network deps).
// 2. Emit dist/editor.html from a template with the JS inlined in <script> and
//    the page/document CSS inlined in <style>. Zero external <script src> /
//    <link href> so native code can loadFileURL / loadHTMLString offline.

import { build } from "esbuild";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const distDir = resolve(root, "dist");
const outHtml = resolve(distDir, "editor.html");

/**
 * Document-level CSS. CodeMirror's own view CSS is injected at runtime by the
 * bundle (via StyleModule), so here we only need the page shell: full-viewport,
 * fully transparent, so the native glass panel shows through.
 */
const PAGE_CSS = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100vh;
  background: transparent;
  overflow: hidden;
  /* Prevent the WKWebView from painting an opaque backdrop. */
  -webkit-user-select: text;
}
#editor {
  width: 100%;
  height: 100vh;
  background: transparent;
}
.cm-editor {
  height: 100%;
}
/* Belt-and-suspenders: never let any layer paint an opaque background. */
.cm-editor, .cm-scroller, .cm-content, .cm-gutters {
  background: transparent !important;
}

/* ---------------------------------------------------------------------------
 * Read mode: rendered markdown typography on the same transparent glass.
 * The .blink-reader occupies the full viewport (like #editor), scrolls
 * independently, and paints NO surface of its own. Only edit OR read is
 * displayed at a time (toggled via inline display in main.ts).
 * ------------------------------------------------------------------------- */
.blink-reader {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  background: transparent;
  /* Match the editor content box: 20px horizontal, 16px vertical. */
  padding: 16px 20px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 13.5px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.85);
  -webkit-font-smoothing: antialiased;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.blink-reader > :first-child { margin-top: 0; }
.blink-reader > :last-child { margin-bottom: 0; }

.blink-reader h1,
.blink-reader h2,
.blink-reader h3,
.blink-reader h4,
.blink-reader h5,
.blink-reader h6 {
  font-weight: 600;
  line-height: 1.3;
  margin: 1.4em 0 0.5em;
}
.blink-reader h1 { font-size: 20px; font-weight: 700; color: rgba(255, 255, 255, 0.96); }
.blink-reader h2 { font-size: 17px; font-weight: 650; color: rgba(255, 255, 255, 0.94); }
.blink-reader h3,
.blink-reader h4,
.blink-reader h5,
.blink-reader h6 { font-size: 15px; font-weight: 600; color: rgba(255, 255, 255, 0.92); }

.blink-reader p { margin: 0 0 0.85em; }

.blink-reader a {
  color: rgba(158, 203, 255, 0.9);
  text-decoration: none;
}
.blink-reader a:hover { text-decoration: underline; }

.blink-reader code {
  font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, "Cascadia Code", monospace;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.07);
  border-radius: 3px;
  padding: 1px 4px;
}
.blink-reader pre {
  font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, "Cascadia Code", monospace;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 10px 12px;
  overflow-x: auto;
  margin: 0 0 0.85em;
}
/* Code inside a fence: strip the inline chip styling (pre provides the block). */
.blink-reader pre code {
  background: transparent;
  padding: 0;
  border-radius: 0;
  color: rgba(255, 255, 255, 0.8);
}

.blink-reader blockquote {
  margin: 0 0 0.85em;
  padding: 0.1em 0 0.1em 12px;
  border-left: 2px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.65);
  font-style: italic;
}

.blink-reader ul,
.blink-reader ol {
  margin: 0 0 0.85em;
  padding-left: 1.5em;
}
.blink-reader li { margin: 0.15em 0; }
.blink-reader li::marker { color: rgba(255, 255, 255, 0.45); }

.blink-reader hr {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  margin: 1.4em 0;
}

.blink-reader table {
  border-collapse: collapse;
  margin: 0 0 0.85em;
}
.blink-reader th,
.blink-reader td {
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.blink-reader th {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  text-align: left;
}

.blink-reader img { max-width: 100%; }

.blink-reader strong { font-weight: 650; color: rgba(255, 255, 255, 0.95); }
.blink-reader em { font-style: italic; }
.blink-reader del { color: rgba(255, 255, 255, 0.5); }

/* Empty-note placeholder: centered dim italic, fills the reader viewport. */
.blink-reader-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 16px 20px;
  color: rgba(255, 255, 255, 0.35);
  font-style: italic;
  font-size: 13.5px;
}
`.trim();

function htmlTemplate({ css, js }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<meta name="color-scheme" content="dark" />
<title>Blink Editor</title>
<style>
${css}
</style>
</head>
<body>
<div id="editor"></div>
<div id="reader" class="blink-reader" style="display:none"></div>
<script>
${js}
</script>
</body>
</html>
`;
}

async function main() {
  const result = await build({
    entryPoints: [resolve(root, "src/main.ts")],
    bundle: true,
    format: "iife",
    minify: true,
    sourcemap: false,
    target: ["es2022", "safari16"],
    platform: "browser",
    legalComments: "none",
    write: false,
    // Keep the bundle in memory; we inline it rather than emit a .js on disk.
    outfile: resolve(distDir, "editor.bundle.js"),
    logLevel: "info",
  });

  const jsFile =
    result.outputFiles.find((f) => f.path.endsWith(".js")) ??
    result.outputFiles[0];
  if (!jsFile) {
    throw new Error("esbuild produced no JS output");
  }
  const js = jsFile.text;

  // Sanity: closing tags inside the inlined JS would break the <script> block.
  if (/<\/script>/i.test(js)) {
    throw new Error("Bundled JS contains a literal </script>; inlining unsafe");
  }

  const html = htmlTemplate({ css: PAGE_CSS, js });

  await mkdir(distDir, { recursive: true });
  await writeFile(outHtml, html, "utf8");

  // Guardrails: no external references, reasonable size.
  if (/<script[^>]+\bsrc=/i.test(html)) {
    throw new Error("Output contains an external <script src>");
  }
  if (/<link[^>]+\bhref=/i.test(html)) {
    throw new Error("Output contains an external <link href>");
  }
  // Read-mode surface must be present: element, styles, and placeholder.
  if (!/id="reader"/.test(html) || !/class="blink-reader"/.test(html)) {
    throw new Error("Output is missing the #reader / .blink-reader element");
  }
  if (!/\.blink-reader\s*\{/.test(html)) {
    throw new Error("Output is missing the .blink-reader typography styles");
  }
  if (!/blink-reader-empty/.test(html)) {
    throw new Error("Output is missing the empty-note placeholder styles");
  }

  const { size } = await stat(outHtml);
  const kb = (size / 1024).toFixed(1);
  const maxBytes = 1.5 * 1024 * 1024;
  if (size > maxBytes) {
    throw new Error(`dist/editor.html is ${kb} KB, over the 1.5 MB budget`);
  }

  console.log(`[BLINK] Wrote ${outHtml} (${kb} KB, self-contained)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
