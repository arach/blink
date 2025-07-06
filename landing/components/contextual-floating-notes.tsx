"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Info, Lightbulb, Target, Sparkles } from "lucide-react"

interface ContextualNote {
  id: string
  title: string
  content: string
  triggerSection: string
  color: string
  icon: any
  position: { x: number; y: number }
  isVisible: boolean
}

export default function ContextualFloatingNotes() {
  const [notes] = useState<ContextualNote[]>([
    {
      id: "demo-explanation",
      title: "Interactive Demo",
      content:
        "These notes demonstrate the core functionality:\n\n• Click to collapse/expand\n• Drag to reposition\n• Always stay on top",
      triggerSection: "demo",
      color: "bg-blue-50/95",
      icon: Info,
      position: { x: 20, y: 25 },
      isVisible: false,
    },
    {
      id: "keyboard-power",
      title: "Keyboard Mastery",
      content: "Pro tip: Memorize ⌘+H, ⌘+N, and ⌘+1-9 for maximum productivity.",
      triggerSection: "shortcuts",
      color: "bg-amber-50/95",
      icon: Lightbulb,
      position: { x: 75, y: 40 },
      isVisible: false,
    },
    {
      id: "workflow-integration",
      title: "Workflow Magic",
      content: "Floating notes integrate seamlessly with your existing workflow - no disruption, just enhancement.",
      triggerSection: "features",
      color: "bg-emerald-50/95",
      icon: Target,
      position: { x: 15, y: 60 },
      isVisible: false,
    },
    {
      id: "getting-started",
      title: "Ready to Start?",
      content: "Download now and transform your note-taking experience in under 2 minutes.",
      triggerSection: "download",
      color: "bg-violet-50/95",
      icon: Sparkles,
      position: { x: 80, y: 20 },
      isVisible: false,
    },
  ])

  const [visibleNotes, setVisibleNotes] = useState<Set<string>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    // Create intersection observer to show notes based on scroll position
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.id
            const relevantNotes = notes.filter((note) => note.triggerSection === sectionId)

            relevantNotes.forEach((note) => {
              setTimeout(() => {
                setVisibleNotes((prev) => new Set([...prev, note.id]))
              }, 1000)
            })
          }
        })
      },
      { threshold: 0.3 },
    )

    // Observe sections
    const sections = ["demo", "features", "shortcuts", "download"]
    sections.forEach((sectionId) => {
      const element = document.getElementById(sectionId)
      if (element && observerRef.current) {
        observerRef.current.observe(element)
      }
    })

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [notes])

  const dismissNote = (id: string) => {
    setVisibleNotes((prev) => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {notes
        .filter((note) => visibleNotes.has(note.id))
        .map((note) => (
          <Card
            key={note.id}
            className={`absolute ${note.color} backdrop-blur-xl border border-white/50 shadow-2xl pointer-events-auto transition-all duration-700 hover:scale-105 animate-in fade-in slide-in-from-right-4`}
            style={{
              left: `${note.position.x}%`,
              top: `${note.position.y}%`,
              width: "240px",
              transform: "translate(-50%, -50%)",
            }}
          >
            {/* Title bar */}
            <div className="flex items-center justify-between p-3 border-b border-white/40">
              <div className="flex items-center space-x-2">
                <note.icon className="w-4 h-4 text-slate-600" />
                <span className="font-text text-sm font-medium text-slate-700">{note.title}</span>
              </div>
              <button
                onClick={() => dismissNote(note.id)}
                className="w-5 h-5 rounded-full bg-slate-200/60 hover:bg-slate-300/60 transition-colors flex items-center justify-center"
              >
                <span className="text-xs text-slate-600">×</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              <pre className="font-text text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{note.content}</pre>
            </div>

            {/* Floating badge */}
            <div className="absolute -top-2 -left-2">
              <Badge className="bg-white/90 text-slate-700 border-slate-200 shadow-sm">
                <note.icon className="w-3 h-3 mr-1" />
                Insight
              </Badge>
            </div>
          </Card>
        ))}
    </div>
  )
}
