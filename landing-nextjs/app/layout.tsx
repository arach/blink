import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Blink - AI-Native Spatial Notes',
  description: 'Revolutionary spatial note-taking app. Drag notes into floating windows, work across multiple spaces, and experience writing like never before.',
  keywords: ['notes', 'productivity', 'macos', 'floating windows', 'spatial', 'note-taking'],
  authors: [{ name: 'Blink Team' }],
  openGraph: {
    title: 'Blink - AI-Native Spatial Notes',
    description: 'Revolutionary spatial note-taking app with drag-to-detach windows and beautiful glass-morphism design.',
    type: 'website',
    siteName: 'Blink',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Blink - Spatial Notes',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blink - AI-Native Spatial Notes',
    description: 'Revolutionary spatial note-taking app with drag-to-detach windows.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon-32x32.png',
    apple: '/icon-128.png',
  },
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-gradient-to-br from-slate-50 via-white to-blue-50/30 relative overflow-x-hidden">
        {children}
      </body>
    </html>
  )
}