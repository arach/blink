import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Download, Github, Star, Users } from "lucide-react"

export default function DownloadSection() {
  return (
    <section className="py-32 px-4 bg-gradient-to-b from-slate-50/50 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <Badge variant="outline" className="mb-6 border-slate-200 text-slate-600 bg-white/50">
            Ready to Start
          </Badge>
          <h2 className="font-display text-5xl md:text-6xl font-extralight text-slate-900 mb-6 leading-tight">
            Get Started Today
          </h2>
          <p className="font-text text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-12">
            Join thousands of users who have transformed their note-taking workflow. Free download, no account required.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              asChild
              size="lg"
              className="bg-slate-900 text-white hover:bg-slate-800 px-8 py-4 text-base font-medium rounded-xl shadow-lg"
            >
              <a href="https://github.com/arach/blink/releases/latest" target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 w-5 h-5" />
                Download for macOS
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-50 px-8 py-4 text-base bg-white rounded-xl"
            >
              <a href="https://github.com/arach/blink" target="_blank" rel="noopener noreferrer">
                <Github className="mr-2 w-5 h-5" />
                View on GitHub
              </a>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {[
            { icon: Users, label: "Active Users", value: "12,000+" },
            { icon: Star, label: "GitHub Stars", value: "2,400+" },
            { icon: Download, label: "Downloads", value: "50,000+" },
          ].map((stat, index) => (
            <Card key={index} className="bg-white/60 backdrop-blur-xl border border-white/30 shadow-lg">
              <CardContent className="p-8 text-center">
                <stat.icon className="w-8 h-8 text-slate-600 mx-auto mb-4" />
                <div className="font-display text-3xl font-light text-slate-900 mb-2">{stat.value}</div>
                <div className="font-text text-slate-600">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* System Requirements */}
        <Card className="bg-white/40 backdrop-blur-xl border border-white/30 shadow-lg">
          <CardContent className="p-8">
            <h3 className="font-display text-xl font-medium text-slate-900 mb-6 text-center">System Requirements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="font-text font-medium text-slate-700 mb-3">macOS</h4>
                <ul className="font-text text-sm text-slate-600 space-y-1">
                  <li>• macOS 11.0 or later</li>
                  <li>• Apple Silicon or Intel processor</li>
                  <li>• 50MB free disk space</li>
                </ul>
              </div>
              <div>
                <h4 className="font-text font-medium text-slate-700 mb-3">Features</h4>
                <ul className="font-text text-sm text-slate-600 space-y-1">
                  <li>• Global keyboard shortcuts</li>
                  <li>• Always on top windows</li>
                  <li>• Automatic updates</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
