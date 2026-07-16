"use client"

import { TopBar, StatusBar } from "@/components/homepage/Chrome"
import Hero from "@/components/homepage/Hero"
import { SpecStrip, Architecture } from "@/components/homepage/Architecture"
import Sheets from "@/components/homepage/Sheets"
import FilesystemAPI from "@/components/homepage/FilesystemAPI"
import { ConfigSection } from "@/components/homepage/Config"
import Keys from "@/components/homepage/Keys"
import { Install, Footer } from "@/components/homepage/Install"

export default function Home() {
  return (
    <div className="crt min-h-screen">
      <TopBar />
      <main>
        <Hero />
        <SpecStrip />
        <Architecture />
        <Sheets />
        <FilesystemAPI />
        <ConfigSection />
        <Keys />
        <Install />
      </main>
      <Footer />
      <StatusBar />
    </div>
  )
}
