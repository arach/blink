import { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import type { Transaction } from "@codemirror/state";

/**
 * Native bridge for the Blink v2 editor.
 *
 * Two directions:
 *   JS  -> native : window.webkit.messageHandlers.blink.postMessage(obj)
 *   native -> JS  : window.blink.{ setContent, getContent, focus }
 *
 * The webkit handler is GUARDED so the page runs standalone in a plain browser
 * during development (postMessage becomes a no-op that logs to the console).
 */

/** Messages posted from JS to native. */
export type ReadyMessage = { type: "ready" };
export type ContentChangedMessage = { type: "contentChanged"; text: string };
export type SaveRequestedMessage = { type: "saveRequested" };
export type OutboundMessage =
  | ReadyMessage
  | ContentChangedMessage
  | SaveRequestedMessage;

/** The global object native code calls into. */
export interface BlinkGlobal {
  setContent(text: string): void;
  getContent(): string;
  focus(): void;
}

/** Minimal shape of the WKWebView message handler we depend on. */
interface WebkitMessageHandler {
  postMessage(message: unknown): void;
}
interface WebkitBridge {
  messageHandlers?: {
    blink?: WebkitMessageHandler;
  };
}

declare global {
  interface Window {
    webkit?: WebkitBridge;
    blink?: BlinkGlobal;
  }
}

/**
 * Post a message to the native side. If the webkit handler is absent (running in
 * a normal browser for dev), this is a harmless no-op with a console trace.
 */
export function postToNative(message: OutboundMessage): void {
  const handler = window.webkit?.messageHandlers?.blink;
  if (handler) {
    handler.postMessage(message);
  } else {
    // Standalone/dev mode: no native host. Never throw.
    // eslint-disable-next-line no-console
    console.debug("[BLINK] (no native host) postMessage:", message);
  }
}

/**
 * Marks a dispatched transaction as a programmatic content replacement so the
 * update listener can distinguish it from real user edits. Any transaction
 * carrying this annotation-equivalent user event is treated as non-user.
 *
 * We implement the "don't echo programmatic sets" rule purely via user-event
 * inspection: setContent dispatches with NO user event, so isUserEvent(...) is
 * false for all of them and contentChanged is not posted.
 */
const USER_EDIT_EVENTS = ["input", "delete", "move", "undo", "redo"] as const;

/** True if a transaction represents a user-initiated edit we should report. */
export function isReportableUserEdit(tr: Transaction): boolean {
  return USER_EDIT_EVENTS.some((ev) => tr.isUserEvent(ev));
}

/**
 * Install `window.blink` (native -> JS API) around a live EditorView.
 *
 * setContent:
 *   - replaces the whole document
 *   - dispatches WITHOUT a user event, so the change listener will NOT post
 *     contentChanged (this is the exact stale-feedback loop that corrupted
 *     notes in v1)
 *   - preserves scroll position
 *   - places the cursor at the end ONLY on the very first set
 */
export function installBlinkGlobal(view: EditorView): BlinkGlobal {
  let hasSetOnce = false;

  const api: BlinkGlobal = {
    setContent(text: string): void {
      const current = view.state.doc.toString();
      const firstSet = !hasSetOnce;
      hasSetOnce = true;

      // Preserve scroll position across the replacement.
      const scroller = view.scrollDOM;
      const prevScrollTop = scroller.scrollTop;
      const prevScrollLeft = scroller.scrollLeft;

      if (current === text && !firstSet) {
        // No-op replacement after the first set: nothing to change.
        return;
      }

      const docLength = text.length;
      const selection = firstSet
        ? EditorSelection.cursor(docLength)
        : // Keep the caret in bounds; clamp existing selection to new length.
          view.state.selection.main.head <= docLength
          ? undefined
          : EditorSelection.cursor(docLength);

      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        // Deliberately NO userEvent annotation -> not a reportable edit.
        ...(selection ? { selection } : {}),
        scrollIntoView: false,
      });

      // Restore scroll after the DOM settles.
      scroller.scrollTop = prevScrollTop;
      scroller.scrollLeft = prevScrollLeft;
    },

    getContent(): string {
      return view.state.doc.toString();
    },

    focus(): void {
      view.focus();
    },
  };

  window.blink = api;
  return api;
}
