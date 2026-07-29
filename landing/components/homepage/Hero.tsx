import SpatialDemo from './SpatialDemo'
import { Chord, PrimaryButton, GhostButton } from './shared'

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 md:pt-36 pb-16 md:pb-24">
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-5xl px-4 md:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-12 items-start">
          <div className="rise-in rise-1">
            <h1 className="text-balance">
              <span className="block text-[40px] md:text-[48px] font-bold tracking-[-0.03em] leading-[1.05] text-[var(--text)]">
                blink
              </span>
              <span className="mt-3 block text-[19px] md:text-[23px] font-medium tracking-[-0.01em] leading-[1.35] text-dimx">
                spatial notes for your Mac
              </span>
            </h1>

            <p className="mt-6 max-w-md text-[14px] leading-[1.75] text-dimx">
              A menubar app. Press Hyper+N anywhere and a glass note lands on your
              screen —{' '}
              <span className="text-acc">placed in space, remembered there</span>.
              Plain markdown you own. Open to your agents.
            </p>

            <div className="mt-7 space-y-2.5 text-[13px] text-dimx">
              <div className="flex items-center gap-3 flex-wrap">
                <Chord keys={['⌃', '⌥', '⇧', '⌘', 'N']} />
                <span className="text-faintx">new note</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Chord keys={['⌃', '⌥', '⇧', '⌘', 'B']} />
                <span className="text-faintx">blink all panels</span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PrimaryButton href="https://github.com/arach/blink/releases/latest">
                <span className="text-[15px] leading-none" aria-hidden>
                  ↓
                </span>{' '}
                download for macOS
              </PrimaryButton>
              <GhostButton href="https://github.com/arach/blink">
                github <span className="text-faintx" aria-hidden>↗</span>
              </GhostButton>
            </div>

            <p className="mt-5 text-[11px] text-faintx">
              free & open source · macOS 14+ · Apple Silicon
            </p>
          </div>

          <div className="rise-in rise-2">
            <SpatialDemo />
            <p className="mt-3 text-[11px] leading-relaxed text-faintx">
              Panels remember position and size · native NSPanel glass
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
