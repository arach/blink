"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowDown,
  Braces,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  FileCode2,
  LockKeyhole,
  MessageSquareText,
  X,
} from "lucide-react";
import { DesktopScene } from "./DesktopScene";
import styles from "./SpatialCodeReviewStudy.module.css";

/*
THESIS: The Markdown note activates its metadata-declared source companions; the user can hide the arrangement without losing one-click ephemeral inspection.
OWN-WORLD: Blink's desktop, translucent panels, disciplined native chrome, and file-backed Markdown truth remain visible.
STORY: Activating update-ios.md reads blink.companions, lays out three source views, and supplies context to the agent. Code Hidden suppresses the layout; a citation still opens one temporary peek.
FIRST VIEWPORT: The metadata activation trace, note-level Code control, related source bench, and citation-to-peek path read as one system within ten seconds.
FORM: Companion arrival/promotion is the single authored motion. Frontmatter carries portable intent; local state carries visibility and exact geometry. Persistent IDE chrome stays outside Blink.
*/

type Finding = {
  id: string;
  fileId: string;
  line: number;
  range: string;
  title: string;
  body: string;
  state: "clear" | "verify" | "note";
};

type SourceFile = {
  id: string;
  name: string;
  directory: string;
  language: string;
  revision: string;
  lines: Array<{ number: number; text: string }>;
};

const files: SourceFile[] = [
  {
    id: "snapshot",
    name: "BlinkSnapshot.swift",
    directory: "blink / Sources / BlinkCore",
    language: "Swift",
    revision: "76fc2d1",
    lines: [
      { number: 6, text: "public struct BlinkSnapshotNote: Codable, Sendable {" },
      { number: 7, text: "    public var id: String" },
      { number: 8, text: "    public var revision: String" },
      { number: 9, text: "    public var markdown: String" },
      { number: 10, text: "    public var title: String" },
      { number: 11, text: "    public var updatedAt: Date" },
      { number: 12, text: "    public var tags: [String]" },
      { number: 13, text: "    public var pinned: Bool" },
      { number: 14, text: "}" },
      { number: 15, text: "" },
      { number: 16, text: "// Exact payload; frontmatter travels with Markdown." },
      { number: 17, text: "public struct BlinkSnapshot: Codable, Sendable {" },
      { number: 18, text: "    public static let currentVersion = 1" },
      { number: 19, text: "    public var generatedAt: Date" },
      { number: 20, text: "    public var etag: String" },
      { number: 21, text: "    public var notes: [BlinkSnapshotNote]" },
      { number: 22, text: "    public var issues: [BlinkSnapshotIssue]" },
      { number: 23, text: "}" },
    ],
  },
  {
    id: "cache",
    name: "BlinkSnapshotCache.swift",
    directory: "blink / Sources / BlinkCore",
    language: "Swift",
    revision: "76fc2d1",
    lines: [
      { number: 18, text: "/// Incoming snapshots are authoritative except for" },
      { number: 19, text: "/// quarantined IDs whose source bytes were withheld." },
      { number: 20, text: "public actor BlinkSnapshotCache {" },
      { number: 21, text: "    private let fileURL: URL" },
      { number: 22, text: "" },
      { number: 23, text: "    public func apply(_ incoming: BlinkSnapshot) throws" },
      { number: 24, text: "        -> BlinkSnapshot {" },
      { number: 25, text: "        let prior = try load()" },
      { number: 26, text: "        let heldIDs = Set(incoming.issues.compactMap {" },
      { number: 27, text: "            $0.expectedID" },
      { number: 28, text: "        })" },
      { number: 29, text: "" },
      { number: 30, text: "        let heldNotes = prior?.notes.filter {" },
      { number: 31, text: "            heldIDs.contains($0.id)" },
      { number: 32, text: "        } ?? []" },
      { number: 33, text: "        return try persist(incoming, holding: heldNotes)" },
      { number: 34, text: "    }" },
      { number: 35, text: "}" },
    ],
  },
  {
    id: "mobile",
    name: "ContentView.swift",
    directory: "blink / apps / ios / BlinkMobile",
    language: "SwiftUI",
    revision: "76fc2d1",
    lines: [
      { number: 104, text: "private var connectionLine: some View {" },
      { number: 105, text: "    HStack(spacing: 10) {" },
      { number: 106, text: "        Rectangle()" },
      { number: 107, text: "            .fill(theme.signal)" },
      { number: 108, text: "            .frame(width: 8, height: 8)" },
      { number: 109, text: "" },
      { number: 110, text: "        Text(connectionLabel)" },
      { number: 111, text: "            .font(theme.machineFont)" },
      { number: 112, text: "            .foregroundStyle(theme.secondaryInk)" },
      { number: 113, text: "    }" },
      { number: 114, text: "    .accessibilityElement(children: .combine)" },
      { number: 115, text: "}" },
      { number: 116, text: "" },
      { number: 117, text: "private var connectionLabel: String {" },
      { number: 118, text: "    peerName.map { \"Connected · \\($0)\" }" },
      { number: 119, text: "        ?? \"On this iPad\"" },
      { number: 120, text: "}" },
    ],
  },
  {
    id: "bridge",
    name: "WebBridge.swift",
    directory: "blink / Sources / BlinkApp",
    language: "Swift",
    revision: "76fc2d1",
    lines: [
      { number: 27, text: "/// Hosts the renderer and speaks the native bridge." },
      { number: 28, text: "@MainActor" },
      { number: 29, text: "final class RendererWebView: NSObject {" },
      { number: 30, text: "    let webView: WKWebView" },
      { number: 31, text: "    private var isReady = false" },
      { number: 32, text: "    private var pendingContent: String?" },
      { number: 33, text: "" },
      { number: 34, text: "    func setContent(_ text: String) {" },
      { number: 35, text: "        guard isReady else {" },
      { number: 36, text: "            pendingContent = text" },
      { number: 37, text: "            return" },
      { number: 38, text: "        }" },
      { number: 39, text: "        evaluate(\"window.blink.setContent(...)\")" },
      { number: 40, text: "    }" },
      { number: 41, text: "}" },
    ],
  },
];

