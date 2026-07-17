import { SectionHeader } from './shared'

/* ------------------------------- spec strip ------------------------------- */

const SPECS = [
  { k: 'hotkeys', v: 'carbon', d: 'global chords, no accessibility grant' },
  { k: 'runtime', v: 'native', d: 'Swift + AppKit, zero Electron' },
  { k: 'format', v: '.md', d: 'yaml frontmatter, utf-8' },
  { k: 'identity', v: 'uuidv5', d: 'deterministic identity from slug' },
  { k: 'sync', v: 'live', d: 'external edits reconcile in place' },
  { k: 'cloud', v: 'none', d: 'no account, notes stay local' },
]

export function SpecStrip() {
  return (
    <section className="border-y border-linex bg-[rgba(var(--bg-rgb),0.6)]">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {SPECS.map((s, i) => (
            <div
              key={s.k}
              className={`px-4 py-5 ${i !== 0 ? 'border-l border-[rgba(var(--line-rgb),0.7)]' : ''} ${
                i >= 2 ? 'max-lg:border-t max-lg:border-[rgba(var(--line-rgb),0.7)]' : ''
              } ${i === 2 || i === 4 ? 'max-lg:border-l-0' : ''} ${i === 3 ? 'max-lg:border-l' : ''}`}
            >
              <div className="text-[9px] tracking-[0.16em] text-faintx uppercase">{s.k}</div>
              <div className="mt-1.5 text-[17px] font-bold text-acc">{s.v}</div>
              <div className="mt-1 text-[10px] leading-snug text-dimx">{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------- architecture ------------------------------- */

const LAYERS = [
  {
    layer: 'window',
    tech: 'NSPanel + NSVisualEffectView',
    note: 'borderless, non-activating HUD glass; floats above workspaces without stealing focus',
  },
  {
    layer: 'hotkeys',
    tech: 'Carbon RegisterEventHotKey',
    note: 'three chords reachable from any app; hyper = ⌃⌥⇧⌘, every binding rewritable',
  },
  {
    layer: 'editor',
    tech: 'CodeMirror 6 — no react',
    note: 'a lean web view inside the native shell; flip read ⇄ edit in place, scroll preserved',
  },
  {
    layer: 'render',
    tech: 'marked (GFM)',
    note: 'github-flavored markdown, tables and [[wiki-links]] included',
  },
  {
    layer: 'storage',
    tech: 'frontmatter md · atomic writes',
    note: 'write tmp → rename; a note is never half-written, saved before create() returns',
  },
  {
    layer: 'watch',
    tech: 'directory watch + reconcile',
    note: 'directory watcher merges outside edits live — they type themselves in, caret included',
  },
]

function Diagram() {
  const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h })
  const boxes = {
    hotkey: box(20, 18, 200, 44),
    panel: box(150, 96, 260, 54),
    webview: box(150, 182, 260, 54),
    store: box(150, 268, 260, 62),
    cli: box(20, 268, 110, 62),
  }
  const stroke = '#2c2c32'
  const acc = '#f0b45a'
  const dim = '#8e8e96'
  const faint = '#5a5a62'

  const Rect = ({ b, title, sub, accent = false }: { b: { x: number; y: number; w: number; h: number }; title: string; sub: string; accent?: boolean }) => (
    <g>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill="#0f0f11" stroke={accent ? 'rgba(var(--acc-rgb),0.55)' : stroke} strokeWidth={1} />
      <text x={b.x + 12} y={b.y + 21} fill={accent ? acc : '#d8d8dc'} fontSize={11} fontWeight={700} fontFamily="JetBrains Mono, monospace">
        {title}
      </text>
      <text x={b.x + 12} y={b.y + 38} fill={dim} fontSize={9} fontFamily="JetBrains Mono, monospace">
        {sub}
      </text>
    </g>
  )

  const Arrow = ({ x1, y1, x2, y2, label, dashed = false }: { x1: number; y1: number; x2: number; y2: number; label?: string; dashed?: boolean }) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={acc} strokeOpacity={0.5} strokeWidth={1} strokeDasharray={dashed ? '3 3' : undefined} markerEnd="url(#arr)" />
      {label && (
        <text x={(x1 + x2) / 2 + 8} y={(y1 + y2) / 2 + 3} fill={faint} fontSize={8.5} fontFamily="JetBrains Mono, monospace">
          {label}
        </text>
      )}
    </g>
  )

  return (
    <svg viewBox="0 0 470 356" className="w-full h-auto">
      <defs>
        <marker id="arr" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={acc} fillOpacity={0.7} />
        </marker>
      </defs>

      <Rect b={boxes.hotkey} title="⌃⌥⇧⌘ — global chords" sub="from any application" />
      <Rect b={boxes.panel} title="NSPanel · AppKit shell" sub="borderless glass · menubar resident" accent />
      <Rect b={boxes.webview} title="WKWebView → CodeMirror 6" sub="edit ⇄ marked (GFM) render" />
      <Rect b={boxes.store} title="~/…/Blink/Notes/*.md" sub="frontmatter · atomic write → rename" accent />
      <Rect b={boxes.cli} title="blink CLI" sub="agents · scripts" />

      <Arrow x1={220} y1={62} x2={260} y2={94} label="spawn panel" />
      <Arrow x1={280} y1={150} x2={280} y2={180} label="native bridge" />
      <Arrow x1={280} y1={236} x2={280} y2={266} />
      <Arrow x1={150} y1={299} x2={132} y2={299} label="" />
      <Arrow x1={75} y1={266} x2={150} y2={250} label="" dashed />
      <text x={26} y={252} fill={faint} fontSize={8.5} fontFamily="JetBrains Mono, monospace">
        read / write
      </text>
      <text x={272} y={254} fill={faint} fontSize={8.5} fontFamily="JetBrains Mono, monospace" textAnchor="end">
        atomic write
      </text>
      <text x={290} y={254} fill={faint} fontSize={8.5} fontFamily="JetBrains Mono, monospace">
        ↑ fs events reconcile
      </text>
    </svg>
  )
}

export function Architecture() {
  return (
    <section id="architecture" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          index="01"
          tag="ARCHITECTURE"
          title={
            <>
              Native bones, <span className="text-acc">web typography</span>.
            </>
          }
          sub="No Electron shell around a web app — an AppKit panel hosting exactly one web view, writing exactly one file format. Every layer is replaceable because the filesystem is the contract."
        />

        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14 items-start">
          {/* layer table */}
          <div className="border border-linex rounded-[8px] overflow-hidden bg-panelx">
            <div className="grid grid-cols-[86px_1fr] gap-0 border-b border-linex bg-panel2x px-4 py-2.5 text-[10px] tracking-[0.14em] text-faintx uppercase">
              <span>layer</span>
              <span>implementation</span>
            </div>
            {LAYERS.map((l) => (
              <div
                key={l.layer}
                className="group grid grid-cols-[86px_1fr] gap-0 border-b border-[rgba(var(--line-rgb),0.55)] last:border-b-0 px-4 py-3.5 transition-colors hover:bg-[rgba(var(--acc-rgb),0.03)]"
              >
                <span className="text-[11px] font-bold text-acc pt-[1px]">{l.layer}</span>
                <div>
                  <div className="text-[12.5px] font-semibold text-[var(--text)]">{l.tech}</div>
                  <div className="mt-1 text-[11px] leading-[1.65] text-dimx">{l.note}</div>
                </div>
              </div>
            ))}
          </div>

          {/* diagram */}
          <div className="border border-linex rounded-[8px] bg-panelx p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between text-[10px] text-faintx">
              <span className="tracking-[0.14em] uppercase">fig. 2 — data flow</span>
              <span className="text-acc">swift · appkit</span>
            </div>
            <Diagram />
            <p className="mt-3 text-[11px] leading-[1.7] text-faintx">
              One process, one folder. The CLI and any agent tooling hit the same markdown store the
              panels render — directory changes flow back through the same reconciliation path.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
