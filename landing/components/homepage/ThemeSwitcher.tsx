'use client'

import { useEffect, useState } from 'react'

/** Parchment light (default :root) or forest dark. IDs stay stable for saved preferences. */
const THEMES = [
  { id: 'cream', bg: '#efe8d8', acc: '#2f6447', label: 'parchment light' },
  { id: 'black', bg: '#07100b', acc: '#93c6a2', label: 'forest dark' },
] as const

type ThemeId = (typeof THEMES)[number]['id']

function applyTheme(id: ThemeId) {
  const root = document.documentElement
  if (id === 'cream') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', 'black')
}

function normalize(raw: string | null): ThemeId {
  if (raw === 'black') return 'black'
  // Migrate old multi-theme ids → cream default (except explicit black)
  return 'cream'
}

export function ThemeSwitcher() {
  const [active, setActive] = useState<ThemeId>('cream')

  useEffect(() => {
    const attr = document.documentElement.getAttribute('data-theme')
    const saved = normalize(attr || localStorage.getItem('blink-theme'))
    setActive(saved)
    applyTheme(saved)
  }, [])

  const pick = (id: ThemeId) => {
    setActive(id)
    applyTheme(id)
    try {
      localStorage.setItem('blink-theme', id)
    } catch {}
  }

  return (
    <div className="flex items-center" role="radiogroup" aria-label="color theme">
      {THEMES.map((t) => {
        const on = active === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${t.label} theme`}
            title={t.label}
            onClick={() => pick(t.id)}
            className="inline-flex h-8 w-7 items-center justify-center rounded-sm transition-transform hover:scale-105"
          >
            <span
              className="block h-[12px] w-[12px] rounded-full"
              style={{
                backgroundColor: t.bg,
                opacity: on ? 1 : 0.55,
                boxShadow: on
                  ? `inset 0 0 0 1px ${t.acc}, 0 0 0 2px var(--bg), 0 0 0 3px ${t.acc}`
                  : `inset 0 0 0 1px ${t.acc}`,
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
