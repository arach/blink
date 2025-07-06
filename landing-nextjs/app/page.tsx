import HeroSection from '@/components/HeroSection'
import FloatingNotesDemo from '@/components/FloatingNotesDemo'
import FeaturesSection from '@/components/FeaturesSection'
import DownloadSection from '@/components/DownloadSection'

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <FloatingNotesDemo />
      <FeaturesSection />
      <DownloadSection />
    </main>
  )
}