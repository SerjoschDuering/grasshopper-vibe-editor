'use client'

import { useAppStore } from '@/store/app-store'
import { useState, useEffect } from 'react'

export default function AppHeader() {
  const activeTab = useAppStore(state => state.activeTab)
  const setActiveTab = useAppStore(state => state.setActiveTab)
  
  // Prevent hydration mismatch by deferring dynamic styles until after mount
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // Create a function to get button styles that ensures consistent rendering
  const getButtonStyles = (tabName: string) => {
    if (!isMounted) {
      // Return neutral styles for SSR/initial hydration
      return {
        fontSize: '15px',
        color: 'var(--text-muted)',
        backgroundColor: 'transparent',
        borderRadius: 'var(--border-radius)',
        fontWeight: '500',
        boxShadow: 'none'
      }
    }
    
    const isActive = activeTab === tabName
    return {
      fontSize: '15px',
      color: isActive ? 'var(--primary-color)' : 'var(--text-muted)',
      backgroundColor: isActive ? 'var(--card-bg)' : 'transparent',
      borderRadius: 'var(--border-radius)',
      fontWeight: isActive ? '600' : '500',
      boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
    }
  }
  
  return (
    <div className="app-header">
      <div className="flex items-center">
        <i className="fas fa-code-branch app-logo"></i>
        <h1 className="mb-0 text-2xl font-semibold">VibeCode Grasshopper Editor</h1>
      </div>
      
      <div className="flex gap-1" style={{
        backgroundColor: 'rgba(0,0,0,0.04)',
        padding: '5px',
        borderRadius: 'calc(var(--border-radius) * 1.2)',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <button
          className="flex items-center px-6 py-3 font-medium transition-all duration-200 hover:bg-white hover:bg-opacity-50"
          style={getButtonStyles('coding')}
          onClick={() => setActiveTab('coding')}
        >
          <i className="fas fa-code mr-2.5"></i>
          Coding
        </button>
        
        <button
          className="flex items-center px-6 py-3 font-medium transition-all duration-200 hover:bg-white hover:bg-opacity-50"
          style={getButtonStyles('context')}
          onClick={() => setActiveTab('context')}
        >
          <i className="fas fa-project-diagram mr-2.5"></i>
          Context
        </button>

        <button
          className="flex items-center px-6 py-3 font-medium transition-all duration-200 hover:bg-white hover:bg-opacity-50"
          style={getButtonStyles('docs')}
          onClick={() => setActiveTab('docs')}
        >
          <i className="fas fa-book mr-2.5"></i>
          Docs
        </button>
      </div>
    </div>
  )
}