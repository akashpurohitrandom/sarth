import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'Sārth',
  description: 'Photography by Akash Purohit',
  openGraph: {
    title: 'Sārth',
    description: 'Photography by Akash Purohit',
    type: 'website',
  },
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
