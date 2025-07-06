"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Keyboard, Eye, Zap, Layers, Command, MousePointer } from "lucide-react"

export default function FeaturesSection() {
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
    <section id="features" className="py-32 px-4 bg-gradient-to-b from-white to-slate-50/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <Badge variant="outline" className="mb-6 border-slate-200 text-slate-600 bg-white/50 rounded-xl">
            Core Features
          </Badge>
          <h2 className="font-display text-5xl md:text-6xl font-extralight text-slate-900 mb-6 leading-tight">
            Designed for Speed
          </h2>
          <p className="font-text text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Every feature is crafted to make note-taking faster, more intuitive, and beautifully integrated into your
            workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="bg-white/60 backdrop-blur-xl border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl"
            >
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <feature.icon className="w-8 h-8 text-slate-600" />
                  <div className="flex items-center space-x-1">
                    {feature.isKeyboard ? (
                      feature.demo.map((key, keyIndex) => (
                        <span
                          key={keyIndex}
                          className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-white border border-slate-300 rounded-xl shadow-sm font-mono text-xs font-medium text-slate-700"
                        >
                          {key}
                        </span>
                      ))
                    ) : (
                      <Badge variant="outline" className="border-slate-200 text-slate-500 bg-slate-50/50 text-xs rounded-xl">
                        {feature.demo[0]}
                      </Badge>
                    )}
                  </div>
                </div>
                <h3 className="font-display text-xl font-medium text-slate-900 mb-3">{feature.title}</h3>
                <p className="font-text text-slate-600 leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
