import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

/**
 * Blink v2 editor theme.
 *
 * Design intent ("the note is the window"): the editor draws NO surface of its
 * own. The native glass NSPanel behind the WKWebView provides the background,
 * blur, and shadow. So html/body and every CodeMirror background layer are fully
 * transparent, and we only paint text, caret, and selection.
 */

const SYSTEM_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO_FONT =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, "Cascadia Code", monospace';

const TEXT = "rgba(255, 255, 255, 0.85)";
const CARET = "#ffffff";
const SELECTION = "rgba(255, 255, 255, 0.18)";

/**
 * Markdown presentation palette.
 *
 * These are the concrete values from the Blink v2 rendering spec. They style the
 * markdown *source* (this is syntax highlighting, not a rendered preview), so the
 * headings/emphasis/etc. tokens are colored and weighted while the `#`, `*`, `>`
 * and backtick markers are dimmed so the prose reads cleanly.
 */
const H1_COLOR = "rgba(255, 255, 255, 0.96)";
const H2_COLOR = "rgba(255, 255, 255, 0.94)";
const H3_COLOR = "rgba(255, 255, 255, 0.92)"; // shared by H3–H6
const MARKER = "rgba(255, 255, 255, 0.35)"; // #, *, _, `, >, list bullets, link brackets
const STRONG_COLOR = "rgba(255, 255, 255, 0.95)";
const EMPHASIS_COLOR = "rgba(255, 255, 255, 0.9)";
const STRIKE_COLOR = "rgba(255, 255, 255, 0.5)";
const CODE_COLOR = "rgba(255, 255, 255, 0.8)";
const CODE_BG = "rgba(255, 255, 255, 0.07)";
const LINK_COLOR = "rgba(158, 203, 255, 0.9)"; // soft blue
const LINK_URL_COLOR = "rgba(158, 203, 255, 0.55)"; // dimmer for the URL part
const QUOTE_COLOR = "rgba(255, 255, 255, 0.6)";
const LIST_COLOR = "rgba(255, 255, 255, 0.45)"; // list content (markers use MARKER)
const RULE_COLOR = "rgba(255, 255, 255, 0.3)";

/** Base view theme: transparent everywhere, system font, generous line height. */
export const blinkTheme: Extension = EditorView.theme(
  {
    "&": {
      color: TEXT,
      backgroundColor: "transparent",
      fontFamily: SYSTEM_FONT,
      fontSize: "13px",
      height: "100%",
    },
    ".cm-scroller": {
      fontFamily: SYSTEM_FONT,
      lineHeight: "1.75",
      // Content padding: 20px horizontal, 16px vertical.
      padding: "16px 20px",
      overflow: "auto",
    },
    ".cm-content": {
      backgroundColor: "transparent",
      caretColor: CARET,
      // padding lives on the scroller; keep content flush.
      padding: "0",
    },
    "&.cm-editor": {
      backgroundColor: "transparent",
      height: "100%",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-line": {
      padding: "0",
    },
    // Caret color for the drawn cursor (drawSelection).
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: CARET,
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: CARET,
    },
    // Selection: works for both native and drawSelection layers.
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: SELECTION,
    },
    ".cm-selectionMatch": {
      backgroundColor: "rgba(255, 255, 255, 0.10)",
    },
    // No gutters at all in v2, but keep them transparent if ever present.
    ".cm-gutters": {
      backgroundColor: "transparent",
      border: "none",
      color: "rgba(255, 255, 255, 0.3)",
    },
    ".cm-activeLine": {
      backgroundColor: "transparent",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
    },
    ".cm-panels": {
      backgroundColor: "transparent",
      color: TEXT,
    },
  },
  { dark: true }
);

/**
 * Markdown syntax highlighting.
 *
 * Tag → construct mapping (from @lezer/markdown's `markdownHighlighting`
 * styleTags; @codemirror/lang-markdown reuses these):
 *
 *   heading1..heading6  ATXHeadingN / SetextHeadingN body text
 *   processingInstruction  ALL formatting markers: HeaderMark (#), EmphasisMark
 *                          (* _), CodeMark (`), QuoteMark (>), ListMark (bullet/
 *                          number), LinkMark ([ ] ( )). One shared tag, so every
 *                          marker gets the same dim treatment (spec asks for the
 *                          same rgba(...,0.35) for all of them).
 *   strong / emphasis / strikethrough   inline styling (marks excluded — they
 *                          are separate processingInstruction nodes)
 *   monospace           InlineCode + fenced/indented CodeText
 *   link                Link/Image body (the visible text)
 *   url                 URL / Autolink (the target)
 *   quote               Blockquote content
 *   list                OrderedList/BulletList content (the LIST MARKER itself is
 *                          processingInstruction, not this tag)
 *   contentSeparator    HorizontalRule (---, ***, ___)
 *
 * A more specific/inner node wins, so a HeaderMark inside a heading is dimmed
 * even though the surrounding heading is bright — exactly what we want.
 */
export const blinkHighlight: Extension = syntaxHighlighting(
  HighlightStyle.define([
    // Headings.
    { tag: t.heading1, color: H1_COLOR, fontWeight: "700", fontSize: "17px" },
    { tag: t.heading2, color: H2_COLOR, fontWeight: "650", fontSize: "15.5px" },
    { tag: t.heading3, color: H3_COLOR, fontWeight: "600", fontSize: "14px" },
    { tag: t.heading4, color: H3_COLOR, fontWeight: "600", fontSize: "14px" },
    { tag: t.heading5, color: H3_COLOR, fontWeight: "600", fontSize: "14px" },
    { tag: t.heading6, color: H3_COLOR, fontWeight: "600", fontSize: "14px" },
    // Generic heading fallback (Setext bodies not covered above).
    { tag: t.heading, color: H3_COLOR, fontWeight: "600" },

    // Formatting markers (#, *, _, `, >, list bullets, link brackets) — dimmed.
    // Reset weight/size to base so a marker inside a heading stays small & light.
    {
      tag: t.processingInstruction,
      color: MARKER,
      fontWeight: "normal",
      fontSize: "13px",
    },

    // Inline emphasis.
    { tag: t.strong, color: STRONG_COLOR, fontWeight: "650" },
    { tag: t.emphasis, color: EMPHASIS_COLOR, fontStyle: "italic" },
    { tag: t.strikethrough, color: STRIKE_COLOR, textDecoration: "line-through" },

    // Code — inline and block. HighlightStyle spans support background/padding,
    // so inline code gets a subtle chip; the mono font + size apply to blocks too.
    {
      tag: t.monospace,
      color: CODE_COLOR,
      fontFamily: MONO_FONT,
      fontSize: "12px",
      background: CODE_BG,
      borderRadius: "3px",
      padding: "1px 3px",
    },

    // Links: soft blue, no underline; the URL/target part dimmer.
    { tag: t.link, color: LINK_COLOR, textDecoration: "none" },
    { tag: t.url, color: LINK_URL_COLOR, textDecoration: "none" },

    // Blockquote content.
    { tag: t.quote, color: QUOTE_COLOR, fontStyle: "italic" },

    // List content (markers are handled by processingInstruction above).
    { tag: t.list, color: LIST_COLOR },

    // Horizontal rule.
    { tag: t.contentSeparator, color: RULE_COLOR },
  ])
);

export const blinkEditorTheme: Extension = [blinkTheme, blinkHighlight];
