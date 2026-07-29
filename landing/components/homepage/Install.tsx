import { SectionHeader, PrimaryButton, GhostButton, Reveal } from './shared'
import { BlinkMark } from './BlinkMark'

export function Install() {
  return (
    <section id="install" className="scroll-mt-16 py-20 md:py-28 border-t border-linex">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <SectionHeader
          tag="INSTALL"
          title={
            <>
              Free, open source, <span className="text-acc">and yours</span>.
            </>
          }
          sub="A single native app for macOS. No account — download it, press Hyper+N, and start."
        />

        <Reveal>
          <div className="corner-frame">
            <div className="border border-linex rounded-[8px] bg-panelx overflow-hidden">
          <div className="border-b border-linex bg-panel2x px-4 py-2.5 text-[10px] tracking-[0.14em] uppercase text-faintx">
            release — latest
          </div>
          <div className="flex flex-col gap-6 p-5 md:flex-row md:items-center md:justify-between md:gap-8 md:p-6">
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-[var(--text)]">Blink.dmg</div>
              <div className="mt-1 text-[11px] text-faintx">
                Apple Silicon · macOS 14+ · notarized · no account
              </div>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <PrimaryButton href="https://github.com/arach/blink/releases/latest">
                <span className="text-[15px] leading-none" aria-hidden>
                  ↓
                </span>{' '}
                download for macOS
              </PrimaryButton>
              <GhostButton href="https://github.com/arach/blink">
                source <span className="text-faintx" aria-hidden>↗</span>
              </GhostButton>
            </div>
          </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-linex pb-12 pt-8">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[12px] font-bold text-[var(--text)]">
            <BlinkMark className="h-[16px] w-[16px] text-acc" />
            blink
            <span className="font-normal text-faintx">· spatial notes for your Mac</span>
          </div>
          <div className="flex items-center gap-5 text-[11px] text-dimx">
            <a
              href="https://github.com/arach/blink"
              target="_blank"
              rel="noreferrer"
              className="hover:text-acc transition-colors"
            >
              github
            </a>
            <a
              href="https://github.com/arach/blink/releases/latest"
              target="_blank"
              rel="noreferrer"
              className="hover:text-acc transition-colors"
            >
              releases
            </a>
          </div>
        </div>
        <div className="mt-6 text-[10px] text-[var(--ghost)]">
          JetBrains Mono · no tracking · no cookies
        </div>
      </div>
    </footer>
  )
}
