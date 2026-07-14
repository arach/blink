import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
} from "@codemirror/view";
import {
  history,
  historyKeymap,
  defaultKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

import { blinkEditorTheme } from "./theme";
import {
  postToNative,
  installBlinkGlobal,
  isReportableUserEdit,
} from "./bridge";

/**
 * Blink v2 editor entry point.
 *
 * Minimal-chrome CodeMirror 6 markdown editor designed to be hosted inside a
 * native macOS NSPanel via WKWebView. NO line-number gutter, NO fold gutter,
 * word wrap ON, transparent surface.
 */

function mount(): void {
  const parent = document.getElementById("editor");
  if (!parent) {
    throw new Error("[BLINK] #editor mount point not found");
  }

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: "",
      extensions: [
        // Language: markdown (GFM base, no gutters requested by design).
        markdown({ base: markdownLanguage }),

        // Word wrap ON — long lines wrap instead of scrolling horizontally.
        EditorView.lineWrapping,

        // Standard history + keymaps (no gutter-related extensions).
        history(),
        drawSelection(),
        dropCursor(),
        rectangularSelection(),
        crosshairCursor(),

        // Fallback syntax highlighting for anything the theme does not cover.
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

        keymap.of([
          // ⌘S / Ctrl-S -> ask native to save; swallow the browser default.
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              postToNative({ type: "saveRequested" });
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),

        // Report ONLY real user edits back to native (never programmatic sets).
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          const isUser = update.transactions.some(isReportableUserEdit);
          if (!isUser) return;
          postToNative({
            type: "contentChanged",
            text: update.state.doc.toString(),
          });
        }),

        // Blink theme: transparent surface, system font, markdown token colors.
        blinkEditorTheme,
      ],
    }),
  });

  // Expose window.blink (native -> JS API) around this view.
  installBlinkGlobal(view);

  // Focus on load, then announce readiness to native.
  view.focus();
  postToNative({ type: "ready" });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
