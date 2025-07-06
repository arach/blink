import { Suspense } from "react"
import HeroSection from "@/components/hero-section"
import FloatingNotesDemo from "@/components/floating-notes-demo"
import FeaturesSection from "@/components/features-section"
import KeyboardShortcutsGuide from "@/components/keyboard-shortcuts-guide"
import HowItWorksSection from "@/components/how-it-works-section"
import DownloadSection from "@/components/download-section"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 relative overflow-hidden">
      <HeroSection />
      <Suspense fallback={<div className="h-96" />}>
        <FloatingNotesDemo />
      </Suspense>
      <FeaturesSection />
      <KeyboardShortcutsGuide />
      <HowItWorksSection />
      <DownloadSection />
    </main>
  )
}
