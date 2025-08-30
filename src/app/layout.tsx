import type { Metadata } from 'next'
import './globals.css'

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
          <div className="app-header">
            <i className="fas fa-code-branch app-logo"></i>
            <h1 className="mb-0 text-2xl font-semibold">VibeCode Grasshopper Editor</h1>
          </div>
          {children}
        </div>
      </body>
    </html>
  )
}