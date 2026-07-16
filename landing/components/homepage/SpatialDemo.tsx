import { useCallback, useEffect, useRef, useState } from 'react'
import { Chord } from './shared'

interface DemoNote {
  id: number
  x: number
  y: number
  w: number
  title: string
  lines: string[]
  hidden: boolean
  vanishing: boolean
  z: number
}

const SAMPLES: { title: string; lines: string[] }[] = [
  { title: 'standup.md', lines: ['## Fri', '- ship the landing', '- port the palette'] },
  { title: 'roadmap.md', lines: ['## v2.1', '- [[sheets]] per note', '- cli: blink watch'] },
  { title: 'inbox.md', lines: ['- read: NSPanel docs', '- atomic writes, again'] },
  { title: 'scratch.md', lines: ['π ≈ 3.14159', 'hyper = ⌃⌥⇧⌘'] },
  { title: 'reading.md', lines: ['- the unix philosophy', '- codemirror 6 guide'] },
  { title: 'ideas.md', lines: ['- grid snap ±8px', '- sheet: marginalia'] },
]

const NOTE_W = 216
const MAX_NOTES = 6

let uid = 0

export default function SpatialDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const hoverRef = useRef(false)
  const mouseRef = useRef({ x: 120, y: 120 })
  const zRef = useRef(10)
  const [notes, setNotes] = useState<DemoNote[]>([])
  const [grid, setGrid] = useState(false)
  const [allHidden, setAllHidden] = useState(false)
  const [dragInfo, setDragInfo] = useState<{ id: number; x: number; y: number } | null>(null)
  const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null)

  const clamp = useCallback((x: number, y: number) => {
    const el = ref.current
    if (!el) return { x, y }
    const r = el.getBoundingClientRect()
    return {
      x: Math.max(4, Math.min(x, r.width - NOTE_W - 4)),
      y: Math.max(4, Math.min(y, r.height - 150)),
    }
  }, [])

  const spawn = useCallback(
    (x?: number, y?: number) => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const px = x ?? mouseRef.current.x
      const py = y ?? mouseRef.current.y
      const pos = clamp(px - NOTE_W / 2, py - 20)
      setNotes((prev) => {
        const sample = SAMPLES[prev.length % SAMPLES.length]
        const next: DemoNote = {
          id: ++uid,
          x: pos.x,
          y: pos.y,
          w: NOTE_W,
          title: sample.title,
          lines: sample.lines,
          hidden: false,
          vanishing: false,
          z: ++zRef.current,
        }
        const list = [...prev, next]
        return list.length > MAX_NOTES ? list.slice(list.length - MAX_NOTES) : list
      })
      void r
    },
    [clamp],
  )

  /* keyboard: press N while hovering the surface */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hoverRef.current) return
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        spawn()
      }
      if (e.key.toLowerCase() === 'b' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        toggleBlink()
      }
      if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setGrid((g) => !g)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spawn])

  const toggleBlink = useCallback(() => {
    setAllHidden((h) => {
      const target = !h
      setNotes((prev) => prev.map((n) => ({ ...n, hidden: target })))
      return target
    })
  }, [])

  /* drag */
  const onPanelPointerDown = (e: React.PointerEvent, note: DemoNote) => {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = { id: note.id, dx: e.clientX - note.x, dy: e.clientY - note.y }
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, z: ++zRef.current } : n)))
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const pos = clamp(e.clientX - d.dx, e.clientY - d.dy)
      setDragInfo({ id: d.id, x: Math.round(pos.x), y: Math.round(pos.y) })
      setNotes((prev) => prev.map((n) => (n.id === d.id ? { ...n, x: pos.x, y: pos.y } : n)))
      void r
    }
    const up = () => {
      dragRef.current = null
      setDragInfo(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [clamp])

  const onSurfaceMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  return (
    <div className="corner-frame select-none">
      {/* window chrome */}
      <div className="flex items-center justify-between border border-linex border-b-0 rounded-t-[8px] bg-panel2x px-3.5 h-10">
        <div className="flex items-center gap-2 text-[11px] text-faintx">
          <span className="inline-block h-[7px] w-[7px] rounded-full bg-[var(--acc)] pulse-dot" />
          <span className="text-dimx font-semibold">~/Desktop</span>
          <span className="hidden sm:inline">— spatial surface · live demo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => spawn()}
            title="new note (or press N)"
            className="rounded-[4px] border border-line2x bg-[var(--panel)] px-2 py-1 text-[10px] text-dimx hover:text-acc hover:border-[rgba(var(--acc-rgb),0.4)] transition-colors"
          >
            ⌃⌥⇧⌘N
          </button>
          <button
            onClick={toggleBlink}
            title="blink all / none (or press B)"
            className={`rounded-[4px] border px-2 py-1 text-[10px] transition-colors ${
              allHidden
                ? 'border-[rgba(var(--acc-rgb),0.45)] text-acc bg-[var(--acc-soft)]'
                : 'border-line2x bg-[var(--panel)] text-dimx hover:text-acc hover:border-[rgba(var(--acc-rgb),0.4)]'
            }`}
          >
            ⌃⌥⇧⌘B
          </button>
          <button
            onClick={() => setGrid((g) => !g)}
            title="grid overlay (or press C)"
            className={`rounded-[4px] border px-2 py-1 text-[10px] transition-colors ${
              grid
                ? 'border-[rgba(var(--acc-rgb),0.45)] text-acc bg-[var(--acc-soft)]'
                : 'border-line2x bg-[var(--panel)] text-dimx hover:text-acc hover:border-[rgba(var(--acc-rgb),0.4)]'
            }`}
          >
            ⌃⌥⇧⌘C
          </button>
          <button
            onClick={() => setNotes([])}
            title="reset surface"
            className="rounded-[4px] border border-line2x bg-[var(--panel)] px-2 py-1 text-[10px] text-faintx hover:text-[var(--red)] hover:border-[rgba(255,122,110,0.4)] transition-colors"
          >
            reset
          </button>
        </div>
      </div>

      {/* surface */}
      <div
        ref={ref}
        onPointerEnter={() => (hoverRef.current = true)}
        onPointerLeave={() => (hoverRef.current = false)}
        onPointerMove={onSurfaceMove}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.surface === 'grid') {
            spawn(e.clientX - ref.current!.getBoundingClientRect().left, e.clientY - ref.current!.getBoundingClientRect().top)
          }
        }}
        className="relative h-[380px] md:h-[460px] overflow-hidden rounded-b-[8px] border border-linex cursor-crosshair"
        style={{
          background: grid
            ? 'linear-gradient(rgba(var(--acc-rgb),0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--acc-rgb),0.07) 1px, transparent 1px), radial-gradient(ellipse 80% 60% at 50% 30%, rgba(var(--acc-rgb),0.09), transparent 70%), var(--demo-surface)'
            : 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(var(--acc-rgb),0.09), transparent 70%), var(--demo-surface)',
          backgroundSize: grid ? '40px 40px, 40px 40px, 100% 100%, 100% 100%' : '100% 100%, 100% 100%',
        }}
      >
        <div className="scanline" />

        {/* grid rulers */}
        {grid && (
          <div data-surface="grid" className="absolute inset-0 pointer-events-none">
            {[80, 160, 240, 320, 400].map((x) => (
              <span key={x} className="absolute top-1 text-[9px] text-[rgba(var(--acc-rgb),0.45)]" style={{ left: x + 3 }}>
                {x}
              </span>
            ))}
            {[80, 160, 240, 320].map((y) => (
              <span key={y} className="absolute left-1.5 text-[9px] text-[rgba(var(--acc-rgb),0.45)]" style={{ top: y + 3 }}>
                {y}
              </span>
            ))}
          </div>
        )}

        {/* empty state hint */}
        {notes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
            <div className="flex items-center gap-2 text-faintx text-[12px]">
              <Chord keys={['⌃', '⌥', '⇧', '⌘', 'N']} />
            </div>
            <p className="text-[11px] text-faintx">
              click anywhere — or press <span className="text-acc">N</span> — to drop a note in space
            </p>
          </div>
        )}

        {/* notes */}
        {notes.map((n) => (
          <div
            key={n.id}
            onPointerDown={(e) => onPanelPointerDown(e, n)}
            className={[
              'absolute rounded-[8px] glass-note note-spawn cursor-grab active:cursor-grabbing',
              n.hidden ? 'opacity-0 scale-95 pointer-events-none' : '',
            ].join(' ')}
            style={{
              left: n.x,
              top: n.y,
              width: n.w,
              zIndex: n.z,
              transition: 'opacity 0.22s ease, transform 0.22s ease',
            }}
          >
            <div className="flex items-center justify-between border-b border-[rgba(214,204,184,0.14)] px-2.5 py-1.5">
              <span className="text-[10px] text-[rgba(216,216,220,0.75)]">{n.title}</span>
              <span className="text-[9px] text-[rgba(150,150,158,0.7)]">
                {dragInfo?.id === n.id ? (
                  <span className="text-acc">
                    x:{String(dragInfo.x).padStart(3, '0')} y:{String(dragInfo.y).padStart(3, '0')}
                  </span>
                ) : (
                  `x:${String(Math.round(n.x)).padStart(3, '0')} y:${String(Math.round(n.y)).padStart(3, '0')}`
                )}
              </span>
            </div>
            <div className="px-2.5 py-2 space-y-[3px]">
              {n.lines.map((l, i) => (
                <div
                  key={i}
                  className={`text-[10px] leading-[1.5] whitespace-nowrap overflow-hidden ${
                    l.startsWith('##') ? 'text-[rgba(216,216,220,0.9)] font-semibold' : 'text-[rgba(150,150,158,0.9)]'
                  }`}
                >
                  {l}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* bottom-left readout */}
        <div className="absolute bottom-2 left-3 text-[9px] text-faintx pointer-events-none">
          panels: {notes.filter((n) => !n.hidden).length}/{notes.length}
          {allHidden && <span className="text-amberx"> · blinked out — ⌃⌥⇧⌘B to recall</span>}
        </div>
        <div className="absolute bottom-2 right-3 text-[9px] text-faintx pointer-events-none hidden sm:block">
          drag panels · state persists (x, y, w, h)
        </div>
      </div>
    </div>
  )
}
