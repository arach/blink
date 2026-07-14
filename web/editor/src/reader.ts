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

  constructor(element: HTMLElement) {
    this.element = element;
  }

  /** Render `source` into the reader element (or a placeholder if empty). */
  render(source: string): void {
    if (isEmptyDoc(source)) {
      this.element.innerHTML =
        '<div class="blink-reader-empty">Empty note — double-click to write.</div>';
      return;
    }
    this.element.innerHTML = renderMarkdown(source);
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
