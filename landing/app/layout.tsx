import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

// Fallback fonts that closely match SF Pro
const sfProDisplay = Inter({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
})

const sfProText = Inter({
  subsets: ["latin"],
  variable: "--font-text",
  weight: ["300", "400", "500", "600"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Blink — Spatial notes for your Mac",
  description:
    "A native macOS menubar app. Summon a borderless glass note anywhere with a keystroke, place it in space, and it stays. Plain markdown you own — open to your agents.",
  keywords:
    "macOS notes, menubar app, spatial notes, floating notes, markdown, keyboard-first, agent-first, native app",
  authors: [{ name: "Blink" }],
  openGraph: {
    title: "Blink — Spatial notes for your Mac",
    description:
      "Summon a borderless glass note anywhere with a keystroke, place it in space, and it stays. Plain markdown you own — open to your agents.",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${sfProDisplay.variable} ${sfProText.variable}`}>
      <body className="font-text antialiased">{children}</body>
    </html>
  )
}
