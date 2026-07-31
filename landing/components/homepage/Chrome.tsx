import { ThemeSwitcher } from './ThemeSwitcher'
import { BlinkMark } from './BlinkMark'

const LINKS = [
  { href: '#how', label: 'how' },
  { href: '#agents', label: 'agents' },
  { href: '#desk', label: 'desk' },
  { href: '#keys', label: 'keys' },
  { href: '#install', label: 'install' },
]

export function TopBar() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-linex bg-[rgba(var(--bg-rgb),0.82)] backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 md:px-6">
        <a href="#top" className="flex items-center gap-2.5 text-[13px] font-bold text-[var(--text)]">
          <BlinkMark className="h-[18px] w-[18px] text-acc" />
          blink
        </a>

        <nav className="hidden sm:flex items-center gap-5" aria-label="Page">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[11px] text-dimx hover:text-acc transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <a
            href="https://github.com/arach/blink"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-[5px] border border-line2x bg-panelx px-3 text-[11px] text-dimx hover:text-[var(--text)] hover:border-[var(--line-2)] hover:bg-panel2x transition-colors"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            github
          </a>
        </div>
      </div>
    </header>
  )
}
