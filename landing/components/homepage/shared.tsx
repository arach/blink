import type { ReactNode } from 'react'

/* ---------------------------------- kbd ---------------------------------- */

export function Kbd({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <span
      className={[
        'kbd inline-flex items-center justify-center h-[22px] rounded-[5px] px-[7px] text-[11px] leading-none',
        wide ? 'min-w-[34px]' : 'min-w-[22px]',
      ].join(' ')}
    >
      {children}
    </span>
  )
}

export function Chord({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-[4px]">
      {keys.map((k, i) => (
        <Kbd key={i} wide={k.length > 1}>
          {k}
        </Kbd>
      ))}
    </span>
  )
}

/* ------------------------------ section header ---------------------------- */

export function SectionHeader({
  index,
  tag,
  title,
  sub,
}: {
  index: string
  tag: string
  title: ReactNode
  sub?: ReactNode
}) {
  return (
    <div className="mb-12 md:mb-16">
      <div className="label-x mb-5 flex items-center gap-3">
        <span className="text-acc">{'//'}</span>
        <span>
          {index} — {tag}
        </span>
        <span className="h-px flex-1 bg-[var(--line)]" />
        <span className="hidden sm:inline text-[var(--ghost)]">blink(1)</span>
      </div>
      <h2 className="text-[26px] md:text-[38px] font-bold leading-[1.12] tracking-[-0.02em] text-[var(--text)] max-w-3xl">
        {title}
      </h2>
      {sub && (
        <p className="mt-4 max-w-2xl text-[13px] md:text-[14px] leading-[1.75] text-dimx">{sub}</p>
      )}
    </div>
  )
}

/* --------------------------------- buttons -------------------------------- */

export function PrimaryButton({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex h-11 items-center gap-2.5 rounded-[6px] bg-[var(--acc)] px-5 text-[13px] font-bold text-[var(--on-acc)] transition-all hover:brightness-110 hover:shadow-[0_0_28px_rgba(var(--acc-rgb),0.35)]"
    >
      {children}
    </a>
  )
}

export function GhostButton({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-11 items-center gap-2.5 rounded-[6px] border border-line2x bg-[var(--panel)] px-5 text-[13px] font-medium text-dimx transition-all hover:border-[#3f3f48] hover:text-[var(--text)]"
    >
      {children}
    </a>
  )
}

/* ------------------------------- misc chips ------------------------------- */

export function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'acc' | 'amber' }) {
  const tones = {
    default: 'border-line2x text-dimx',
    acc: 'border-[rgba(var(--acc-rgb),0.35)] text-acc bg-[var(--acc-soft)]',
    amber: 'border-[rgba(255,195,95,0.35)] text-amberx bg-[rgba(255,195,95,0.08)]',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-[3px] text-[11px] ${tones[tone]}`}>
      {children}
    </span>
  )
}
