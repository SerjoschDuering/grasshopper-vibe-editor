'use client'

import { useAppStore } from '@/store/app-store'
import { useState, useCallback } from 'react'
import type { ChatEntry } from '@/store/slices/chat-history-slice'

export default function ChatHistory() {
  const selectedComponentId = useAppStore(state => state.selectedComponentId)
  const chatHistory = useAppStore(state => 
    selectedComponentId ? state.getChatHistory(selectedComponentId) : []
  )
  const currentIndex = useAppStore(state => 
    selectedComponentId ? state.getCurrentIndex(selectedComponentId) : -1
  )
  const navigateToEntry = useAppStore(state => state.navigateToEntry)
  const showStatus = useAppStore(state => state.showStatus)
  
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())
  
  const toggleExpanded = useCallback((id: string) => {
    setExpandedEntries(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(id)) {
        newExpanded.delete(id)
      } else {
        newExpanded.add(id)
      }
      return newExpanded
    })
  }, [])
  
  const handleNavigate = useCallback((index: number) => {
    if (!selectedComponentId) return
    
    try {
      navigateToEntry(selectedComponentId, index)
      showStatus({
        message: `Viewing interaction ${index + 1}`,
        type: 'success',
        duration: 2000
      })
    } catch (error) {
      console.error('Error navigating to entry:', error)
      showStatus({
        message: 'Failed to navigate to entry',
        type: 'error',
        duration: 3000
      })
    }
  }, [selectedComponentId, navigateToEntry, showStatus])
  
  // Check if an entry is current
  const isCurrent = useCallback((index: number) => {
    return currentIndex === index
  }, [currentIndex])
  
  // Check if an entry is in the future (grayed out)
  const isFuture = useCallback((index: number) => {
    return currentIndex >= 0 && index > currentIndex
  }, [currentIndex])
  
  // Format timestamp
  const formatTime = useCallback((timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleTimeString()
    } catch {
      return 'Unknown time'
    }
  }, [])
  
  // Truncate text safely
  const truncateText = useCallback((text: string | undefined, maxLength: number) => {
    if (!text) return ''
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
  }, [])
  
  if (!selectedComponentId || chatHistory.length === 0) {
    return (
      <div className="p-3 text-center text-gray-500 text-sm">
        No chat history for this component
      </div>
    )
  }
  
  return (
    <div className="chat-history p-2 space-y-2 max-h-96 overflow-y-auto">
      {chatHistory.map((entry, index) => {
        const isExpanded = expandedEntries.has(entry.id)
        const current = isCurrent(index)
        const future = isFuture(index)
        
        return (
          <div 
            key={entry.id}
            className={`
              border rounded p-2 transition-all
              ${current ? 'border-blue-400 bg-blue-50' : 
                future ? 'border-gray-200 bg-gray-50 opacity-60' : 
                'border-gray-200 hover:border-gray-300'}
            `}
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-600">
                    Interaction {index + 1}
                  </span>
                  {current && (
                    <span className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded">
                      Current
                    </span>
                  )}
                  {future && (
                    <span className="text-xs px-1.5 py-0.5 bg-gray-400 text-white rounded">
                      Future
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
                <div className="text-xs text-gray-700 font-medium mb-1">
                  Prompt: {truncateText(entry.prompt, 100)}
                </div>
                {entry.metadata?.description && (
                  <div className="text-xs text-gray-600">
                    Component: {entry.metadata.description}
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => toggleExpanded(entry.id)}
                  className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800 transition-colors"
                  title={isExpanded ? 'Collapse' : 'Expand'}
                  aria-expanded={isExpanded}
                >
                  <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`} aria-hidden="true"></i>
                </button>
                {!current && (
                  <button
                    onClick={() => handleNavigate(index)}
                    className={`
                      text-xs px-2 py-1 rounded transition-colors
                      ${future ? 
                        'bg-gray-400 text-white hover:bg-gray-500' : 
                        'bg-blue-500 text-white hover:bg-blue-600'}
                    `}
                    title={future ? 'Go to future state' : 'Go to this state'}
                  >
                    {future ? 'Forward' : 'Go to'}
                  </button>
                )}
              </div>
            </div>
            
            {isExpanded && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                {entry.metadata?.reasoning && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-gray-600">Reasoning:</span>
                    <div className="text-xs text-gray-700 mt-1">{entry.metadata.reasoning}</div>
                  </div>
                )}
                {entry.metadata?.explanation && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-gray-600">Explanation:</span>
                    <div className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">
                      {entry.metadata.explanation}
                    </div>
                  </div>
                )}
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">
                    View generated code
                  </summary>
                  <pre className="mt-1 p-2 bg-gray-100 rounded overflow-x-auto text-xs">
                    <code>{truncateText(entry.generatedCode, 500)}</code>
                  </pre>
                </details>
                {future && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                    <i className="fas fa-exclamation-triangle text-yellow-600 mr-1"></i>
                    This is a future entry. If you generate new code now, this and all subsequent entries will be deleted.
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}