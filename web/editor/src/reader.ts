import { marked } from "marked";

/**
 * Read-mode renderer for the Blink v2 editor.
 *
 * Turns the current markdown document into rendered HTML typography that sits on
 * the same transparent glass as the editor. This module owns:
 *   - the pure `renderMarkdown` function (markdown source -> HTML string), and
 *   - a `Reader` controller that manages the `.blink-reader` DOM element,
 *     including the empty-note placeholder.
 *
 * SECURITY NOTE: `marked` does NOT sanitize raw HTML embedded in the markdown.
 * Blink notes are the user's own local content (no remote/untrusted input is
 * ever rendered here), so raw HTML is intentionally passed through rather than
 * pulling in a sanitizer dependency. If this surface ever renders third-party
 * content, add DOMPurify (or equivalent) before shipping.
 */

/**
 * Render markdown source to an HTML fragment string.
 *
 * `gfm: true` enables GitHub Flavored Markdown (tables, strikethrough, task
 * lists, autolinks). `async: false` forces a synchronous string return so the
 * caller can inject it directly. `breaks: false` keeps standard markdown
 * paragraph semantics (a single newline is not a hard break).
 */
export function renderMarkdown(source: string): string {
  return marked(source, { gfm: true, async: false, breaks: false });
}

/** True if the document is empty or whitespace-only. */
function isEmptyDoc(source: string): boolean {
  return source.trim().length === 0;
}

/**
 * Controller around the `.blink-reader` element. It renders the document, shows
 * a placeholder for empty notes, and exposes hide/show plus proportional
 * scroll helpers used when flipping between modes.
 */
export class Reader {
  readonly element: HTMLElement;
  private typeOnBase: string | null = null;
  private typeOnText = "";
  private typeOnTextElement: HTMLSpanElement | null = null;
  private typeOnCaretElement: HTMLSpanElement | null = null;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  /** Render `source` into the reader element (or a placeholder if empty). */
  render(source: string): void {
    this.typeOnBase = null;
    this.typeOnText = "";
    this.typeOnTextElement = null;
    this.typeOnCaretElement = null;
    this.renderSettled(source);
  }

  /**
   * Render for a mode flip without disturbing an active typed reveal. The
   * reader is kept warm while hidden, but rebuilding here makes a flip that
   * lands between animation frames deterministic (no one-frame flash of the
   * unrevealed suffix).
   */
  renderCurrent(source: string): void {
    if (this.typeOnBase !== null) {
      this.renderTypeOnOverlay();
    } else {
      this.renderSettled(source);
    }
  }

  /** Start read mode's intentionally plain typed overlay after rendered base. */
  beginTypeOn(base: string): void {
    this.typeOnBase = base;
    this.typeOnText = "";
    this.renderTypeOnOverlay();
  }

  /** Update the visible suffix without re-parsing the entire note every frame. */
  updateTypeOn(text: string): void {
    if (this.typeOnBase === null) return;
    this.typeOnText = text;
    if (!this.typeOnTextElement?.isConnected) {
      this.renderTypeOnOverlay();
    } else {
      this.typeOnTextElement.textContent = text;
    }
    if (this.isVisible) {
      this.typeOnCaretElement?.scrollIntoView({ block: "nearest" });
    }
  }

  private renderSettled(source: string): void {
    if (isEmptyDoc(source)) {
      this.element.innerHTML =
        '<div class="blink-reader-empty">Empty note — double-click to write.</div>';
      return;
    }
    this.element.innerHTML = renderMarkdown(source);
  }

  private renderTypeOnOverlay(): void {
    const base = this.typeOnBase ?? "";
    // The overlay is deliberately plain text. Re-running markdown over a large
    // note at 60fps is wasteful and makes incomplete constructs jump around;
    // the fully rendered document replaces this the moment the reveal ends.
    this.element.innerHTML = isEmptyDoc(base) ? "" : renderMarkdown(base);

    const overlay = document.createElement("div");
    overlay.className = "blink-reader-typeon";
    const text = document.createElement("span");
    text.textContent = this.typeOnText;
    const caret = document.createElement("span");
    caret.className = "blink-typeon-caret";
    caret.setAttribute("aria-hidden", "true");
    overlay.append(text, caret);
    this.element.append(overlay);
    this.typeOnTextElement = text;
    this.typeOnCaretElement = caret;
  }

  show(): void {
    this.element.style.display = "block";
  }

  hide(): void {
    this.element.style.display = "none";
  }

  get isVisible(): boolean {
    return this.element.style.display !== "none";
  }

  /**
   * Proportional scroll position in [0, 1]: how far down the scrollable range
   * the reader currently is. Returns 0 when there is nothing to scroll.
   */
  getScrollFraction(): number {
    const max = this.element.scrollHeight - this.element.clientHeight;
    if (max <= 0) return 0;
    return this.element.scrollTop / max;
  }

  /** Restore a proportional scroll position captured from another surface. */
  setScrollFraction(fraction: number): void {
    const max = this.element.scrollHeight - this.element.clientHeight;
    this.element.scrollTop = max > 0 ? Math.round(fraction * max) : 0;
  }
}
