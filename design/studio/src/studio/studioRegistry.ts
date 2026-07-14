import { defineStudio, type StudioPage } from "studio/registry";

/**
 * Blink v2 studio registry.
 *
 * Buckets follow the recommended split:
 * - foundations — North Star, locked decisions, the v1 spec (scope contract)
 * - plans      — the build plan and the design pass it came from
 * - studies    — live UI studies for the v2.0 triad surfaces
 */

export type Bucket = "foundations" | "plans" | "studies";
export type Surface = "vision" | "doc" | "macos";
export type Status = "locked" | "study" | "open";

export type BlinkStudioPage = StudioPage<Bucket, Surface, Status>;

export const HOME_HREF = "/studio";

export const pages: readonly BlinkStudioPage[] = [
  {
    href: HOME_HREF,
    label: "North Star",
    bucket: "foundations",
    surface: "vision",
    status: "locked",
    blurb:
      "The note is the window. Blink v2 is triad-only: menubar popover + command palette + floating note panels — native Swift bones, web editor surfaces.",
  },
  {
    href: "/studio/foundations/decisions",
    label: "Decisions & defaults",
    bucket: "foundations",
    surface: "vision",
    status: "locked",
    blurb:
      "Everything locked on 2026-07-14: surface set, repo strategy, spatial feel, overflow story — plus the veto-able defaults.",
    source: ["docs/v2-plan.md"],
  },
  {
    href: "/studio/foundations/functionality-v1",
    label: "v1 spec (scope contract)",
    bucket: "foundations",
    surface: "doc",
    status: "locked",
    blurb:
      "The accurate inventory of everything v1 shipped. v2's guard against rewrite creep — if it's not here or in the plan, it waits.",
    source: ["docs/functionality-v1.md"],
  },
  {
    href: "/studio/plans/v2-plan",
    label: "Build plan (M0–M5)",
    bucket: "plans",
    surface: "doc",
    status: "locked",
    blurb:
      "Architecture, milestones with exit criteria, v1 lessons as hard requirements, risks. The working contract for the Swift build.",
    source: ["docs/v2-plan.md"],
  },
  {
    href: "/studio/plans/ui-map",
    label: "UI map (design pass)",
    bucket: "plans",
    surface: "doc",
    status: "study",
    blurb:
      "The design-studio pass: surface inventory, wireframes, key interactions, principles. Feeds the studies; superseded where decisions moved on.",
    source: ["docs/v2-ui-map.md"],
  },
  {
    href: "/studio/studies/note-panel",
    label: "Floating note panel",
    bucket: "studies",
    surface: "macos",
    status: "study",
    blurb:
      "The atomic unit: a glass NSPanel that is nothing but the note. Chrome earned on hover; shade to a 28px bar.",
  },
  {
    href: "/studio/studies/menubar-popover",
    label: "Menubar popover",
    bucket: "studies",
    surface: "macos",
    status: "study",
    blurb:
      "Home base. One field that searches, creates, and dictates; recents you can fling onto the desktop as panels.",
  },
  {
    href: "/studio/studies/command-palette",
    label: "Command palette",
    bucket: "studies",
    surface: "macos",
    status: "study",
    blurb:
      "⌘K over notes and verbs. ⌘↵ opens the hit as a spatial panel, not just a selection.",
  },
  {
    href: "/studio/studies/grid-overlay",
    label: "Grid overlay HUD",
    bucket: "studies",
    surface: "macos",
    status: "study",
    blurb:
      "Hyper+B: the 3×3 deploy grid made visible — slot occupancy, QWERTY chord keys, teachable spatial placement.",
  },
];

const defined = defineStudio({
  pages,
  surfaceOrder: ["vision", "doc", "macos"],
  defaultSurface: "macos",
  buckets: [
    { key: "foundations" },
    { key: "plans" },
    { key: "studies" },
  ],
  statuses: {
    locked: { tone: "ok", label: "LOCKED" },
    study: { tone: "info", label: "STUDY" },
    open: { tone: "warn", label: "OPEN" },
  },
  // Full human + local-agent iteration loop (annotations, pins, dictation →
  // sidecars under .studio/annotations that terminal agents read back).
  iteration: {},
});

export const {
  registry,
  buckets: BUCKETS,
  statusColors: STATUS_COLORS,
  StatusPill,
  renderStatusPill,
  palette: statusPalette,
  createIterationCommands,
  persistAnnotations,
  annotationsToDecisions,
  createWinnerDecision,
  createTurnDecision,
  getActiveTreatment,
} = defined;
