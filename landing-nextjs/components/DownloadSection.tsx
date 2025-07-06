import React from 'react'
import { Download, Github, Star, Users } from 'lucide-react'

const DownloadSection = () => {
  return (
    <section className="py-32 px-4 bg-gradient-to-b from-slate-50/50 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <div className="mb-6 inline-flex items-center bg-white/50 backdrop-blur-sm border border-slate-200 rounded-full px-4 py-2">
            <span className="text-slate-600 text-sm font-medium">Ready to Start</span>
          </div>
          <h2 className="font-display text-5xl md:text-6xl font-extralight text-slate-900 mb-6 leading-tight">
            Get Started Today
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-12 font-light">
            Join thousands of users who have transformed their note-taking workflow. Free download, no account required.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button className="bg-slate-900 text-white hover:bg-slate-800 px-8 py-4 text-base font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center">
              <Download className="w-5 h-5 mr-2" />
              Download for macOS
            </button>
            <button className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-8 py-4 text-base bg-white rounded-lg transition-all duration-200 flex items-center justify-center">
              <Github className="w-5 h-5 mr-2" />
              View on GitHub
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {[
            { icon: Users, label: "Active Users", value: "12,000+" },
            { icon: Star, label: "GitHub Stars", value: "2,400+" },
            { icon: Download, label: "Downloads", value: "50,000+" },
          ].map((stat, index) => (
            <div key={index} className="glass-window rounded-xl shadow-lg p-8 text-center">
              <stat.icon className="w-8 h-8 text-slate-600 mx-auto mb-4" />
              <div className="font-display text-3xl font-light text-slate-900 mb-2">{stat.value}</div>
              <div className="text-slate-600 font-light">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* System Requirements */}
        <div className="glass-window rounded-xl shadow-lg p-8">
          <h3 className="font-display text-xl font-medium text-slate-900 mb-6 text-center">System Requirements</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-medium text-slate-700 mb-3">macOS</h4>
              <ul className="text-sm text-slate-600 space-y-1 font-light">
                <li>• macOS 11.0 or later</li>
                <li>• Apple Silicon or Intel processor</li>
                <li>• 50MB free disk space</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-slate-700 mb-3">Features</h4>
              <ul className="text-sm text-slate-600 space-y-1 font-light">
                <li>• Global keyboard shortcuts</li>
                <li>• Always on top windows</li>
                <li>• Automatic updates</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default DownloadSection