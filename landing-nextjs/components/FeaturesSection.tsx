import React from 'react'
import { Keyboard, Eye, Zap, Layers, Command, MousePointer } from 'lucide-react'

const FeaturesSection = () => {
  const features = [
    {
      icon: Keyboard,
      title: "Global Shortcuts",
      description:
        "Summon any note instantly with customizable keyboard shortcuts. Hyper + H brings your notes to the front.",
      demo: ["⌘", "+", "H"],
      isKeyboard: true,
    },
    {
      icon: Eye,
      title: "Always on Top",
      description: "Keep your notes visible above all other windows. Perfect for reference material and quick access.",
      demo: ["Stays Visible"],
      isKeyboard: false,
    },
    {
      icon: MousePointer,
      title: "Smart Interactions",
      description: "Click to focus, double-click to collapse, middle-click for quick actions. Intuitive and fast.",
      demo: ["Click & Go"],
      isKeyboard: false,
    },
    {
      icon: Layers,
      title: "Shadow Mode",
      description: "Collapse notes to just their title bar to save space while keeping them accessible.",
      demo: ["Minimal View"],
      isKeyboard: false,
    },
    {
      icon: Zap,
      title: "Instant Access",
      description: "Notes appear and disappear in milliseconds. No waiting, no lag, just pure productivity.",
      demo: ["< 100ms"],
      isKeyboard: false,
    },
    {
      icon: Command,
      title: "Individual Shortcuts",
      description:
        "Assign unique keyboard shortcuts to specific notes for lightning-fast access to your most important content.",
      demo: ["⌘", "+", "1"],
      isKeyboard: true,
    },
  ]

  return (
    <section className="py-32 px-4 bg-gradient-to-b from-white to-slate-50/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <div className="mb-6 inline-flex items-center bg-white/50 backdrop-blur-sm border border-slate-200 rounded-full px-4 py-2">
            <span className="text-slate-600 text-sm font-medium">Core Features</span>
          </div>
          <h2 className="font-display text-5xl md:text-6xl font-extralight text-slate-900 mb-6 leading-tight">
            Designed for Speed
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-light">
            Every feature is crafted to make note-taking faster, more intuitive, and beautifully integrated into your
            workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="glass-window rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <feature.icon className="w-8 h-8 text-slate-600" />
                <div className="flex items-center space-x-1">
                  {feature.isKeyboard ? (
                    feature.demo.map((key, keyIndex) => (
                      <span
                        key={keyIndex}
                        className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-white border border-slate-300 rounded shadow-sm font-mono text-xs font-medium text-slate-700"
                      >
                        {key}
                      </span>
                    ))
                  ) : (
                    <div className="inline-flex items-center bg-slate-50/50 border border-slate-200 rounded px-2 py-1">
                      <span className="text-slate-500 text-xs">{feature.demo[0]}</span>
                    </div>
                  )}
                </div>
              </div>
              <h3 className="font-display text-xl font-medium text-slate-900 mb-3">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed font-light">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection