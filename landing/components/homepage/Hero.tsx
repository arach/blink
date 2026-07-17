import SpatialDemo from './SpatialDemo'
import { Chord, PrimaryButton, GhostButton } from './shared'

function ManRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] md:grid-cols-[150px_1fr] gap-3 md:gap-6 py-4 border-b border-[rgba(var(--line-rgb),0.6)] last:border-b-0">
      <div className="text-[11px] font-bold tracking-[0.14em] text-acc pt-[2px]">{term}</div>
      <div className="text-[13px] md:text-[14px] leading-[1.8] text-dimx">{children}</div>
    </div>
  )
}

export default function Hero() {
  return (
    <section id="top" className="relative pt-28 md:pt-36 pb-16 md:pb-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        {/* man page header rule */}
        <div className="rise-in rise-1 flex items-center justify-between border-y border-linex py-2 text-[10px] md:text-[11px] tracking-[0.08em] text-faintx">
          <span className="text-dimx font-semibold">BLINK(1)</span>
          <span className="hidden sm:inline">General Commands Manual</span>
          <span className="text-dimx font-semibold">BLINK(1)</span>
        </div>

        <div className="mt-10 md:mt-14 grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-10 items-start">
          {/* man page body */}
          <div className="rise-in rise-2">
            <ManRow term="NAME">
              <p>
                <span className="text-[var(--text)] font-bold text-[22px] md:text-[30px] tracking-[-0.02em]">
                  blink
                </span>
                <span className="text-faintx"> — </span>
                <span className="text-[var(--text)] text-[17px] md:text-[21px] font-medium">
                  spatial notes for your Mac
                </span>
              </p>
            </ManRow>

            <ManRow term="SYNOPSIS">
              <div className="space-y-2.5">
                <div className="flex items-center gap-4">
                  <Chord keys={['⌃', '⌥', '⇧', '⌘', 'N']} />
                  <span className="text-faintx">→</span>
                  <span>borderless glass note, summoned anywhere</span>
                </div>
                <div className="flex items-center gap-4">
                  <Chord keys={['⌃', '⌥', '⇧', '⌘', 'B']} />
                  <span className="text-faintx">→</span>
                  <span>blink every panel in / out of view</span>
                </div>
                <div className="flex items-center gap-4">
                  <Chord keys={['⌃', '⌥', '⇧', '⌘', 'C']} />
                  <span className="text-faintx">→</span>
                  <span>grid overlay — survey the whole board</span>
                </div>
              </div>
            </ManRow>

            <ManRow term="DESCRIPTION">
              <p>
                A menubar app for macOS. Press <span className="text-[var(--text)]">Hyper+N</span> in any
                application and a note lands on your screen —{' '}
                <span className="text-acc">placed in space, and remembered there</span>. Each panel
                persists its position, size and sheet across launches, so your desk becomes muscle
                memory.
              </p>
              <p className="mt-3">
                Notes are frontmatter markdown files in a folder you own. No account, no sync
                service, no lock-in — and external edits reconcile live, so your agents read and
                write the same files you do.
              </p>
            </ManRow>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PrimaryButton href="https://github.com/arach/blink/releases/latest">
                <span className="text-[15px] leading-none">↓</span> download for macOS
              </PrimaryButton>
              <GhostButton href="https://github.com/arach/blink">
                view on github <span className="text-faintx">↗</span>
              </GhostButton>
            </div>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-faintx">
              <span>
                <span className="text-acc">exit 0</span> · free & open source
              </span>
              <span>os: macOS 14+</span>
              <span>arch: Apple Silicon</span>
            </div>
          </div>

          {/* interactive demo */}
          <div className="rise-in rise-3">
            <SpatialDemo />
            <p className="mt-3 text-[11px] leading-relaxed text-faintx">
              <span className="text-dimx font-semibold">fig. 1</span> — the spatial model, running in
              your browser. Panels remember <span className="text-acc">(x, y, w, h)</span>; the real
              thing renders as native NSPanel glass.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
