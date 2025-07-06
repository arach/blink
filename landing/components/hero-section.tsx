import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Play } from "lucide-react"

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Subtle background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.05),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(147,51,234,0.03),transparent_50%)]" />

      {/* Floating background notes */}
      <div className="absolute top-20 left-20 w-64 h-32 bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 rotate-3 animate-pulse opacity-40" />
      <div className="absolute top-40 right-32 w-48 h-24 bg-blue-50/80 backdrop-blur-xl rounded-2xl shadow-lg border border-blue-100/30 -rotate-2 animate-pulse opacity-30 delay-1000" />
      <div className="absolute bottom-32 left-32 w-56 h-28 bg-purple-50/70 backdrop-blur-xl rounded-2xl shadow-lg border border-purple-100/20 rotate-1 animate-pulse opacity-35 delay-500" />

      <div className="relative z-10 text-center max-w-4xl mx-auto">
        <Badge variant="outline" className="mb-8 border-slate-200 text-slate-600 bg-white/50 backdrop-blur-sm rounded-xl">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
          Now Available
        </Badge>

        <h1 className="font-display text-6xl md:text-8xl font-extralight mb-8 text-slate-900 leading-[0.9] tracking-tight">
          Floating Notes
          <br />
          <span className="font-light bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
            Reimagined
          </span>
        </h1>

        <p className="font-text text-xl md:text-2xl text-slate-600 mb-12 max-w-3xl mx-auto leading-relaxed font-light">
          The next generation of note-taking. Create beautiful floating windows that stay exactly where you need them.
          Always accessible, never in the way.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Button
            asChild
            size="lg"
            className="bg-slate-900 text-white hover:bg-slate-800 px-8 py-4 text-base font-medium rounded-xl transition-all duration-200 shadow-lg"
          >
            <a href="https://github.com/arach/blink/releases/latest" target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 w-4 h-4" />
              Download Free
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-50 px-8 py-4 text-base bg-white/50 backdrop-blur-sm rounded-xl"
          >
            <a href="https://github.com/arach/blink" target="_blank" rel="noopener noreferrer">
              <Play className="mr-2 w-4 h-4" />
              View on GitHub
            </a>
          </Button>
        </div>

        {/* Key features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto">
          {[
            { label: "Keyboard Shortcuts", value: ["⌘", "+", "H"] },
            { label: "Always on Top", value: ["Stays Visible"] },
            { label: "Instant Access", value: ["< 100ms"] },
          ].map((item, index) => (
            <div key={index} className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-2">
                {Array.isArray(item.value) ? (
                  item.value.map((key, keyIndex) => (
                    <span
                      key={keyIndex}
                      className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 bg-white border border-slate-300 rounded-xl shadow-sm font-mono text-sm font-medium text-slate-700"
                    >
                      {key}
                    </span>
                  ))
                ) : (
                  <span className="font-display text-lg font-medium text-slate-900">{item.value}</span>
                )}
              </div>
              <div className="font-text text-sm text-slate-500 uppercase tracking-wider">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
