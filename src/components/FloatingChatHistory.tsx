'use client'

import { useAppStore } from '@/store/app-store'
import { useState, useCallback, useEffect, useRef } from 'react'
import type { ChatEntry } from '@/store/slices/chat-history-slice'

interface FloatingChatHistoryProps {
  isOpen: boolean
  onClose: () => void
}

export default function FloatingChatHistory({ isOpen, onClose }: FloatingChatHistoryProps) {
  const selectedComponentId = useAppStore(state => state.selectedComponentId)
  const chatHistory = useAppStore(state => 
    selectedComponentId ? state.getChatHistory(selectedComponentId) : []
  )
  const currentIndex = useAppStore(state => 
    selectedComponentId ? state.getCurrentIndex(selectedComponentId) : -1
  )
  const navigateToEntry = useAppStore(state => state.navigateToEntry)
  const undoChat = useAppStore(state => state.undoChat)
  const redoChat = useAppStore(state => state.redoChat)
  const canUndo = useAppStore(state => 
    selectedComponentId ? state.canUndo(selectedComponentId) : false
  )
  const canRedo = useAppStore(state => 
    selectedComponentId ? state.canRedo(selectedComponentId) : false
  )
  const clearChatHistory = useAppStore(state => state.clearChatHistory)
  const showStatus = useAppStore(state => state.showStatus)
  
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())
  const [isMinimized, setIsMinimized] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (scrollRef.current && chatHistory.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatHistory.length])
  
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
  
  const handleUndo = useCallback(() => {
    if (selectedComponentId && canUndo) {
      undoChat(selectedComponentId)
      showStatus({
        message: 'Reverted to previous interaction',
        type: 'success',
        duration: 2000
      })
    }
  }, [selectedComponentId, canUndo, undoChat, showStatus])
  
  const handleRedo = useCallback(() => {
    if (selectedComponentId && canRedo) {
      redoChat(selectedComponentId)
      showStatus({
        message: 'Advanced to next interaction',
        type: 'success',
        duration: 2000
      })
    }
  }, [selectedComponentId, canRedo, redoChat, showStatus])
  
  const handleClear = useCallback(() => {
    if (selectedComponentId && chatHistory.length > 0) {
      if (confirm('Clear all chat history?\n\nNote: The current code will be preserved.')) {
        clearChatHistory(selectedComponentId)
        showStatus({
          message: 'Chat history cleared (code preserved)',
          type: 'info',
          duration: 2000
        })
      }
    }
  }, [selectedComponentId, chatHistory.length, clearChatHistory, showStatus])
  
  const handleNavigate = useCallback((index: number) => {
    if (!selectedComponentId) return
    navigateToEntry(selectedComponentId, index)
    showStatus({
      message: `Viewing interaction ${index + 1}`,
      type: 'success',
      duration: 2000
    })
  }, [selectedComponentId, navigateToEntry, showStatus])
  
  // Check if an entry is current
  const isCurrent = useCallback((index: number) => {
    return currentIndex === index
  }, [currentIndex])
  
  // Check if an entry is in the future
  const isFuture = useCallback((index: number) => {
    return currentIndex >= 0 && index > currentIndex
  }, [currentIndex])
  
  // Format timestamp
  const formatTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }, [])
  
  if (!isOpen) return null
  
  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className={`
        bg-white/70 backdrop-blur-md rounded-lg shadow-2xl border border-gray-200/50 transition-all
        ${isMinimized ? 'w-80' : 'w-96'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200/30 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 backdrop-blur-sm rounded-t-lg">
          <div className="flex items-center gap-2">
            <i className="fas fa-history text-blue-600"></i>
            <span className="font-medium text-gray-800">Chat History</span>
            {chatHistory.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                {chatHistory.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Navigation buttons */}
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="p-1.5 text-gray-600 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Undo"
            >
              <i className="fas fa-undo text-sm"></i>
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="p-1.5 text-gray-600 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Redo"
            >
              <i className="fas fa-redo text-sm"></i>
            </button>
            <button
              onClick={handleClear}
              disabled={chatHistory.length === 0}
              className="p-1.5 text-gray-600 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Clear history"
            >
              <i className="fas fa-trash text-sm"></i>
            </button>
            <div className="w-px h-4 bg-gray-300 mx-1"></div>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 text-gray-600 hover:text-gray-800 transition-colors"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              <i className={`fas fa-chevron-${isMinimized ? 'up' : 'down'} text-sm`}></i>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-600 hover:text-gray-800 transition-colors"
              title="Close"
            >
              <i className="fas fa-times text-sm"></i>
            </button>
          </div>
        </div>
        
        {/* Chat content */}
        {!isMinimized && (
          <div 
            ref={scrollRef}
            className="h-96 overflow-y-auto p-4 bg-gradient-to-b from-gray-50/50 to-white/50 backdrop-blur-sm"
          >
            {chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <i className="fas fa-comments text-4xl mb-3"></i>
                <p className="text-sm">No chat history yet</p>
                <p className="text-xs mt-1">Start generating code with AI</p>
              </div>
            ) : (
              <div className="space-y-4">
                {chatHistory.map((entry, index) => {
                  const isExpanded = expandedEntries.has(entry.id)
                  const current = isCurrent(index)
                  const future = isFuture(index)
                  
                  return (
                    <div key={entry.id} className={`${future ? 'opacity-50' : ''}`}>
                      {/* User message */}
                      <div className="flex justify-end mb-2">
                        <div className="max-w-[80%]">
                          <div className="bg-blue-500/90 backdrop-blur-sm text-white rounded-2xl rounded-br-sm px-4 py-2 shadow-sm">
                            <p className="text-sm">{entry.prompt}</p>
                          </div>
                          <div className="text-xs text-gray-400 mt-1 text-right">
                            {formatTime(entry.timestamp)}
                          </div>
                        </div>
                      </div>
                      
                      {/* AI response */}
                      <div className="flex justify-start">
                        <div className="max-w-[80%]">
                          <div className={`
                            backdrop-blur-sm border rounded-2xl rounded-bl-sm px-4 py-2 shadow-sm
                            ${current ? 'border-blue-400 bg-blue-50/80' : 'border-gray-200 bg-white/80'}
                          `}>
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <i className="fas fa-robot text-gray-500 text-sm"></i>
                                <span className="text-xs font-medium text-gray-600">
                                  AI Response
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
                              </div>
                              <button
                                onClick={() => toggleExpanded(entry.id)}
                                className="text-xs text-gray-500 hover:text-gray-700"
                                title={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                              </button>
                            </div>
                            
                            {/* Summary or description */}
                            {entry.metadata?.description && (
                              <p className="text-sm text-gray-700 mb-2">
                                {entry.metadata.description}
                              </p>
                            )}
                            
                            {/* Expanded content */}
                            {isExpanded && (
                              <div className="mt-2 pt-2 border-t border-gray-200 space-y-2">
                                {entry.metadata?.reasoning && (
                                  <div>
                                    <span className="text-xs font-medium text-gray-600">Reasoning:</span>
                                    <p className="text-xs text-gray-700 mt-1">{entry.metadata.reasoning}</p>
                                  </div>
                                )}
                                {entry.metadata?.explanation && (
                                  <div>
                                    <span className="text-xs font-medium text-gray-600">Explanation:</span>
                                    <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">
                                      {entry.metadata.explanation}
                                    </p>
                                  </div>
                                )}
                                <details className="text-xs">
                                  <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">
                                    View generated code
                                  </summary>
                                  <pre className="mt-1 p-2 bg-gray-100/70 backdrop-blur-sm rounded overflow-x-auto text-xs max-h-40">
                                    <code>{entry.generatedCode.slice(0, 500)}{entry.generatedCode.length > 500 ? '...' : ''}</code>
                                  </pre>
                                </details>
                              </div>
                            )}
                            
                            {/* Action buttons */}
                            {!current && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <button
                                  onClick={() => handleNavigate(index)}
                                  className={`
                                    text-xs px-3 py-1 rounded transition-colors
                                    ${future ? 
                                      'bg-gray-400 text-white hover:bg-gray-500' : 
                                      'bg-blue-500 text-white hover:bg-blue-600'}
                                  `}
                                >
                                  {future ? 'Go to future state' : 'Restore this version'}
                                </button>
                              </div>
                            )}
                            
                            {future && (
                              <div className="mt-2 p-2 bg-yellow-50/70 backdrop-blur-sm border border-yellow-100 rounded text-xs text-yellow-700">
                                <i className="fas fa-info-circle mr-1"></i>
                                Future entry - will be deleted if new code is generated
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        
        {/* Footer status */}
        {!isMinimized && chatHistory.length > 0 && (
          <div className="px-3 py-2 border-t border-gray-200/30 bg-gray-50/70 backdrop-blur-sm rounded-b-lg">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>
                Viewing: {currentIndex >= 0 ? currentIndex + 1 : chatHistory.length} of {chatHistory.length}
              </span>
              <span>
                {selectedComponentId ? `Component: ${selectedComponentId.slice(0, 8)}...` : 'No component selected'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}