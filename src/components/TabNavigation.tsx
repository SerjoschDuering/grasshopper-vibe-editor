'use client'

import { useAppStore } from '@/store/app-store'

export default function TabNavigation() {
  const activeTab = useAppStore(state => state.activeTab)
  const setActiveTab = useAppStore(state => state.setActiveTab)
  
  return (
    <div className="flex border-b mb-4 rounded-t-lg" style={{ 
      backgroundColor: 'var(--card-bg)',
      borderColor: 'var(--border-color)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <button
        className={`
          flex items-center px-4 py-2.5 text-sm font-medium transition-all duration-200
          ${activeTab === 'coding' 
            ? 'border-b-2' 
            : 'hover:bg-opacity-5 hover:bg-gray-900'
          }
        `}
        style={{
          color: activeTab === 'coding' ? 'var(--primary-color)' : 'var(--text-muted)',
          borderColor: activeTab === 'coding' ? 'var(--primary-color)' : 'transparent',
          backgroundColor: activeTab === 'coding' ? 'rgba(99, 102, 241, 0.05)' : 'transparent'
        }}
        onClick={() => setActiveTab('coding')}
      >
        <i className="fas fa-code mr-2"></i>
        Coding
      </button>
      
      <button
        className={`
          flex items-center px-4 py-2.5 text-sm font-medium transition-all duration-200
          ${activeTab === 'context' 
            ? 'border-b-2' 
            : 'hover:bg-opacity-5 hover:bg-gray-900'
          }
        `}
        style={{
          color: activeTab === 'context' ? 'var(--primary-color)' : 'var(--text-muted)',
          borderColor: activeTab === 'context' ? 'var(--primary-color)' : 'transparent',
          backgroundColor: activeTab === 'context' ? 'rgba(99, 102, 241, 0.05)' : 'transparent'
        }}
        onClick={() => setActiveTab('context')}
      >
        <i className="fas fa-project-diagram mr-2"></i>
        Context
      </button>
    </div>
  )
}