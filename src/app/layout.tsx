import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DockCheck',
  description: 'Verify any carrier in 10 seconds',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'DockCheck' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0e0e0e',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="phone-frame">
          <div className="phone-screen">
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}
