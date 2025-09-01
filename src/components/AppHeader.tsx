'use client'

import { useAppStore } from '@/store/app-store'

export default function AppHeader() {
  const activeTab = useAppStore(state => state.activeTab)
  const setActiveTab = useAppStore(state => state.setActiveTab)
  
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
          className={`
            flex items-center px-6 py-3 font-medium transition-all duration-200
            ${activeTab === 'coding' ? 'shadow-sm' : 'hover:bg-white hover:bg-opacity-50'}
          `}
          style={{
            fontSize: '15px',
            color: activeTab === 'coding' ? 'var(--primary-color)' : 'var(--text-muted)',
            backgroundColor: activeTab === 'coding' ? 'var(--card-bg)' : 'transparent',
            borderRadius: 'var(--border-radius)',
            fontWeight: activeTab === 'coding' ? '600' : '500',
            boxShadow: activeTab === 'coding' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
          }}
          onClick={() => setActiveTab('coding')}
        >
          <i className="fas fa-code mr-2.5"></i>
          Coding
        </button>
        
        <button
          className={`
            flex items-center px-6 py-3 font-medium transition-all duration-200
            ${activeTab === 'context' ? 'shadow-sm' : 'hover:bg-white hover:bg-opacity-50'}
          `}
          style={{
            fontSize: '15px',
            color: activeTab === 'context' ? 'var(--primary-color)' : 'var(--text-muted)',
            backgroundColor: activeTab === 'context' ? 'var(--card-bg)' : 'transparent',
            borderRadius: 'var(--border-radius)',
            fontWeight: activeTab === 'context' ? '600' : '500',
            boxShadow: activeTab === 'context' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
          }}
          onClick={() => setActiveTab('context')}
        >
          <i className="fas fa-project-diagram mr-2.5"></i>
          Context
        </button>
      </div>
    </div>
  )
}