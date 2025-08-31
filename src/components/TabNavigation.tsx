'use client'

import { useAppStore } from '@/store/app-store'

export default function TabNavigation() {
  const activeTab = useAppStore(state => state.activeTab)
  const setActiveTab = useAppStore(state => state.setActiveTab)
  
  return (
    <div className="flex border-b border-gray-200 mb-4 bg-white rounded-t-lg">
      <button
        className={`
          flex items-center px-4 py-2 text-sm font-medium transition-colors
          ${activeTab === 'coding' 
            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }
        `}
        onClick={() => setActiveTab('coding')}
      >
        <i className="fas fa-code mr-2"></i>
        Coding
      </button>
      
      <button
        className={`
          flex items-center px-4 py-2 text-sm font-medium transition-colors
          ${activeTab === 'context' 
            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }
        `}
        onClick={() => setActiveTab('context')}
      >
        <i className="fas fa-project-diagram mr-2"></i>
        Context
      </button>
    </div>
  )
}