'use client'

import { useEffect, useState } from 'react'

/** Full-palette themes. `amber` is the default (:root), so it clears the attribute.
 *  Each swatch shows the theme's background (fill) + accent (ring). */
const THEMES = [
  { id: 'amber', bg: '#0a0a0b', acc: '#f0b45a' },
  { id: 'green', bg: '#060907', acc: '#6ee787' },
  { id: 'blue', bg: '#070a10', acc: '#7cc7e8' },
  { id: 'violet', bg: '#0a0810', acc: '#c792ea' },
  { id: 'paper', bg: '#e8e2d4', acc: '#9c5a16' },
] as const

function applyTheme(id: string) {
  const root = document.documentElement
  if (id === 'amber') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', id)
}

export function ThemeSwitcher() {
  const [active, setActive] = useState('amber')

  // Adopt whatever the no-FOUC script (or a prior visit) already set.
  useEffect(() => {
    const saved = document.documentElement.getAttribute('data-theme') || 'amber'
    setActive(saved)
  }, [])

  const pick = (id: string) => {
    setActive(id)
    applyTheme(id)
    try {
      localStorage.setItem('blink-theme', id)
    } catch {}
  }

  return (
    <div className="flex items-center gap-[7px]" role="radiogroup" aria-label="accent theme">
      {THEMES.map((t) => {
        const on = active === t.id
        return (
          <button
            key={t.id}
            role="radio"
            aria-checked={on}
            aria-label={`${t.id} theme`}
            title={t.id}
            onClick={() => pick(t.id)}
            className="h-[12px] w-[12px] rounded-full transition-transform hover:scale-110"
            style={{
              backgroundColor: t.bg,
              opacity: on ? 1 : 0.5,
              boxShadow: on
                ? `inset 0 0 0 1px ${t.acc}, 0 0 0 2px var(--bg), 0 0 0 3px ${t.acc}`
                : `inset 0 0 0 1px ${t.acc}`,
            }}
          />
        )
      })}
    </div>
  )
}
