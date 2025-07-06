import React from 'react'
import { Download, Play } from 'lucide-react'

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Subtle background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.05),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(147,51,234,0.03),transparent_50%)]" />

      {/* Floating background notes */}
      <div className="absolute top-20 left-20 w-64 h-32 glass rounded-xl shadow-lg rotate-3 animate-subtle-float opacity-20" />
      <div className="absolute top-40 right-32 w-48 h-24 glass rounded-xl shadow-lg -rotate-2 animate-subtle-float opacity-15" style={{animationDelay: '2s'}} />
      <div className="absolute bottom-32 left-32 w-56 h-28 glass rounded-xl shadow-lg rotate-1 animate-subtle-float opacity-25" style={{animationDelay: '4s'}} />

      <div className="relative z-10 text-center max-w-4xl mx-auto">
        <div className="mb-8 inline-flex items-center bg-white/50 backdrop-blur-sm border border-slate-200 rounded-full px-4 py-2">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
          <span className="text-slate-600 text-sm font-medium">Now Available</span>
        </div>

        <h1 className="font-display text-6xl md:text-8xl font-extralight mb-8 text-slate-900 leading-[0.9] tracking-tight animate-slide-up">
          Floating Notes
          <br />
          <span className="font-light bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
            Reimagined
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-slate-600 mb-12 max-w-3xl mx-auto leading-relaxed font-light animate-slide-up" style={{animationDelay: '0.2s'}}>
          The next generation of note-taking. Create beautiful floating windows that stay exactly where you need them.
          Always accessible, never in the way.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-slide-up" style={{animationDelay: '0.4s'}}>
          <button className="bg-slate-900 text-white hover:bg-slate-800 px-8 py-4 text-base font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center">
            <Download className="w-4 h-4 mr-2" />
            Download Free
          </button>
          <button className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-8 py-4 text-base bg-white/50 backdrop-blur-sm rounded-lg transition-all duration-200 flex items-center justify-center">
            <Play className="w-4 h-4 mr-2" />
            Watch Demo
          </button>
        </div>

        {/* Key features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto animate-slide-up" style={{animationDelay: '0.6s'}}>
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 mb-2">
              <span className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 bg-white border border-slate-300 rounded-md shadow-sm font-mono text-sm font-medium text-slate-700">⌘</span>
              <span className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 bg-white border border-slate-300 rounded-md shadow-sm font-mono text-sm font-medium text-slate-700">+</span>
              <span className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 bg-white border border-slate-300 rounded-md shadow-sm font-mono text-sm font-medium text-slate-700">H</span>
            </div>
            <div className="text-sm text-slate-500 uppercase tracking-wider">Keyboard Shortcuts</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 mb-2">
              <span className="font-display text-lg font-medium text-slate-900">Stays Visible</span>
            </div>
            <div className="text-sm text-slate-500 uppercase tracking-wider">Always on Top</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 mb-2">
              <span className="font-display text-lg font-medium text-slate-900">< 100ms</span>
            </div>
            <div className="text-sm text-slate-500 uppercase tracking-wider">Instant Access</div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection