"use client";

import React, { type ReactNode } from "react";
import { AppWindow, ArrowRight, Command, FileText, Grid3x3, MenuSquare } from "lucide-react";
import {
  AnnotatableDoc,
  annotationsToDecisions,
  DataRow,
  EngDocSheet,
  persistAnnotations,
} from "studio/doc";
import type { StudioHudsonRenderContext } from "studio/app-shell";
import { useStudioRouter } from "studio/router";
import { CommandPaletteStudy } from "@/studio/studies/CommandPaletteStudy";
import { EditorModesStudy } from "@/studio/studies/EditorModesStudy";
import { GridOverlayStudy } from "@/studio/studies/GridOverlayStudy";
import { MenubarPopoverStudy } from "@/studio/studies/MenubarPopoverStudy";
import { NotePanelStudy } from "@/studio/studies/NotePanelStudy";
import { SettingsStudy } from "@/studio/studies/SettingsStudy";
import {
  HOME_HREF,
  pages,
  registry,
  type BlinkStudioPage,
  type Bucket,
  type Status,
  type Surface,
} from "@/studio/studioRegistry";

type RenderContext = StudioHudsonRenderContext<Bucket, Surface, Status>;

/** Doc pages render the real files from blink/docs via /api/docs. */
const DOC_PAGES: Record<string, string> = {
  "/studio/foundations/functionality-v1": "functionality-v1",
  "/studio/plans/v2-plan": "v2-plan",
  "/studio/plans/ui-map": "ui-map",
};

type Study = {
  component: () => React.JSX.Element;
  intent: string;
  specs: Array<[string, string]>;
  open: string[];
};

const STUDIES: Record<string, Study> = {
  "/studio/studies/note-panel": {
    component: NotePanelStudy,
    intent:
      "The note is the window. At rest a panel is glass and text — no sidebar, no toolbar. The footer (word count, save state, edit/preview, dictate) appears on hover and recedes otherwise. Middle-click the title bar to shade down to the 28px bar.",
    specs: [
      ["window class", "NSPanel · nonactivating · HudVisualEffectView glass"],
      ["title bar", "28px · drag region · auto-title (first line) · save pip"],
      ["editor", "WKWebView · CodeMirror 6 · no gutters · word wrap"],
      ["footer", "hover-revealed · words · save state · ✎/preview · 🎙"],
      ["persistence", "geometry + shade per note · restore exact on relaunch"],
    ],
    open: [
      "Does the resting panel keep the traffic lights, or do those also fade until hover?",
      "Shade interaction: middle-click vs double-click the title bar (or both)?",
    ],
  },
  "/studio/studies/menubar-popover": {
    component: MenubarPopoverStudy,
    intent:
      "Home base. Capture in under a second: one field does search, create (⌘↵), and dictation. Recents open as panels — hover a row for ⤢ to fling it onto the desktop. Footer is palette + settings only: triad-only means no Library entry.",
    specs: [
      ["anchor", "NSStatusItem (eye glyph) + NSPopover, transient"],
      ["field", "type = search · ⌘↵ = new note · 🎙 = dictate into new note"],
      ["recents", "last ~6 notes · click = open panel (reuse if open) · ⤢ = place"],
      ["identity", "one panel per note — opening an open note focuses it"],
      ["footer", "⌘K palette · ⚙ settings (no Library — triad-only)"],
    ],
    open: [
      "Row click: open panel at remembered position vs near the menubar?",
      "Does drag-out of a recent row (drag-to-detach) start from the popover in v2.0, or M3+?",
    ],
  },
  "/studio/studies/command-palette": {
    component: CommandPaletteStudy,
    intent:
      "One input to reach any note or verb — and the palette is spatial: ⌘↵ opens the hit as a floating panel at its remembered spot. This is also the overflow story: with free placement and no Library, the palette is where the long tail of notes lives.",
    specs: [
      ["invoke", "⌘K in-app · Hyper+K global (tbd)"],
      ["groups", "Notes (fuzzy over titles + content) · Actions (verb registry)"],
      ["keys", "↵ open · ⌘↵ open as panel · ⌘⇧P toggle preview"],
      ["kit", "HudsonShell command palette · Blink action registry"],
    ],
    open: [
      "Global palette hotkey: reuse ⌘K only in-app, or claim a Hyper chord system-wide?",
      "Should 'Deploy note → grid slot…' chain directly into the grid overlay?",
    ],
  },
  "/studio/studies/grid-overlay": {
    component: GridOverlayStudy,
    intent:
      "Make spatial legible. v1's grid deploys were invisible muscle memory; Hyper+B shows the 3×3 grid with slot occupancy and QWERTY chord keys, so a new user can see the system a power user feels. Free placement stays the default — the grid is opt-in per action.",
    specs: [
      ["invoke", "Hyper+B (deploy mode) · Ctrl⌥⇧1–9 direct"],
      ["layout", "3×3 · QWERTY row mapping (Q W E / A S D / Z X C)"],
      ["overlay", "transparent HUD NSPanel · dims desktop · Esc cancels"],
      ["occupancy", "slots show resident note · deploy to occupied slot swaps focus"],
    ],
    open: [
      "Multi-display: one grid per screen, or grid follows the active screen?",
      "Should slots be resizable regions (thirds/halves) later, or stay fixed 3×3?",
    ],
  },
  "/studio/studies/editor-modes": {
    component: EditorModesStudy,
    intent:
      "Reading is the rest state of a note on your desktop; the flip must feel like turning a card, not opening an app. Read mode is rendered typography on the same glass, edit mode is the source — same webview, same panel, just the other face.",
    specs: [
      ["flip", "⌘⇧P both ways · double-click read→edit"],
      ["renderer", "marked (GFM) in the same webview · same transparent glass"],
      ["persistence", "per-note mode remembered · new notes always open in edit"],
      ["scroll", "preserved proportionally across flips"],
    ],
    open: [
      "Auto-flip to read when a panel loses focus?",
      "Should double-click place the caret at the clicked paragraph?",
      "Syntax highlighting inside read-mode code blocks?",
    ],
  },
  "/studio/studies/settings": {
    component: SettingsStudy,
    intent:
      "Settings restraint is a core v2 principle: every knob must justify existing. A small native window — not a panel — with three sections capped to one screen. The good-default rule kills most rows before they are drawn.",
    specs: [
      ["window", "small native window · not a panel · ⌘, / gear in popover"],
      ["storage", "UserDefaults — no config file until sharing matters"],
      ["sections", "General · Editor · Shortcuts — hard cap one screen"],
      ["non-settings", "debounce, glass material, panel sizes: good defaults, no knobs"],
    ],
    open: [
      "Launch at login in v2.0 or later?",
      "Config file (portable/dotfile-able) vs UserDefaults?",
      "Should shortcuts be rebindable and when?",
    ],
  },
};

