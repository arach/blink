import React, { useState, useEffect, useRef } from 'react'

interface FloatingNote {
  id: string
  title: string
  content: string
  x: number
  y: number
  isCollapsed: boolean
  color: string
  zIndex: number
}

interface DragState {
  isDragging: boolean
  noteId: string | null
  offset: { x: number; y: number }
  maxZ: number
}

const FloatingNotesDemo: React.FC = () => {
  const [notes, setNotes] = useState<FloatingNote[]>([
    {
      id: "1",
      title: "Meeting Notes",
      content: "• Discuss Q4 roadmap\n• Review user feedback\n• Plan next sprint\n• Update documentation",
      x: 15,
      y: 20,
      isCollapsed: false,
      color: "bg-white/90",
      zIndex: 1,
    },
    {
      id: "2", 
      title: "Quick Ideas",
      content: "New feature: Dark mode\nImprove onboarding flow\nAdd keyboard shortcuts guide\nBetter mobile experience",
      x: 55,
      y: 15,
      isCollapsed: true,
      color: "bg-blue-50/95",
      zIndex: 2,
    },
    {
      id: "3",
      title: "Shopping List",
      content: "🥛 Milk\n🍞 Bread\n🥑 Avocados\n☕ Coffee beans\n🧀 Cheese\n🍎 Apples",
      x: 25,
      y: 55,
      isCollapsed: false,
      color: "bg-green-50/90",
      zIndex: 3,
    },
    {
      id: "4",
      title: "Code Snippets",
      content: "// React Hook\nconst [state, setState] = useState()\n\n// Quick function\nconst helper = () => {\n  return data.map(item => item.id)\n}",
      x: 65,
      y: 45,
      isCollapsed: false,
      color: "bg-purple-50/90",
      zIndex: 4,
    },
    {
      id: "5",
      title: "Project Tasks",
      content: "✅ Design wireframes\n⏳ Implement auth system\n📝 Write documentation\n🔍 Code review",
      x: 10,
      y: 75,
      isCollapsed: true,
      color: "bg-yellow-50/90",
      zIndex: 5,
    },
    {
      id: "6",
      title: "Research Links",
      content: "📖 Design patterns guide\n🔗 React best practices\n💡 UX inspiration\n🛠️ Dev tools comparison",
      x: 45,
      y: 75,
      isCollapsed: false,
      color: "bg-rose-50/90",
      zIndex: 6,
    },
  ])

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    noteId: null,
    offset: { x: 0, y: 0 },
    maxZ: 6
  })

  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent, noteId: string) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const note = notes.find((n) => n.id === noteId)
    if (!note) return

    const noteX = (note.x / 100) * rect.width
    const noteY = (note.y / 100) * rect.height

    // Bring note to front
    const newMaxZ = dragState.maxZ + 1
    setNotes(prev => prev.map(n => 
      n.id === noteId 
        ? { ...n, zIndex: newMaxZ }
        : n
    ))

    setDragState({
      isDragging: true,
      noteId,
      offset: {
        x: e.clientX - rect.left - noteX,
        y: e.clientY - rect.top - noteY,
      },
      maxZ: newMaxZ
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.noteId || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const newX = ((e.clientX - rect.left - dragState.offset.x) / rect.width) * 100
    const newY = ((e.clientY - rect.top - dragState.offset.y) / rect.height) * 100

    // Constrain to container bounds with note width/height considerations
    const constrainedX = Math.max(0, Math.min(75, newX))
    const constrainedY = Math.max(6, Math.min(85, newY)) // Account for menu bar

    setNotes((prev) =>
      prev.map((note) => (note.id === dragState.noteId ? { ...note, x: constrainedX, y: constrainedY } : note)),
    )
  }

  const handleMouseUp = () => {
    setDragState({
      ...dragState,
      isDragging: false,
      noteId: null,
    })
  }

  const toggleNote = (id: string) => {
    if (dragState.isDragging) return // Don't toggle while dragging
    setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, isCollapsed: !note.isCollapsed } : note)))
  }

  // Subtle auto-demo with longer intervals
  useEffect(() => {
    const interval = setInterval(() => {
      if (dragState.isDragging) return

      setNotes((prev) => {
        const expandedNotes = prev.filter(note => !note.isCollapsed)
        if (expandedNotes.length === 0) return prev
        
        const randomNote = expandedNotes[Math.floor(Math.random() * expandedNotes.length)]
        return prev.map((note) => (note.id === randomNote.id ? { ...note, isCollapsed: true } : note))
      })
    }, 15000) // Much longer interval for subtlety

    const expandInterval = setInterval(() => {
      if (dragState.isDragging) return

      setNotes((prev) => {
        const collapsedNotes = prev.filter(note => note.isCollapsed)
        if (collapsedNotes.length === 0) return prev
        
        const randomNote = collapsedNotes[Math.floor(Math.random() * collapsedNotes.length)]
        return prev.map((note) => (note.id === randomNote.id ? { ...note, isCollapsed: false } : note))
      })
    }, 20000) // Even longer for expand

    return () => {
      clearInterval(interval)
      clearInterval(expandInterval)
    }
  }, [dragState.isDragging])

  return (
    <section className="py-32 px-4 relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <div className="mb-6 inline-flex items-center bg-white/50 backdrop-blur-sm border border-slate-200 rounded-full px-4 py-2">
            <span className="text-slate-600 text-sm font-medium">Interactive Demo</span>
          </div>
          <h2 className="font-display text-5xl md:text-6xl font-extralight text-slate-900 mb-6 leading-tight">
            See It in Action
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-light">
            Drag notes around, click to collapse/expand. Experience the fluid interactions that make floating notes so powerful.
          </p>
        </div>

        {/* Laptop Frame Context */}
        <div className="laptop-frame max-w-6xl w-full mx-auto animate-fade-in">
          <div className="laptop-screen aspect-[16/10] relative">
            {/* Laptop bezel */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 rounded-2xl p-6 shadow-2xl">
              
              {/* Screen */}
              <div 
                ref={containerRef}
                className="relative w-full h-full bg-gradient-to-br from-blue-100 via-slate-50 to-purple-50 rounded-lg overflow-hidden select-none"
                style={{
                  backgroundImage: `
                    radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.1), transparent 50%),
                    radial-gradient(circle at 80% 70%, rgba(147, 51, 234, 0.08), transparent 50%)
                  `
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* macOS Menu Bar */}
                <div className="absolute top-0 left-0 right-0 h-6 bg-white/20 backdrop-blur-md border-b border-white/10 flex items-center px-4 z-50">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-xs text-slate-600 font-medium">Blink - Spatial Notes</span>
                  </div>
                </div>

                {/* Floating Notes */}
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={`absolute ${note.color} backdrop-blur-xl border border-white/40 shadow-xl transition-all duration-300 rounded-lg ${ 
                      dragState.isDragging && dragState.noteId === note.id
                        ? "cursor-grabbing scale-105 shadow-2xl rotate-1"
                        : "cursor-grab hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1"
                    }`}
                    style={{
                      left: `${note.x}%`,
                      top: `${note.y + 6}%`, // Offset for menu bar
                      width: note.isCollapsed ? "180px" : "220px",
                      height: note.isCollapsed ? "32px" : "auto",
                      zIndex: note.zIndex,
                      transformOrigin: "top center",
                    }}
                    onMouseDown={(e) => handleMouseDown(e, note.id)}
                    onClick={() => toggleNote(note.id)}
                  >
                    {/* Custom Title Bar */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/20 bg-white/10 backdrop-blur-sm">
                      <span className="text-xs font-medium text-slate-700 truncate flex-1 mr-2">
                        {note.title}
                      </span>
                      <div className="flex items-center space-x-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400 opacity-80"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 opacity-80"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400 opacity-80"></div>
                      </div>
                    </div>

                    {/* Content */}
                    {!note.isCollapsed && (
                      <div className="p-3">
                        <pre className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed font-mono">
                          {note.content}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}

                {/* Instruction overlay */}
                <div className="absolute bottom-4 left-4 right-4 text-center z-40">
                  <p className="text-xs text-slate-500 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 inline-block border border-white/20">
                    Drag notes around • Click to collapse/expand • Auto-demo running subtly
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Laptop Base */}
          <div className="w-full h-4 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded-b-2xl mx-auto relative">
            <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-16 h-2 bg-slate-500 rounded-full"></div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default FloatingNotesDemo