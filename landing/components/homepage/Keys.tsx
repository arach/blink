import { SectionHeader, Chord, Reveal } from './shared'

const KEYS: { action: string; keys: string[]; scope: 'global' | 'panel' }[] = [
  { action: 'new note, anywhere', keys: ['⌃', '⌥', '⇧', '⌘', 'N'], scope: 'global' },
  { action: 'blink all notes', keys: ['⌃', '⌥', '⇧', '⌘', 'B'], scope: 'global' },
  { action: 'grid overlay', keys: ['⌃', '⌥', '⇧', '⌘', 'C'], scope: 'global' },
  { action: 'flip read / edit', keys: ['⌘', '⇧', 'P'], scope: 'panel' },
  { action: 'close panel', keys: ['⌘', 'W'], scope: 'panel' },
]

export default function Keys() {
  return (
    <section id="keys" className="scroll-mt-16 py-20 md:py-28 border-t border-linex">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <SectionHeader
          tag="KEYS"
          title={
            <>
              Everything is <span className="text-acc">a keystroke away</span>.
            </>
          }
          sub={
            <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span>Hyper is</span>
              <Chord keys={['⌃', '⌥', '⇧', '⌘']} />
              <span>— a modifier no app already owns. Every binding is rewritable in config.json.</span>
            </span>
          }
        />

        <Reveal className="border border-linex rounded-[8px] bg-panelx overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_5.5rem_auto] gap-6 border-b border-linex bg-panel2x px-4 py-2.5 text-[10px] tracking-[0.14em] uppercase text-faintx">
            <span>action</span>
            <span>scope</span>
            <span className="text-right">chord</span>
          </div>
          {KEYS.map((r) => (
            <div
              key={r.action}
              className="grid grid-cols-1 sm:grid-cols-[1fr_5.5rem_auto] items-center gap-2 sm:gap-6 border-b border-[rgba(var(--line-rgb),0.55)] last:border-b-0 px-4 py-3.5 transition-colors hover:bg-[rgba(var(--acc-rgb),0.03)]"
            >
              <div className="text-[13px] text-[var(--text)]">{r.action}</div>
              <div>
                <span className="inline-flex items-center rounded-[3px] border border-linex px-1.5 py-[2px] text-[9px] tracking-[0.12em] uppercase text-faintx">
                  {r.scope}
                </span>
              </div>
              <div className="sm:justify-self-end">
                <Chord keys={r.keys} />
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
