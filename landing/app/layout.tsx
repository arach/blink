import type React from "react"
import type { Metadata } from "next"
import { JetBrains_Mono } from "next/font/google"
import "./globals.css"

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: "variable",
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
    // suppressHydrationWarning: the script below sets data-theme on <html> before
    // React hydrates, so the server markup and client DOM intentionally differ.
    <html lang="en" className={jetBrainsMono.variable} suppressHydrationWarning>
      <body>
        {/* Apply cream (default) or black before paint — no flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var p=new URLSearchParams(location.search).get('theme');var t=p||localStorage.getItem('blink-theme');if(p){try{localStorage.setItem('blink-theme',p==='black'?'black':'cream')}catch(e){}}if(t==='black')document.documentElement.setAttribute('data-theme','black');else document.documentElement.removeAttribute('data-theme')}catch(e){}",
          }}
        />
        {children}
      </body>
    </html>
  )
}
