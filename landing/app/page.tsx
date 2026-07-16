import HeroSection from "@/components/hero-section"
import FeaturesSection from "@/components/features-section"
import SheetsSection from "@/components/sheets-section"
import AgentSection from "@/components/agent-section"
import ShortcutsSection from "@/components/shortcuts-section"
import DownloadSection from "@/components/download-section"

export default function Home() {
  return (
    <main className="relative min-h-screen bg-[#08090b] text-white overflow-hidden">
      {/* Ambient depth — a couple of faint glows, no floating clutter */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[38%] -left-40 w-[36rem] h-[36rem] rounded-full bg-[radial-gradient(circle,rgba(70,120,220,0.08),transparent_70%)]" />
        <div className="absolute top-[68%] -right-40 w-[34rem] h-[34rem] rounded-full bg-[radial-gradient(circle,rgba(150,110,220,0.06),transparent_70%)]" />
      </div>

      <div className="relative z-10">
        <HeroSection />
        <FeaturesSection />
        <SheetsSection />
        <AgentSection />
        <ShortcutsSection />
        <DownloadSection />
      </div>
    </main>
  )
}
