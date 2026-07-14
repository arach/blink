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
