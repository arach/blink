import { SectionHeader, PrimaryButton, GhostButton } from './shared'

const REQS: [string, string][] = [
  ['os', 'macOS 14 (Sonoma) or later'],
  ['arch', 'Apple Silicon'],
  ['app', 'single native bundle'],
  ['runtime', 'menubar resident — no dock icon'],
  ['permissions', 'global hotkeys only'],
  ['network', 'none — no account, no cloud'],
]

export function Install() {
  return (
    <section id="install" className="py-20 md:py-28 border-t border-linex">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          index="06"
          tag="INSTALL"
          title={
            <>
              Free, open source, <span className="text-acc">and yours</span>.
            </>
          }
          sub="A single native app for macOS. No account, no sign-in — download it, press ⌃⌥⇧⌘N, and start."
        />

        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12 items-start">
          <div>
            <div className="border border-linex rounded-[8px] bg-panelx overflow-hidden">
              <div className="border-b border-linex bg-panel2x px-4 py-2.5 text-[10px] tracking-[0.14em] uppercase text-faintx">
                release — latest
              </div>
              <div className="p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[15px] font-bold text-[var(--text)]">Blink.dmg</div>
                    <div className="mt-1 text-[11px] text-faintx">Apple Silicon · notarized</div>
                  </div>
                  <div className="text-right text-[11px] text-dimx">
                    <div>native app</div>
                    <div className="text-faintx">arm64</div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <PrimaryButton href="https://github.com/arach/blink/releases/latest">
                    <span className="text-[15px] leading-none">↓</span> download for macOS
                  </PrimaryButton>
                  <GhostButton href="https://github.com/arach/blink">
                    source on github <span className="text-faintx">↗</span>
                  </GhostButton>
                </div>
                <div className="mt-5 rounded-[6px] border border-linex bg-[#09090b] px-3.5 py-3 text-[11px] leading-[1.8]">
                  <span className="text-faintx"># or from your terminal</span>
                  <br />
                  <span className="text-acc">❯ </span>
                  <span className="text-[var(--text)]">open -a Blink</span>
                  <span className="text-faintx">  # then: ⌃⌥⇧⌘N, anywhere</span>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { k: 'free & open source', v: 'on GitHub' },
                { k: 'native macOS app', v: 'swift + appkit' },
                { k: 'no account', v: 'notes stay local' },
              ].map((c) => (
                <div key={c.k} className="border border-linex rounded-[7px] bg-panelx px-3 py-3 text-center">
                  <div className="text-[11px] font-bold text-[var(--text)]">{c.k}</div>
                  <div className="mt-0.5 text-[10px] text-faintx">{c.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* requirements */}
          <div className="border border-linex rounded-[8px] bg-panelx overflow-hidden">
            <div className="border-b border-linex bg-panel2x px-4 py-2.5 text-[10px] tracking-[0.14em] uppercase text-faintx">
              requirements — blink(1)
            </div>
            <div>
              {REQS.map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-[110px_1fr] border-b border-[rgba(30, 30, 34,0.55)] last:border-b-0 px-4 py-3"
                >
                  <span className="text-[11px] font-bold text-acc">{k}</span>
                  <span className="text-[11.5px] text-dimx">{v}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-linex px-4 py-3 text-[10.5px] leading-[1.7] text-faintx">
              SEE ALSO —{' '}
              <a href="https://github.com/arach/blink" target="_blank" rel="noreferrer" className="text-cyanx hover:underline">
                github.com/arach/blink
              </a>
              {' · '}
              <a
                href="https://github.com/arach/blink/releases/latest"
                target="_blank"
                rel="noreferrer"
                className="text-cyanx hover:underline"
              >
                releases
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-linex pb-16 pt-10">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="text-[12px]">
            <span className="flex items-center gap-2 font-bold text-[var(--text)]">
              <span className="flex h-[16px] w-[16px] items-center justify-center rounded-[4px] border border-[rgba(240, 180, 90,0.5)] text-[9px] text-acc leading-none">
                ▚
              </span>
              blink
            </span>
            <p className="mt-2 text-[11px] text-faintx">spatial notes for your Mac — placed in space, remembered there.</p>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-dimx">
            <a href="https://github.com/arach/blink" target="_blank" rel="noreferrer" className="hover:text-acc transition-colors">
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
            <span className="text-faintx">native · open source</span>
          </div>
        </div>
        <div className="mt-8 border-t border-[rgba(30, 30, 34,0.6)] pt-4 flex flex-wrap justify-between gap-2 text-[10px] text-[#3a3a40]">
          <span>set in JetBrains Mono · no tracking · no cookies</span>
          <span>BLINK(1) · end of manual</span>
        </div>
      </div>
    </footer>
  )
}