export function renderStudioPage({ pathname, page }: RenderContext) {
  if (pathname === HOME_HREF) return <HomePage />;
  if (page?.href === "/studio/foundations/decisions") {
    return <DecisionsPage page={page} />;
  }
  if (page && DOC_PAGES[page.href]) {
    return <DocPage page={page} docId={DOC_PAGES[page.href]} />;
  }
  if (page && STUDIES[page.href]) {
    return <StudyPage page={page} study={STUDIES[page.href]} />;
  }
  return <NotFoundPage />;
}

function HomePage() {
  const { Link } = useStudioRouter();
  const studyPages = pages.filter((p) => p.bucket === "studies");
  const docPages = pages.filter(
    (p) => p.bucket !== "studies" && p.href !== HOME_HREF,
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      <header className="grid gap-8 border-b border-studio-rule pb-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-eyebrow text-studio-ink-faint">
            blink / v2 studio
          </div>
          <h1 className="mt-4 max-w-[760px] text-[44px] font-medium leading-tight text-studio-ink-strong">
            The note is the window.
          </h1>
          <p
            className="mt-5 max-w-[64ch] text-[15px] leading-[1.7] text-studio-ink"
            style={{ fontFamily: "var(--studio-font-serif)" }}
          >
            Blink v2 is a from-scratch rewrite: native Swift/AppKit bones on
            HudsonKit, web editor surfaces in WKWebViews. Triad-only — a menubar
            popover for capture, a command palette for reach, and floating glass
            panels as the notes themselves. No main window; the desktop is the
            workspace.
          </p>
        </div>

        <EngDocSheet className="self-start">
          <DataRow label="bones">Swift / AppKit + HudsonKit</DataRow>
          <DataRow label="editor">CodeMirror 6 in WKWebView</DataRow>
          <DataRow label="surfaces">popover · palette · panels</DataRow>
          <DataRow label="milestones">M0–M5</DataRow>
          <DataRow label="donor">Scout (hotkeys, menubar)</DataRow>
        </EngDocSheet>
      </header>

      <section className="grid gap-8 py-8 lg:grid-cols-[1fr_320px]">
        <div>
          <SectionHeading icon={<AppWindow size={14} />} title="UI Studies" />
          <ul className="mt-4 divide-y divide-studio-rule border-y border-studio-rule">
            {studyPages.map((entry) => (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  className="group grid gap-3 py-4 transition-colors hover:bg-studio-chip-bg md:grid-cols-[32px_1fr_20px]"
                >
                  <span className="self-center text-studio-ink-faint">
                    {studyIcon(entry.href)}
                  </span>
                  <span>
                    <span className="block text-[15px] font-medium text-studio-ink-strong">
                      {entry.label}
                    </span>
                    <span className="mt-1 block text-[12.5px] leading-relaxed text-studio-ink-faint">
                      {entry.blurb}
                    </span>
                  </span>
                  <ArrowRight
                    size={15}
                    className="self-center text-studio-ink-faint transition-transform group-hover:translate-x-1"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <aside>
          <SectionHeading icon={<FileText size={14} />} title="Foundations & Plans" />
          <div className="mt-4 border-y border-studio-rule">
            {docPages.map((entry) => (
              <Link
                key={entry.href}
                href={entry.href}
                className="block border-b border-studio-rule py-4 last:border-b-0 hover:bg-studio-chip-bg"
              >
                <span className="block text-[14px] font-medium text-studio-ink-strong">
                  {entry.label}
                </span>
                <span className="mt-1 block text-[12.5px] leading-relaxed text-studio-ink-faint">
                  {entry.blurb}
                </span>
              </Link>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function studyIcon(href: string) {
  if (href.endsWith("menubar-popover")) return <MenuSquare size={16} />;
  if (href.endsWith("command-palette")) return <Command size={16} />;
  if (href.endsWith("grid-overlay")) return <Grid3x3 size={16} />;
  return <AppWindow size={16} />;
}

function StudyPage({ page, study }: { page: BlinkStudioPage; study: Study }) {
  const Scene = study.component;
  return (
    <main className="w-full px-6 py-10 lg:px-7">
      <PageHeader page={page} />
      <section className="max-w-[1060px] py-8">
        <Scene />

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            <SectionHeading icon={<FileText size={13} />} title="Design intent" />
            <p
              className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.75] text-studio-ink"
              style={{ fontFamily: "var(--studio-font-serif)" }}
            >
              {study.intent}
            </p>

            {study.open.length > 0 && (
              <>
                <div className="mt-8">
                  <SectionHeading
                    icon={<ArrowRight size={13} />}
                    title="Open questions"
                  />
                </div>
                <ul className="mt-3 space-y-2">
                  {study.open.map((q) => (
                    <li
                      key={q}
                      className="text-[13px] leading-relaxed text-studio-ink-faint"
                    >
                      — {q}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <EngDocSheet className="self-start">
            {study.specs.map(([label, value]) => (
              <DataRow key={label} label={label} labelWidth={104}>
                {value}
              </DataRow>
            ))}
          </EngDocSheet>
        </div>
      </section>
    </main>
  );
}

function DecisionsPage({ page }: { page: BlinkStudioPage }) {
  const decisions: Array<[string, string]> = [
    [
      "New codebase",
      "v1 (Tauri) is a donor of lessons and spec, not code. v2 is Swift/AppKit + WKWebView on HudsonKit.",
    ],
    [
      "Triad only",
      "Menubar popover + command palette + floating panels. No Library window at v2.0 — add later only if genuinely missed.",
    ],
    [
      "One repo, v1 archived",
      "v2 lives at the root of arach/blink; v1 (Tauri) under archive/v1, tag v1-final. Hudson via source path dep on ../hudson (Scout convention); HotkeyManager + status-item patterns transplanted from Scout.",
    ],
    [
      "Free placement",
      "Panels go exactly where you put them. The 3×3 grid is opt-in via Hyper+B. No magnetic snapping.",
    ],
    [
      "Palette is the overflow",
      "Only opened notes are panels; the long tail lives in recents + palette search. 'Gather panels' command in polish.",
    ],
  ];

  const defaults: Array<[string, string]> = [
    ["one panel per note", "opening an open note focuses it — duplicates impossible by construction"],
    ["dictation target", "focused panel's caret; if none, a new capture panel. Audio kept until transcript committed"],
    ["app presence", "LSUIElement menubar-only, no dock icon"],
    ["editor bundle", "vanilla CodeMirror 6, no React — chrome is native now"],
    ["repo", "arach/blink root — v1 archived at archive/v1 (tag v1-final)"],
  ];

  return (
    <main className="w-full px-6 py-10 lg:px-7">
      <PageHeader page={page} />
      <section className="max-w-[860px] py-8">
        <SectionHeading icon={<FileText size={13} />} title="Locked 2026-07-14" />
        <ul className="mt-4 divide-y divide-studio-rule border-y border-studio-rule">
          {decisions.map(([label, body]) => (
            <li key={label} className="grid gap-2 py-4 md:grid-cols-[220px_1fr]">
              <span className="text-[14px] font-medium text-studio-ink-strong">
                {label}
              </span>
              <span className="text-[13px] leading-relaxed text-studio-ink-faint">
                {body}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <SectionHeading
            icon={<ArrowRight size={13} />}
            title="Defaults — veto anytime"
          />
        </div>
        <div className="mt-4 max-w-[720px]">
          <EngDocSheet className="w-full">
            {defaults.map(([label, value]) => (
              <DataRow key={label} label={label} labelWidth={150}>
                {value}
              </DataRow>
            ))}
          </EngDocSheet>
        </div>

        <p className="mt-8 max-w-[62ch] text-[13px] leading-relaxed text-studio-ink-faint">
          Hard requirements inherited from v1's bugs: flush saves on
          note-switch/panel-close, atomic file writes (temp + fsync + rename),
          metadata lives in the markdown file, sync is bidirectional from day
          one, and spatial memory is never scrambled.
        </p>
      </section>
    </main>
  );
}

function DocPage({ page, docId }: { page: BlinkStudioPage; docId: string }) {
  const [body, setBody] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/docs/${docId}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.ok) setBody(json.body);
        else setError(json.error ?? "failed to load doc");
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const slugKey = page.href.replace(/^\//, "").replace(/\//g, "-");

  const handleAnnotationsChange = React.useCallback(
    async (anns: unknown[]) => {
      const decisions = annotationsToDecisions
        ? annotationsToDecisions(page.href, anns as never)
        : [];
      await persistAnnotations({
        persistKey: page.href,
        slug: page.href,
        annotations: anns as never,
        decisions,
      });
    },
    [page.href],
  );

  return (
    <main className="w-full px-6 py-10 lg:px-7">
      <PageHeader page={page} />
      <section className="max-w-[980px] py-8">
        {error && (
          <div className="rounded border border-studio-rule bg-studio-canvas p-3 text-sm text-studio-ink-faint">
            Could not load <code>docs/{docId}.md</code>: {error}
          </div>
        )}
        {!error && body === null && (
          <div className="text-sm italic text-studio-ink-faint">Loading…</div>
        )}
        {body !== null && (
          <>
            <AnnotatableDoc
              body={body}
              slug={slugKey}
              docTitle={page.label}
              persistKey={page.href}
              onAnnotationsChange={handleAnnotationsChange}
            />
            <p className="mt-6 text-[11px] leading-relaxed text-studio-ink-faint">
              Annotate blocks or selections (🎤 for dictation, ★ to pin).
              Everything persists to{" "}
              <code>.studio/annotations/</code> sidecars — terminal agents read
              them back directly. Source of truth: <code>blink/docs/{docId}.md</code>.
            </p>
          </>
        )}
      </section>
    </main>
  );
}

function PageHeader({ page }: { page: BlinkStudioPage }) {
  return (
    <header className="max-w-[1060px] border-b border-studio-rule pb-7">
      <div className="font-mono text-[10px] uppercase tracking-eyebrow text-studio-ink-faint">
        {registry.bucketLabel(page.bucket)} /{" "}
        {page.surface ? registry.surfaceLabel(page.surface) : "default"}
      </div>
      <h1 className="mt-4 text-[38px] font-medium leading-tight text-studio-ink-strong">
        {page.label}
      </h1>
      {page.blurb ? (
        <p
          className="mt-4 max-w-[66ch] text-[15px] leading-[1.7] text-studio-ink"
          style={{ fontFamily: "var(--studio-font-serif)" }}
        >
          {page.blurb}
        </p>
      ) : null}
    </header>
  );
}

function SectionHeading({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-eyebrow text-studio-ink-faint">
      {icon}
      {title}
    </div>
  );
}

function NotFoundPage() {
  const { Link } = useStudioRouter();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
      <h1 className="text-[34px] font-medium text-studio-ink-strong">
        Page not found.
      </h1>
      <Link
        href={HOME_HREF}
        className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint hover:text-studio-ink"
      >
        Back to Blink Studio
        <ArrowRight size={13} />
      </Link>
    </main>
  );
}
