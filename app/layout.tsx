import type { Metadata } from 'next'
import DisableContextMenu from '../components/ui/DisableContextMenu'
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
      <body>
        <DisableContextMenu />
        {children}
      </body>
    </html>
  )
}
