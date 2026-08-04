import { EditorState, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  drawSelection,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import {
  highlightSelectionMatches,
  openSearchPanel,
  search,
  searchKeymap,
} from "@codemirror/search";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { sourceLanguage } from "./source-languages";
import { blinkSourceTheme } from "./source-theme";

type SourcePayload = {
  text: string;
  language: string;
  lineStart?: number | null;
  lineEnd?: number | null;
};

type SourceGlobal = {
  setDocument(payload: SourcePayload): void;
  setTheme(vars: Record<string, string>): void;
  focus(): void;
  showFind(): void;
};

declare global {
  interface Window {
    blinkSource?: SourceGlobal;
  }
}

function postReady(): void {
  const host = window as unknown as {
    webkit?: { messageHandlers?: { blinkSource?: { postMessage(message: unknown): void } } };
  };
  host.webkit?.messageHandlers?.blinkSource?.postMessage({ type: "ready" });
}

function anchorExtension(start?: number | null, end?: number | null): Extension {
  if (!start || start < 1) return [];
  return EditorView.decorations.compute([], (state) => {
    if (start > state.doc.lines) return Decoration.none;
    const boundedEnd = Math.min(Math.max(end ?? start, start), start + 999);
    const last = Math.min(boundedEnd, state.doc.lines);
    const decorations = [];
    for (let number = start; number <= last; number += 1) {
      decorations.push(Decoration.line({ class: "blink-source-anchor" }).range(state.doc.line(number).from));
    }
    return Decoration.set(decorations);
  });
}

function extensions(payload: SourcePayload): Extension[] {
  return [
    sourceLanguage(payload.language),
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    lineNumbers(),
    highlightActiveLineGutter(),
    drawSelection(),
    search({ top: true }),
    highlightSelectionMatches(),
    anchorExtension(payload.lineStart, payload.lineEnd),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([
      {
        key: "Mod-f",
        preventDefault: true,
        run: openSearchPanel,
      },
      ...searchKeymap,
      ...defaultKeymap,
    ]),
    blinkSourceTheme,
  ];
}

function createState(payload: SourcePayload): EditorState {
  return EditorState.create({ doc: payload.text, extensions: extensions(payload) });
}

function mount(): void {
  const parent = document.getElementById("source");
  if (!parent) throw new Error("[BLINK] #source mount point not found");

  const empty: SourcePayload = { text: "", language: "plaintext" };
  const view = new EditorView({ parent, state: createState(empty) });

  window.blinkSource = {
    setDocument(payload: SourcePayload): void {
      view.setState(createState(payload));
      if (payload.lineStart && payload.lineStart <= view.state.doc.lines) {
        const position = view.state.doc.line(payload.lineStart).from;
        view.dispatch({ effects: EditorView.scrollIntoView(position, { y: "center" }) });
      }
    },
    setTheme(vars: Record<string, string>): void {
      const root = document.documentElement.style;
      for (const [key, value] of Object.entries(vars)) root.setProperty(key, value);
    },
    focus(): void { view.focus(); },
    showFind(): void { openSearchPanel(view); },
  };

  postReady();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
