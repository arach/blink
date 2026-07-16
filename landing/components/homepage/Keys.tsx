import { SectionHeader, Chord } from './shared'

const GLOBAL: { action: string; keys: string[]; note: string }[] = [
  { action: 'new note, anywhere', keys: ['⌃', '⌥', '⇧', '⌘', 'N'], note: 'panel spawns on the active space' },
  { action: 'blink — all notes / none', keys: ['⌃', '⌥', '⇧', '⌘', 'B'], note: 'clear the screen, recall on repeat' },
  { action: 'grid overlay', keys: ['⌃', '⌥', '⇧', '⌘', 'C'], note: 'every panel, tiled for a survey' },
]

const PANEL: { action: string; keys: string[]; note: string }[] = [
  { action: 'flip read / edit', keys: ['⌘', '⇧', 'P'], note: 'in place, scroll position preserved' },
  { action: 'focus — quiet everything else', keys: ['⌘', '.'], note: 'dims all other panels' },
  { action: 'step down — leave edit, drop focus', keys: ['⎋'], note: 'one level per press' },
  { action: 'close panel', keys: ['⌘', 'W'], note: 'file stays; the panel goes' },
]

function KeyTable({ title, rows }: { title: string; rows: typeof GLOBAL }) {
  return (
    <div className="border border-linex rounded-[8px] bg-panelx overflow-hidden">
      <div className="border-b border-linex bg-panel2x px-4 py-2.5 text-[10px] tracking-[0.16em] uppercase text-faintx">
        {title}
      </div>
      <div>
        {rows.map((r) => (
          <div
            key={r.action}
            className="group flex items-center justify-between gap-4 border-b border-[rgba(var(--line-rgb),0.55)] last:border-b-0 px-4 py-4 transition-colors hover:bg-[rgba(var(--acc-rgb),0.03)]"
          >
            <div>
              <div className="text-[12.5px] font-semibold text-[var(--text)]">{r.action}</div>
              <div className="mt-0.5 text-[10.5px] text-faintx">{r.note}</div>
            </div>
            <Chord keys={r.keys} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Keys() {
  return (
    <section id="keys" className="py-20 md:py-28 border-t border-linex">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          index="05"
          tag="KEYBOARD INTERFACE"
          title={
            <>
              Everything is <span className="text-acc">a keystroke away</span>.
            </>
          }
          sub="Three global chords reach Blink from any app; the rest act on the panel you're in. Hyper is ⌃⌥⇧⌘ — a modifier no app already owns. Every binding is rewritable in config.json."
        />

        <div className="grid gap-6 lg:grid-cols-2 items-start">
          <KeyTable title="global — from any application" rows={GLOBAL} />
          <KeyTable title="in a panel" rows={PANEL} />
        </div>

        <div className="mt-6 border border-linex rounded-[7px] bg-panelx px-4 py-3.5 flex flex-wrap items-center gap-x-8 gap-y-2 text-[11px] text-dimx">
          <span>
            <span className="text-acc">hyper</span> = <Chord keys={['⌃', '⌥', '⇧', '⌘']} />
          </span>
          <span className="text-faintx">remap: "hotkeys": {`{ "newNote": "cmd+shift+j" }`}</span>
          <span className="text-faintx">no accessibility permissions required</span>
        </div>
      </div>
    </section>
  )
}
