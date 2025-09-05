'use client'

import { useAppStore } from '@/store/app-store'
import { useState, useEffect } from 'react'

export default function TabNavigation() {
  const activeTab = useAppStore(state => state.activeTab)
  const setActiveTab = useAppStore(state => state.setActiveTab)
  
  // Prevent hydration mismatch by deferring dynamic styles until after mount
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // Helper function to get consistent styles for buttons
  const getButtonStyles = (tabName: string) => {
    if (!isMounted) {
      // Return neutral styles for SSR/initial hydration
      return {
        color: 'var(--text-muted)',
        borderColor: 'transparent',
        backgroundColor: 'transparent'
      }
    }
    
    const isActive = activeTab === tabName
    return {
      color: isActive ? 'var(--primary-color)' : 'var(--text-muted)',
      borderColor: isActive ? 'var(--primary-color)' : 'transparent',
      backgroundColor: isActive ? 'rgba(99, 102, 241, 0.05)' : 'transparent'
    }
  }
  
  const getButtonClasses = (tabName: string) => {
    if (!isMounted) {
      // Return neutral classes for SSR/initial hydration
      return 'flex items-center px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-opacity-5 hover:bg-gray-900'
    }
    
    const isActive = activeTab === tabName
    return `flex items-center px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
      isActive ? 'border-b-2' : 'hover:bg-opacity-5 hover:bg-gray-900'
    }`
  }
  
  return (
    <div className="flex border-b mb-4 rounded-t-lg" style={{ 
      backgroundColor: 'var(--card-bg)',
      borderColor: 'var(--border-color)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <button
        className={getButtonClasses('coding')}
        style={getButtonStyles('coding')}
        onClick={() => setActiveTab('coding')}
      >
        <i className="fas fa-code mr-2"></i>
        Coding
      </button>
      
      <button
        className={getButtonClasses('context')}
        style={getButtonStyles('context')}
        onClick={() => setActiveTab('context')}
      >
        <i className="fas fa-project-diagram mr-2"></i>
        Context
      </button>
    </div>
  )
}