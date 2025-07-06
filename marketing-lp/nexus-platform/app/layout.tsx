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
  title: "Nexus — Intelligence Platform",
  description: "The future of data intelligence. Built for teams who demand precision, speed, and elegance.",
  keywords: "data platform, analytics, intelligence, enterprise software",
  authors: [{ name: "Nexus" }],
  openGraph: {
    title: "Nexus — Intelligence Platform",
    description: "The future of data intelligence. Built for teams who demand precision, speed, and elegance.",
    type: "website",
  },
    generator: 'v0.dev'
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
