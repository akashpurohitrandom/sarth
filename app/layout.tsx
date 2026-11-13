import type { Metadata } from 'next'
import DisableContextMenu from '../components/ui/DisableContextMenu'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'Sārth',
  description: 'Just another corner on the street.',
  openGraph: {
    title: 'Sārth',
    description: 'Just another corner on the street.',
    type: 'website',
  },
  twitter: {
    title: 'Sārth',
    description: 'Just another corner on the street.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <DisableContextMenu />
        {children}
      </body>
    </html>
  )
}
