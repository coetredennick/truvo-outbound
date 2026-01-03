import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Truvo Outbound',
  description: 'AI-powered outbound calling platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
