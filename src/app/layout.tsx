import type { Metadata } from 'next'
import './globals.css'
import AppHeader from '@/components/AppHeader'

export const metadata: Metadata = {
  title: 'VibeCode Grasshopper Editor',
  description: 'Web-based code editor for Grasshopper Python components with AI assistance',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link 
          rel="stylesheet" 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" 
        />
      </head>
      <body>
        <div className="main-container">
          <AppHeader />
          {children}
        </div>
      </body>
    </html>
  )
}