const findings: Finding[] = [
  {
    id: "wire-identity",
    fileId: "snapshot",
    line: 8,
    range: "L8–9",
    title: "Identity survives transport",
    body: "Revision and complete Markdown already travel together. A cited source should keep the same exact-payload discipline.",
    state: "clear",
  },
  {
    id: "quarantine",
    fileId: "cache",
    line: 26,
    range: "L26–33",
    title: "Keep withheld files visible",
    body: "Quarantine must never read as deletion. Preserve panel geometry and mark the source temporarily unavailable.",
    state: "verify",
  },
  {
    id: "trust-copy",
    fileId: "mobile",
    line: 117,
    range: "L117–120",
    title: "Use state, not narration",
    body: "“On this iPad” is functional. Reserve offline language for an exceptional state that changes what the user can do.",
    state: "note",
  },
  {
    id: "bridge-capability",
    fileId: "bridge",
    line: 34,
    range: "L34–40",
    title: "Split the bridge by capability",
    body: "Reuse loading, theme, and navigation. The source viewer must not register contentChanged or saveRequested, and should expose no mutation method.",
    state: "verify",
  },
];

const positionStyles: CSSProperties[] = [
  { "--home-x": "0%", "--home-y": "0%", "--focus-x": "0%", "--focus-y": "0%" } as CSSProperties,
  { "--home-x": "51.5%", "--home-y": "0%", "--focus-x": "24%", "--focus-y": "0%" } as CSSProperties,
  { "--home-x": "0%", "--home-y": "51.5%", "--focus-x": "0%", "--focus-y": "24%" } as CSSProperties,
  { "--home-x": "51.5%", "--home-y": "51.5%", "--focus-x": "24%", "--focus-y": "24%" } as CSSProperties,
];

const ladderMaterials = ["glass", "card", "dotted", "source"] as const;
type CompanionVisibility = "auto" | "hidden";

