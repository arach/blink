import { useEffect, useState } from 'react'
import { SectionHeader, Reveal } from './shared'

type SheetId = 'glass' | 'card' | 'dotted' | 'bracket' | 'marginalia'

const SHEETS: { id: SheetId; name: string; desc: string }[] = [
  { id: 'glass', name: 'glass', desc: 'HUD blur — the default.' },
  { id: 'card', name: 'card', desc: 'Opaque paper, solid anywhere.' },
  { id: 'dotted', name: 'dotted', desc: 'Notebook margin dots.' },
  { id: 'bracket', name: 'bracket', desc: 'Corner ticks, nothing else.' },
  { id: 'marginalia', name: 'marginalia', desc: 'Ruled left margin.' },
]

function NoteBody({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-[3px]' : 'space-y-[6px]'}>
      <div className={`${compact ? 'text-[10px]' : 'text-[15px]'} font-bold text-[#eceaef]`}>
        Weekly review
      </div>
      <div className={`${compact ? 'text-[8.5px]' : 'text-[11.5px]'} text-[#b6b6bf]`}>Ship v2 · port the palette</div>
      <div className={`${compact ? 'text-[8.5px]' : 'text-[11.5px]'} leading-[1.6] text-[#8d8d97]`}>
        Notes land where you{' '}
        <span className="underline decoration-[rgba(var(--acc-rgb),0.5)] underline-offset-2">leave them</span>.
        <br />
        see <span className="text-[var(--acc)]">[[roadmap]]</span>
      </div>
    </div>
  )
}

function SheetSurface({ id, compact = false }: { id: SheetId; compact?: boolean }) {
  const pad = compact ? 'p-2.5' : 'p-5 md:p-6'

  if (id === 'glass') {
    return (
      <div className={`relative h-full w-full overflow-hidden ${compact ? 'rounded-[5px]' : 'rounded-[10px]'}`}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #2a2824 0%, #1a1a1c 50%, #242428 100%)' }}>
          <div className="absolute h-24 w-24 rounded-full bg-[rgba(255,255,255,0.08)] blur-2xl" style={{ left: '10%', top: '55%' }} />
          <div className="absolute h-20 w-20 rounded-full bg-[rgba(255,255,255,0.05)] blur-2xl" style={{ right: '8%', top: '12%' }} />
        </div>
        <div className={`relative h-full glass-note ${pad}`} style={{ borderRadius: 'inherit' }}>
          <NoteBody compact={compact} />
        </div>
      </div>
    )
  }
  if (id === 'card') {
    return (
      <div
        className={`h-full w-full border border-line2x ${pad}`}
        style={{ background: '#141416', borderRadius: compact ? 5 : 10, boxShadow: '0 14px 30px rgba(0,0,0,0.5)' }}
      >
        <NoteBody compact={compact} />
      </div>
    )
  }
  if (id === 'dotted') {
    return (
      <div
        className={`h-full w-full border border-linex ${pad}`}
        style={{
          background: '#0d0d0f',
          backgroundImage: 'radial-gradient(rgba(150,150,158,0.35) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          borderRadius: compact ? 5 : 10,
        }}
      >
        <NoteBody compact={compact} />
      </div>
    )
  }
  if (id === 'bracket') {
    const c = compact ? 'h-[7px] w-[7px]' : 'h-[12px] w-[12px]'
    return (
      <div className={`relative h-full w-full ${pad}`} style={{ background: 'transparent' }}>
        <span className={`absolute left-0 top-0 ${c} border-l border-t border-[var(--acc)]`} />
        <span className={`absolute right-0 top-0 ${c} border-r border-t border-[var(--acc)]`} />
        <span className={`absolute bottom-0 left-0 ${c} border-b border-l border-[var(--acc)]`} />
        <span className={`absolute bottom-0 right-0 ${c} border-b border-r border-[var(--acc)]`} />
        <NoteBody compact={compact} />
      </div>
    )
  }
  return (
    <div
      className={`relative h-full w-full border border-linex ${compact ? 'rounded-[5px] pl-[26px] pr-2.5 py-2.5' : 'rounded-[10px] pl-[52px] pr-5 py-5'}`}
      style={{ background: '#0d0d0f' }}
    >
      <span
        className="absolute"
        style={{
          left: compact ? 18 : 38,
          top: compact ? 6 : 10,
          bottom: compact ? 6 : 10,
          width: 1,
          background: 'rgba(var(--acc-rgb),0.45)',
        }}
      />
      <NoteBody compact={compact} />
    </div>
  )
}

export default function Sheets() {
  const [active, setActive] = useState<SheetId>('glass')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (touched) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    const t = setInterval(() => {
      setActive((a) => {
        const i = SHEETS.findIndex((s) => s.id === a)
        return SHEETS[(i + 1) % SHEETS.length].id
      })
    }, 3800)
    return () => clearInterval(t)
  }, [touched])

  const current = SHEETS.find((s) => s.id === active)!

  return (
    <section id="sheets" className="scroll-mt-16 py-20 md:py-28 border-t border-linex">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <SectionHeader
          tag="SHEETS"
          title={
            <>
              Every note is its <span className="text-acc">own surface</span>.
            </>
          }
          sub="Five render sheets, per note or as default. One key in config — hot-applied to every open panel."
        />

        <Reveal className="grid gap-8 lg:grid-cols-[minmax(0,14rem)_1fr] lg:gap-10 items-start">
          <div
            className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 lg:mx-0 lg:px-0 lg:flex-col lg:overflow-visible lg:pb-0 lg:gap-1"
            role="tablist"
            aria-label="Sheet styles"
          >
            {SHEETS.map((s) => {
              const on = active === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    setActive(s.id)
                    setTouched(true)
                  }}
                  className={`shrink-0 text-left rounded-[6px] border px-3.5 py-2.5 transition-colors ${
                    on
                      ? 'border-[rgba(var(--acc-rgb),0.45)] bg-[rgba(var(--acc-rgb),0.05)]'
                      : 'border-linex bg-panelx hover:border-line2x lg:border-transparent lg:bg-transparent lg:hover:border-linex'
                  }`}
                >
                  <span className={`text-[13px] font-bold ${on ? 'text-acc' : 'text-[var(--text)]'}`}>
                    {s.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-dimx whitespace-nowrap lg:whitespace-normal">
                    {s.desc}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="border border-linex rounded-[8px] bg-panelx overflow-hidden min-w-0">
            <div className="flex items-center justify-between border-b border-linex bg-panel2x px-4 py-2.5 text-[10px] text-faintx">
              <span>preview</span>
              <span className="text-acc">sheet: {current.name}</span>
            </div>
            <div className="demo-desktop h-[220px] md:h-[260px] p-5 md:p-7">
              <div className="mx-auto h-full max-w-[560px]">
                <div key={active} className="sheet-swap h-full">
                  <SheetSurface id={active} />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
