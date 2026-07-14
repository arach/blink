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
/* ---------------------------------------------------------------------------
 * Runtime theme variables. Every visual value in BOTH the reader typography
 * (below) and the CM6 editor theme (src/theme.ts) resolves to one of these
 * custom properties. Defaults equal the original hard-coded values.
 *
 * Native code themes the surface at runtime via window.blink.setTheme({...}),
 * which does document.documentElement.style.setProperty(key, value) per entry
 * (keys arrive as full var names, e.g. "--blink-font-size": "14px"), and
 * window.blink.resetTheme(), which strips those inline overrides back to these
 * stylesheet defaults.
 *
 * Heading sizes: --blink-hN-size are the READER sizes (20/17/15). The editor
 * derives its own heading sizes as calc(var(--blink-hN-size) - 3px) in
 * src/theme.ts (-> 17/14/12). Font weights are hard-coded (not themable).
 * ------------------------------------------------------------------------- */
:root {
  color-scheme: dark;

  /* Typography */
  --blink-font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --blink-mono-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, "Cascadia Code", monospace;
  --blink-font-size: 13px;
  --blink-line-height: 1.75;

  /* Content padding */
  --blink-pad-x: 20px;
  --blink-pad-y: 16px;

  /* Text colors */
  --blink-text: rgba(255, 255, 255, 0.85);
  --blink-text-strong: rgba(255, 255, 255, 0.96);
  --blink-text-muted: rgba(255, 255, 255, 0.45);
  --blink-marker: rgba(255, 255, 255, 0.35);

  /* Links */
  --blink-accent: rgba(158, 203, 255, 0.9);
  --blink-accent-dim: rgba(158, 203, 255, 0.55);

  /* Code */
  --blink-code-bg: rgba(255, 255, 255, 0.07);
  --blink-code-text: rgba(255, 255, 255, 0.8);

  /* Caret + selection */
  --blink-caret: #ffffff;
  --blink-selection: rgba(255, 255, 255, 0.18);

  /* Heading sizes (reader; editor derives - 3px) */
  --blink-h1-size: 20px;
  --blink-h2-size: 17px;
  --blink-h3-size: 15px;

  /* Blockquote */
  --blink-quote-text: rgba(255, 255, 255, 0.65);
  --blink-quote-border: rgba(255, 255, 255, 0.2);

  /* Rules + table borders */
  --blink-rule: rgba(255, 255, 255, 0.15);
}
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
  /* Match the editor content box padding. */
  padding: var(--blink-pad-y) var(--blink-pad-x);
  font-family: var(--blink-font-family);
  font-size: var(--blink-font-size);
  line-height: var(--blink-line-height);
  color: var(--blink-text);
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
.blink-reader h1 { font-size: var(--blink-h1-size); font-weight: 700; color: var(--blink-text-strong); }
.blink-reader h2 { font-size: var(--blink-h2-size); font-weight: 650; color: var(--blink-text-strong); }
.blink-reader h3,
.blink-reader h4,
.blink-reader h5,
.blink-reader h6 { font-size: var(--blink-h3-size); font-weight: 600; color: var(--blink-text-strong); }

.blink-reader p { margin: 0 0 0.85em; }

.blink-reader a {
  color: var(--blink-accent);
  text-decoration: none;
}
.blink-reader a:hover { text-decoration: underline; }

.blink-reader code {
  font-family: var(--blink-mono-family);
  font-size: 12px;
  color: var(--blink-code-text);
  background: var(--blink-code-bg);
  border-radius: 3px;
  padding: 1px 4px;
}
.blink-reader pre {
  font-family: var(--blink-mono-family);
  font-size: 12px;
  background: var(--blink-code-bg);
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
  color: var(--blink-code-text);
}

.blink-reader blockquote {
  margin: 0 0 0.85em;
  padding: 0.1em 0 0.1em 12px;
  border-left: 2px solid var(--blink-quote-border);
  color: var(--blink-quote-text);
  font-style: italic;
}

.blink-reader ul,
.blink-reader ol {
  margin: 0 0 0.85em;
  padding-left: 1.5em;
}
.blink-reader li { margin: 0.15em 0; }
.blink-reader li::marker { color: var(--blink-text-muted); }

.blink-reader hr {
  border: none;
  border-top: 1px solid var(--blink-rule);
  margin: 1.4em 0;
}

.blink-reader table {
  border-collapse: collapse;
  margin: 0 0 0.85em;
}
.blink-reader th,
.blink-reader td {
  padding: 4px 8px;
  border: 1px solid var(--blink-rule);
}
.blink-reader th {
  font-weight: 600;
  color: var(--blink-text-strong);
  text-align: left;
}

.blink-reader img { max-width: 100%; }

.blink-reader strong { font-weight: 650; color: var(--blink-text-strong); }
.blink-reader em { font-style: italic; }
.blink-reader del { color: var(--blink-text-muted); }

/* Empty-note placeholder: centered dim italic, fills the reader viewport. */
.blink-reader-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--blink-pad-y) var(--blink-pad-x);
  color: var(--blink-marker);
  font-style: italic;
  font-size: var(--blink-font-size);
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

  // Theming guardrails. The runtime theme contract is load-bearing (native code
  // is being built against exactly this), so verify the bundle statically.
  //
  // 1. The :root block must declare every themable variable with a default.
  const THEME_VARS = [
    "--blink-font-family",
    "--blink-mono-family",
    "--blink-font-size",
    "--blink-line-height",
    "--blink-pad-x",
    "--blink-pad-y",
    "--blink-text",
    "--blink-text-strong",
    "--blink-text-muted",
    "--blink-marker",
    "--blink-accent",
    "--blink-accent-dim",
    "--blink-code-bg",
    "--blink-code-text",
    "--blink-caret",
    "--blink-selection",
    "--blink-h1-size",
    "--blink-h2-size",
    "--blink-h3-size",
    "--blink-quote-text",
    "--blink-quote-border",
    "--blink-rule",
  ];
  const rootMatch = html.match(/:root\s*\{([^}]*)\}/);
  if (!rootMatch) {
    throw new Error("Output is missing the :root theme-variable block");
  }
  const rootBlock = rootMatch[1];
  const missing = THEME_VARS.filter(
    (v) => !new RegExp(`${v}\\s*:`).test(rootBlock)
  );
  if (missing.length > 0) {
    throw new Error(
      `:root is missing theme variable defaults: ${missing.join(", ")}`
    );
  }

  // 2. No raw accent color literal may remain outside the :root defaults —
  //    every consumer must reference var(--blink-accent[-dim]).
  const outsideRoot =
    html.slice(0, rootMatch.index) +
    html.slice(rootMatch.index + rootMatch[0].length);
  if (/rgba\(158,\s*203,\s*255/.test(outsideRoot)) {
    throw new Error(
      "Raw rgba(158,203,255,…) accent color found outside the :root defaults"
    );
  }

  // 3. The setTheme / resetTheme native API must exist on window.blink.
  if (!/setTheme/.test(html) || !/resetTheme/.test(html)) {
    throw new Error("Bundle is missing window.blink.setTheme / resetTheme");
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
