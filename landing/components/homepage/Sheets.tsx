import { useEffect, useState } from 'react'
import { SectionHeader } from './shared'

type SheetId = 'glass' | 'card' | 'dotted' | 'bracket' | 'marginalia'

const SHEETS: { id: SheetId; name: string; desc: string; spec: string }[] = [
  { id: 'glass', name: 'glass', desc: 'The default — a HUD panel of real macOS blur.', spec: 'NSVisualEffectView · .hudWindow' },
  { id: 'card', name: 'card', desc: 'Opaque paper. No blur — a solid surface that reads anywhere.', spec: 'NSWindow · opaque, +4% radius' },
  { id: 'dotted', name: 'dotted', desc: 'A flat sheet with a dotted margin, like a notebook.', spec: 'flat bg · dot-grid @ 18px pitch' },
  { id: 'bracket', name: 'bracket', desc: 'Corner brackets frame the text and nothing else.', spec: 'borderless · 4× corner ticks' },
  { id: 'marginalia', name: 'marginalia', desc: 'A ruled left margin for annotations in the wild.', spec: 'ruled gutter · 56px margin col' },
]

function NoteBody({ compact = false }: { compact?: boolean }) {
  // Sheets are always dark app surfaces, so this text uses the fixed dark-app
  // palette (never the page-theme tokens) — otherwise it goes dark-on-dark on paper.
  return (
    <div className={compact ? 'space-y-[3px]' : 'space-y-[6px]'}>
      <div className={`${compact ? 'text-[10px]' : 'text-[15px]'} font-bold text-[#eceaef]`}>
        Weekly review
      </div>
      <div className={`${compact ? 'text-[8.5px]' : 'text-[11.5px]'} text-[#b6b6bf]`}>Ship v2 · port the palette</div>
      <div className={`${compact ? 'text-[8.5px]' : 'text-[11.5px]'} leading-[1.6] text-[#8d8d97]`}>
        Notes land where you <span className="underline decoration-[rgba(240,180,90,0.5)] underline-offset-2">leave them</span>.
        <br />
        see <span className="text-[#f0b45a]">[[roadmap]]</span>
      </div>
    </div>
  )
}

function SheetSurface({ id, compact = false }: { id: SheetId; compact?: boolean }) {
  const pad = compact ? 'p-2.5' : 'p-5 md:p-6'

  if (id === 'glass') {
    return (
      <div className={`relative h-full w-full overflow-hidden ${compact ? 'rounded-[5px]' : 'rounded-[10px]'}`}>
        {/* backdrop content to blur */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #3d3423 0%, #1a2330 45%, #2b2436 100%)' }}>
          <div className="absolute h-24 w-24 rounded-full bg-[rgba(var(--acc-rgb),0.25)] blur-2xl" style={{ left: '10%', top: '55%' }} />
          <div className="absolute h-20 w-20 rounded-full bg-[rgba(124,199,232,0.2)] blur-2xl" style={{ right: '8%', top: '12%' }} />
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
    const b = compact ? 'border-[#f0b45a]' : 'border-[#f0b45a]'
    return (
      <div className={`relative h-full w-full ${pad}`} style={{ background: 'transparent' }}>
        <span className={`absolute left-0 top-0 ${c} border-l border-t ${b}`} />
        <span className={`absolute right-0 top-0 ${c} border-r border-t ${b}`} />
        <span className={`absolute bottom-0 left-0 ${c} border-b border-l ${b}`} />
        <span className={`absolute bottom-0 right-0 ${c} border-b border-r ${b}`} />
        <NoteBody compact={compact} />
      </div>
    )
  }
  // marginalia
  return (
    <div
      className={`h-full w-full border border-linex ${compact ? 'rounded-[5px] pl-[26px] pr-2.5 py-2.5' : 'rounded-[10px] pl-[52px] pr-5 py-5'}`}
      style={{
        background: '#0d0d0f',
        backgroundImage: 'linear-gradient(90deg, transparent 0, transparent 100%)',
      }}
    >
      <span
        className="absolute"
        style={{
          left: compact ? 18 : 38,
          top: compact ? 6 : 10,
          bottom: compact ? 6 : 10,
          width: 1,
          background: 'rgba(255,122,110,0.45)',
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
    <section id="sheets" className="py-20 md:py-28 border-t border-linex">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          index="02"
          tag="SHEETS"
          title={
            <>
              Every note is its <span className="text-acc">own surface</span>.
            </>
          }
          sub="Five render sheets, assignable per note or as your default. Set one key in config.json and Blink hot-applies it to every open panel in under a second."
        />

        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-14 items-start">
          {/* selector list */}
          <div className="space-y-2">
            {SHEETS.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setActive(s.id)
                  setTouched(true)
                }}
                className={`w-full text-left rounded-[7px] border px-4 py-3.5 transition-all ${
                  active === s.id
                    ? 'border-[rgba(var(--acc-rgb),0.45)] bg-[rgba(var(--acc-rgb),0.05)]'
                    : 'border-linex bg-panelx hover:border-line2x'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[13px] font-bold ${active === s.id ? 'text-acc' : 'text-[var(--text)]'}`}>
                    {s.name}
                  </span>
                  <span className="text-[10px] text-faintx">{s.spec}</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-[1.6] text-dimx">{s.desc}</p>
              </button>
            ))}
          </div>

          {/* stage */}
          <div>
            <div className="border border-linex rounded-[8px] bg-panelx overflow-hidden">
              <div className="flex items-center justify-between border-b border-linex bg-panel2x px-4 py-2.5 text-[10px] text-faintx">
                <span className="tracking-[0.14em] uppercase">preview — weekly-review.md</span>
                <span className="text-acc">sheet: {current.name}</span>
              </div>
              <div className="h-[240px] md:h-[280px] p-5 md:p-7" style={{ background: 'radial-gradient(ellipse 90% 80% at 50% 20%, rgba(88, 72, 42,0.25), transparent 70%), #0b0b0d' }}>
                <SheetSurface id={active} />
              </div>
              <div className="border-t border-linex bg-[#09090b] px-4 py-3">
                <code className="text-[11px] leading-[1.7]">
                  <span className="text-faintx">{'// hot-applied to all panels <1s'}</span>
                  <br />
                  <span className="text-cyanx">"panel"</span>
                  <span className="text-dimx">: {'{'} </span>
                  <span className="text-cyanx">"sheet"</span>
                  <span className="text-dimx">: </span>
                  <span className="text-amberx">"{current.name}"</span>
                  <span className="text-dimx"> {'}'}</span>
                </code>
              </div>
            </div>
            <div className="mt-3 flex gap-1.5">
              {SHEETS.map((s) => (
                <span
                  key={s.id}
                  className={`h-[3px] flex-1 rounded-full transition-colors ${active === s.id ? 'bg-[var(--acc)]' : 'bg-[var(--line)]'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