export function SpatialCodeReviewStudy() {
  const [activeFileId, setActiveFileId] = useState(files[0].id);
  const [bundleIds, setBundleIds] = useState(() => files.slice(0, 3).map((file) => file.id));
  const [companionVisibility, setCompanionVisibility] = useState<CompanionVisibility>("auto");
  const [peekFileId, setPeekFileId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [fontSize, setFontSize] = useState<11 | 12 | 13>(12);
  const [ladderPalette, setLadderPalette] = useState<"light" | "dark">("dark");
  const peekPanelRef = useRef<HTMLElement | null>(null);
  const peekReturnFocusRef = useRef<HTMLElement | null>(null);
  const bundleFiles = files.filter((file) => bundleIds.includes(file.id));
  const activeIndex = bundleFiles.findIndex((file) => file.id === activeFileId);
  const activeFile = bundleFiles[activeIndex] ?? bundleFiles[0];
  const activeFinding = findings.find((finding) => finding.fileId === activeFile.id) ?? findings[0];
  const peekFile = bundleFiles.find((file) => file.id === peekFileId);
  const displayedFiles = companionVisibility === "auto" ? bundleFiles : peekFile ? [peekFile] : [];

  useEffect(() => {
    if (companionVisibility !== "hidden" || !peekFileId) return;
    window.requestAnimationFrame(() => peekPanelRef.current?.focus());
  }, [companionVisibility, peekFileId]);

  function openPeek(fileId: string, returnFocus?: HTMLElement | null) {
    const file = bundleFiles.find((item) => item.id === fileId);
    peekReturnFocusRef.current = returnFocus
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setActiveFileId(fileId);
    setPeekFileId(fileId);
    if (file) setAnnouncement(`Temporary source view opened: ${file.name}. Press Escape to close.`);
  }

  function closePeek() {
    const fileName = peekFile?.name ?? "source";
    setPeekFileId(null);
    setAnnouncement(`Temporary source view closed: ${fileName}.`);
    window.requestAnimationFrame(() => peekReturnFocusRef.current?.focus());
  }

  function promote(index: number) {
    const file = bundleFiles[index];
    if (!file) return;
    if (companionVisibility === "hidden") {
      openPeek(file.id);
    } else {
      setActiveFileId(file.id);
    }
  }

  function openReference(fileId: string, returnFocus: HTMLElement) {
    if (companionVisibility === "hidden") {
      openPeek(fileId, returnFocus);
    } else {
      setActiveFileId(fileId);
    }
  }

  function toggleCompanions() {
    setCompanionVisibility((current) => current === "auto" ? "hidden" : "auto");
    setPeekFileId(null);
  }

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && peekFileId) {
      event.preventDefault();
      closePeek();
      return;
    }
    if (!event.altKey) return;
    const number = Number(event.key);
    if (number >= 1 && number <= bundleFiles.length) {
      event.preventDefault();
      promote(number - 1);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      promote((activeIndex + delta + bundleFiles.length) % bundleFiles.length);
    }
  }

  function addSuggestedFile(returnFocus: HTMLElement) {
    const suggestion = files[3];
    if (!bundleIds.includes(suggestion.id)) setBundleIds((current) => [...current, suggestion.id]);
    if (companionVisibility === "hidden") {
      peekReturnFocusRef.current = returnFocus;
      setActiveFileId(suggestion.id);
      setPeekFileId(suggestion.id);
      setAnnouncement(`WebBridge.swift added to the note companions and opened as a temporary source view.`);
    } else {
      setActiveFileId(suggestion.id);
    }
  }

  return (
    <div className={styles.study} onKeyDown={handleKeys}>
      <header className={styles.studyHeader}>
        <div>
          <p className={styles.kicker}>Note-driven companions · Opus + owner</p>
          <p className={styles.studyCopy}>
            One Markdown note declares the related source cast; one local control decides whether the desk performs the arrangement.
          </p>
        </div>
        <div className={styles.model} aria-label="Note activation model">
          <MessageSquareText size={15} aria-hidden="true" />
          <span>note.md</span>
          <ChevronRight size={13} aria-hidden="true" />
          <span>frontmatter</span>
          <ChevronRight size={13} aria-hidden="true" />
          <span>{bundleFiles.length} companions</span>
        </div>
      </header>

      <div className={styles.sceneFocus} role="group" tabIndex={0} aria-label="Interactive Review Bench. Option and a number promotes a source; Option up or down steps findings.">
        <div className={styles.srOnly} aria-live="polite" aria-atomic="true">{announcement}</div>
        <DesktopScene menubar height={640}>
          <div className={styles.sceneLabel}>
            <span>ILLUSTRATIVE · NOTE ACTIVATION · LOCAL DESK</span>
            <span>⌥1–4 PROMOTE · ⌥↑↓ STEP ANCHORS</span>
          </div>

          <div className={styles.activationTrace}>
            <Braces size={12} aria-hidden="true" />
            <strong>update-ios.md</strong>
            <ChevronRight size={11} aria-hidden="true" />
            <code>blink.companions · review-bench · {bundleFiles.length} refs</code>
            <span data-mode={companionVisibility}>{companionVisibility === "auto" ? "LAYOUT ACTIVE" : "LAYOUT HIDDEN"}</span>
          </div>

          <section
            className={styles.bench}
            data-mode={companionVisibility === "hidden" && peekFile ? "peek" : companionVisibility}
            aria-label="Source companions for update-ios.md"
          >
            {companionVisibility === "hidden" && !peekFile && (
              <div className={styles.hiddenState}>
                <EyeOff size={16} aria-hidden="true" />
                <strong>Code companions hidden</strong>
                <span>Select any citation in the note to open a temporary view.</span>
              </div>
            )}

            {displayedFiles.map((file) => {
              const index = bundleFiles.findIndex((item) => item.id === file.id);
              const finding = findings.find((item) => item.fileId === file.id)!;
              const active = file.id === activeFileId;
              const isPeek = companionVisibility === "hidden";
              return (
                <article
                  className={styles.sourcePanel}
                  data-active={active}
                  data-ephemeral={isPeek}
                  data-state={finding.state}
                  aria-label={isPeek ? `Temporary source view: ${file.name}` : `Source companion: ${file.name}`}
                  key={file.id}
                  ref={isPeek ? peekPanelRef : undefined}
                  style={positionStyles[index]}
                  tabIndex={isPeek ? -1 : undefined}
                >
                  <header className={styles.sourceHeader}>
                    <button type="button" onClick={() => promote(index)} aria-pressed={active}>
                      <FileCode2 size={14} aria-hidden="true" />
                      <span>
                        <small>{file.directory}</small>
                        <strong>{file.name}</strong>
                      </span>
                    </button>
                    <div className={styles.sourceActions}>
                      <span className={styles.sourceState}>
                        <LockKeyhole size={10} aria-hidden="true" />
                        {isPeek ? "EPHEMERAL PEEK" : active ? "CM6 VIEW" : `⌥${index + 1}`}
                      </span>
                      {isPeek && (
                        <button type="button" className={styles.peekClose} onClick={closePeek} aria-label="Close temporary source view">
                          <X size={11} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </header>

                  <div className={styles.sourceCode} role="region" tabIndex={active ? 0 : -1} aria-label={`${file.name} source`}>
                    {file.lines.map((line) => {
                      const anchor = line.number === finding.line;
                      return (
                        <div className={styles.codeLine} data-anchor={anchor} key={line.number}>
                          <span className={styles.lineNumber}>{line.number}</span>
                          <span className={styles.bandCell}>{anchor && <span className={styles.anchorBand} />}</span>
                          <code>{highlight(line.text)}</code>
                        </div>
                      );
                    })}
                  </div>

                  <footer className={styles.sourceFoot}>
                    <span>{file.language}</span>
                    <span>{finding.range} · {finding.state}</span>
                    <span>{file.revision}</span>
                  </footer>
                  {!active && (
                    <button
                      type="button"
                      className={styles.promoteHandle}
                      onClick={() => promote(index)}
                      aria-label={`Promote ${file.name}`}
                    >
                      ⌥{index + 1}
                    </button>
                  )}
                </article>
              );
            })}
          </section>

          <aside className={styles.reviewNote} aria-label="Agent-authored Markdown review note">
            <header className={styles.noteHeader}>
              <div className={styles.noteIdentity}>
                <MessageSquareText size={14} aria-hidden="true" />
                <strong>update-ios.md</strong>
              </div>
              <div className={styles.noteControls}>
                <button
                  type="button"
                  aria-pressed={companionVisibility === "auto"}
                  aria-label={companionVisibility === "auto" ? "Hide code companions" : "Show code companions automatically"}
                  onClick={toggleCompanions}
                >
                  {companionVisibility === "auto" ? <Eye size={11} aria-hidden="true" /> : <EyeOff size={11} aria-hidden="true" />}
                  <span>CODE {companionVisibility === "auto" ? "AUTO" : "HIDDEN"}</span>
                </button>
              </div>
            </header>

            <div className={styles.noteBody}>
              <h3>Review pass</h3>
              <p>
                The snapshot path is coherent. Keep cited source exact, local, and visibly immutable.
              </p>

              <div className={styles.activeFinding} data-state={activeFinding.state}>
                <div>
                  <span>{activeFinding.state}</span>
                  <code>{activeFile.name}:{activeFinding.range}</code>
                </div>
                <strong>{activeFinding.title}</strong>
                <p>{activeFinding.body}</p>
              </div>

              <h4>Cited paragraphs</h4>
              <ol className={styles.citationList}>
                {bundleFiles.map((file, index) => {
                  const finding = findings.find((item) => item.fileId === file.id)!;
                  return <li key={finding.id} data-active={index === activeIndex}>
                    <button type="button" onClick={(event) => openReference(file.id, event.currentTarget)}>
                      <span>{finding.title}</span>
                      <code>[[src:blink/{file.name}#{finding.range}@{file.revision}]]</code>
                    </button>
                  </li>;
                })}
              </ol>

              <div className={styles.agentPrompt}>
                <div>
                  <span>YOU</span>
                  <code>{bundleFiles.length} files · {activeFinding.range}</code>
                </div>
                <p>What code decides whether this surface can write?</p>
              </div>

              <div className={styles.agentTurn} data-added={bundleIds.includes(files[3].id)}>
                <div>
                  <span>AGENT FOUND</span>
                  <code>from current bundle</code>
                </div>
                <strong>WebBridge.swift</strong>
                <p>The renderer boundary decides whether “read only” is structural or merely a mode.</p>
                <button type="button" onClick={(event) => addSuggestedFile(event.currentTarget)}>
                  {bundleIds.includes(files[3].id) ? <><Check size={11} /> In bundle</> : <>Add relevant file <ArrowDown size={11} /></>}
                </button>
              </div>
            </div>

            <footer className={styles.noteFoot}>
              <span>agent://opus</span>
              <span>{activeIndex + 1} / {bundleFiles.length}</span>
            </footer>
          </aside>
        </DesktopScene>
      </div>

      <section className={styles.metadataContract} aria-labelledby="metadata-contract-title">
        <header>
          <div>
            <p className={styles.kicker}>Activation contract</p>
            <h3 id="metadata-contract-title">The note tells Blink what belongs together.</h3>
          </div>
          <span>Portable intent in Markdown; physical resolution on this device.</span>
        </header>
        <div className={styles.metadataGrid}>
          <pre aria-label="Illustrative Blink companions frontmatter">{`blink:
  companions:
    layout: review-bench
    sources:
      - "blink/BlinkSnapshot.swift#L8-9@76fc2d1"
      - "blink/BlinkSnapshotCache.swift#L26-33@76fc2d1"
      - "blink/ContentView.swift#L117-120@76fc2d1"`}</pre>
          <dl>
            <div>
              <dt>Frontmatter</dt>
              <dd>Small source cast, named roots, revision anchors, preferred arrangement.</dd>
            </div>
            <div>
              <dt>Local state</dt>
              <dd>Code Auto/Hidden, exact frames, z-order, and the current ephemeral peek.</dd>
            </div>
            <div>
              <dt>Agent action</dt>
              <dd>Propose or revise companions; admission writes the durable note metadata.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className={styles.ladder} aria-labelledby="legibility-ladder-title">
        <header className={styles.ladderHeader}>
          <div>
            <p className={styles.kicker}>Pre-implementation gate</p>
            <h3 id="legibility-ladder-title">Legibility ladder</h3>
            <p>Same CodeMirror view, four materials. “Source” must earn its own sheet before the renderer ships.</p>
          </div>
          <div className={styles.ladderControls}>
            <div className={styles.segmented} aria-label="Code size">
              {([11, 12, 13] as const).map((size) => (
                <button type="button" aria-pressed={fontSize === size} key={size} onClick={() => setFontSize(size)}>{size} pt</button>
              ))}
            </div>
            <div className={styles.segmented} aria-label="Code palette">
              {(["light", "dark"] as const).map((palette) => (
                <button type="button" aria-pressed={ladderPalette === palette} key={palette} onClick={() => setLadderPalette(palette)}>{palette}</button>
              ))}
            </div>
          </div>
        </header>

        <div className={styles.ladderGrid}>
          {ladderMaterials.map((material) => (
            <article className={styles.ladderCell} data-material={material} data-palette={ladderPalette} key={material}>
              <header><span>{material}</span><span>{fontSize} pt</span></header>
              <pre style={{ fontSize }}><span className={styles.keyword}>public</span> <span className={styles.keyword}>actor</span> BlinkSnapshotCache {"{"}{"\n"}    <span className={styles.keyword}>let</span> revision = <span className={styles.string}>"76fc2d1"</span>{"\n"}{"}"}</pre>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.engine} aria-labelledby="renderer-contract-title">
        <header>
          <div>
            <p className={styles.kicker}>Rendering engine</p>
            <h3 id="renderer-contract-title">CodeMirror-class, structurally read only</h3>
          </div>
          <span>Reuse the host; specialize the renderer.</span>
        </header>
        <dl>
          <div>
            <dt>Native host</dt>
            <dd>WKWebView lifecycle · transparent material · theme/sheet · deny-by-default navigation · pending-until-ready queue</dd>
          </div>
          <div>
            <dt>CM6 read kernel</dt>
            <dd>EditorState.readOnly + EditorView.editable(false) · selection · search · line numbers · viewport rendering · anchor decorations</dd>
          </div>
          <div>
            <dt>Language adapter</dt>
            <dd>Real parser per declared language; Swift is the first gate. Unsupported source renders honestly as plain text, never counterfeit highlighting.</dd>
          </div>
          <div>
            <dt>Capability wall</dt>
            <dd>ready · open citation · ask agent are allowed. contentChanged · saveRequested · edit history are absent from both JS and native.</dd>
          </div>
        </dl>
      </section>

      <div className={styles.boundary}>
        <span>Frontmatter owns the companion cast.</span>
        <span>Local state owns visibility and frames.</span>
        <span>Citations can always open a temporary peek.</span>
        <span>Agent admission updates the durable note.</span>
      </div>
    </div>
  );
}

function highlight(source: string): ReactNode[] {
  const tokens = source.split(/(\/\/.*$|\/\/\/.*$|"(?:[^"\\]|\\.)*"|\b(?:public|private|struct|actor|var|let|static|func|return|throws|some|nil)\b|\b\d+\b)/g);
  return tokens.map((token, index) => {
    if (!token) return null;
    if (token.startsWith("//")) return <span className={styles.comment} key={index}>{token}</span>;
    if (token.startsWith("\"") && token.endsWith("\"")) return <span className={styles.string} key={index}>{token}</span>;
    if (/^\d+$/.test(token)) return <span className={styles.number} key={index}>{token}</span>;
    if (/^(public|private|struct|actor|var|let|static|func|return|throws|some|nil)$/.test(token)) return <span className={styles.keyword} key={index}>{token}</span>;
    return <span key={index}>{token}</span>;
  });
}
