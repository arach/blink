import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

const sourceViewTheme: Extension = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--blink-text)",
    backgroundColor: "transparent",
    fontFamily: "var(--blink-mono-family)",
    fontSize: "var(--blink-source-font-size)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "var(--blink-mono-family)",
    lineHeight: "var(--blink-source-line-height)",
    padding: "10px 0 22px",
  },
  ".cm-content": {
    padding: "0 18px 0 8px",
    caretColor: "transparent",
  },
  ".cm-line": { padding: "0 4px" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--blink-text-muted)",
    paddingLeft: "10px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    minWidth: "34px",
    padding: "0 9px 0 0",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "transparent" },
  ".blink-source-anchor": {
    backgroundColor: "var(--blink-source-anchor)",
    boxShadow: "inset 2px 0 0 var(--blink-accent)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--blink-selection) !important",
  },
  ".cm-selectionMatch": { backgroundColor: "var(--blink-source-match)" },
  ".cm-panels": {
    backgroundColor: "var(--blink-source-panel)",
    color: "var(--blink-text)",
    borderBottom: "1px solid var(--blink-source-rule)",
  },
  ".cm-search": {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "7px 10px",
    fontFamily: "var(--blink-font-family)",
    fontSize: "11px",
  },
  ".cm-search input": {
    minWidth: "180px",
    color: "var(--blink-text)",
    backgroundColor: "var(--blink-code-bg)",
    border: "1px solid var(--blink-source-rule)",
    borderRadius: "6px",
    padding: "4px 7px",
    outline: "none",
  },
  ".cm-search input:focus": { borderColor: "var(--blink-accent)" },
  ".cm-search button": {
    color: "var(--blink-text-muted)",
    background: "transparent",
    border: "0",
    borderRadius: "5px",
    padding: "4px 6px",
  },
  ".cm-search button:hover": {
    color: "var(--blink-text)",
    backgroundColor: "var(--blink-code-bg)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--blink-source-panel)",
    border: "1px solid var(--blink-source-rule)",
    color: "var(--blink-text)",
  },
}, { dark: true });

const sourceHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword], color: "var(--blink-source-keyword)" },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--blink-source-type)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--blink-source-function)" },
  { tag: [t.string, t.special(t.string)], color: "var(--blink-source-string)" },
  { tag: [t.number, t.bool, t.null], color: "var(--blink-source-literal)" },
  { tag: [t.comment, t.docComment], color: "var(--blink-text-muted)", fontStyle: "italic" },
  { tag: [t.meta, t.processingInstruction], color: "var(--blink-source-meta)" },
  { tag: [t.punctuation, t.bracket], color: "var(--blink-text-muted)" },
  { tag: [t.heading, t.strong], color: "var(--blink-text-strong)", fontWeight: "650" },
  { tag: [t.link, t.url], color: "var(--blink-accent)" },
]));

export const blinkSourceTheme: Extension = [sourceViewTheme, sourceHighlight];
