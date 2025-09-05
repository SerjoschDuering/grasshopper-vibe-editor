'use client'

import { useAppStore } from '@/store/app-store'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getEnabledContextProviders, setContextProviderEnabled, MODEL_CONFIG, type AIContextProvider, type ModelId } from '@/lib/openai-api'
import { processImageForAI, isValidImageFile, formatFileSize } from '@/lib/image-utils'
import type { ChatEntry } from '@/store/slices/chat-history-slice'
import AIContextOverlay from './AIContextOverlay'

export default function AIPanel() {
  const aiPrompt = useAppStore(state => state.aiPrompt)
  const setAiPrompt = useAppStore(state => state.setAiPrompt)
  const aiGenerateParams = useAppStore(state => state.aiGenerateParams)
  const setAiGenerateParams = useAppStore(state => state.setAiGenerateParams)
  const aiModel = useAppStore(state => state.aiModel)
  const setAiModel = useAppStore(state => state.setAiModel)
  const aiImage = useAppStore(state => state.aiImage)
  const setAiImage = useAppStore(state => state.setAiImage)
  const generateWithAI = useAppStore(state => state.generateWithAI)
  const loading = useAppStore(state => state.loading)
  const apiKey = useAppStore(state => state.apiKey)
  const aiExplanation = useAppStore(state => state.aiExplanation)
  
  // Chat history functionality - using simplified methods
  const selectedComponentId = useAppStore(state => state.selectedComponentId)
  const chatHistory = useAppStore(state => 
    selectedComponentId ? state.getChatHistory(selectedComponentId) : []
  )
  const chatHistoryLength = chatHistory.length
  const canUndo = useAppStore(state => 
    selectedComponentId ? state.canUndo(selectedComponentId) : false
  )
  const canRedo = useAppStore(state => 
    selectedComponentId ? state.canRedo(selectedComponentId) : false
  )
  const undoChat = useAppStore(state => state.undoChat)
  const redoChat = useAppStore(state => state.redoChat)
  const clearChatHistory = useAppStore(state => state.clearChatHistory)
  const navigateToEntry = useAppStore(state => state.navigateToEntry)
  const currentIndex = useAppStore(state => 
    selectedComponentId ? state.getCurrentIndex(selectedComponentId) : -1
  )
  const showHistory = useAppStore(state => state.showChatHistory)
  const setShowHistory = useAppStore(state => state.setShowChatHistory)
  const toggleAIContextModal = useAppStore(state => state.toggleAIContextModal)
  const aiManualContextEnabled = useAppStore(state => state.aiManualContextEnabled)
  const aiSelectedGuids = useAppStore(state => state.aiSelectedGuids)
  
  const [showSettings, setShowSettings] = useState(false)
  const [contextProviders, setContextProviders] = useState<AIContextProvider[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [imageProcessing, setImageProcessing] = useState(false)
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  
  // Initialize context providers after mount
  useEffect(() => {
    setContextProviders(getEnabledContextProviders())
  }, [])

  // (Speech bubble handled in page header; none here)

  const handleGenerateAI = async () => {
    if (!apiKey) {
      useAppStore.getState().showStatus({
        message: 'Please enter an OpenAI API key',
        type: 'error',
        duration: 3000
      })
      return
    }

    if (!aiPrompt || aiPrompt.trim().length < 10) {
      useAppStore.getState().showStatus({
        message: 'Please enter a prompt (at least 10 characters)',
        type: 'error',
        duration: 3000
      })
      return
    }

    await generateWithAI()
  }

  const toggleProvider = (providerId: string) => {
    const provider = contextProviders.find(p => p.id === providerId)
    if (provider) {
      setContextProviderEnabled(providerId, !provider.enabled)
      setContextProviders(getEnabledContextProviders())
    }
  }

  // Image upload handlers
  const handleImageUpload = useCallback(async (file: File) => {
    if (!isValidImageFile(file)) {
      useAppStore.getState().showStatus({
        message: 'Please select a valid image file (max 10MB)',
        type: 'error',
        duration: 3000
      })
      return
    }

    setImageProcessing(true)
    try {
      const processedImage = await processImageForAI(file)
      setAiImage(processedImage)
      useAppStore.getState().showStatus({
        message: 'Image uploaded successfully',
        type: 'success',
        duration: 2000
      })
    } catch (error) {
      useAppStore.getState().showStatus({
        message: 'Failed to process image: ' + (error as Error).message,
        type: 'error',
        duration: 3000
      })
    } finally {
      setImageProcessing(false)
    }
  }, [setAiImage])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleImageUpload(files[0])
    }
  }, [handleImageUpload])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleImageUpload(files[0])
    }
    // Clear the input so the same file can be selected again
    e.target.value = ''
  }, [handleImageUpload])

  const removeImage = useCallback(() => {
    setAiImage(null)
  }, [setAiImage])

  // Handle undo/redo with simplified methods
  const handleUndo = useCallback(() => {
    if (selectedComponentId && canUndo) {
      const success = undoChat(selectedComponentId)
      if (success) {
        useAppStore.getState().showStatus({
          message: 'Reverted to previous interaction',
          type: 'success',
          duration: 2000
        })
      }
    }
  }, [selectedComponentId, canUndo, undoChat])

  const handleRedo = useCallback(() => {
    if (selectedComponentId && canRedo) {
      const success = redoChat(selectedComponentId)
      if (success) {
        useAppStore.getState().showStatus({
          message: 'Advanced to next interaction',
          type: 'success',
          duration: 2000
        })
      }
    }
  }, [selectedComponentId, canRedo, redoChat])

  const handleClearHistory = useCallback(() => {
    if (selectedComponentId && chatHistoryLength > 0) {
      if (confirm('Clear all chat history for this component?\n\nNote: The current code will be preserved.')) {
        clearChatHistory(selectedComponentId)
        useAppStore.getState().showStatus({
          message: 'Chat history cleared (code preserved)',
          type: 'info',
          duration: 2000
        })
      }
    }
  }, [selectedComponentId, chatHistoryLength, clearChatHistory])

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
    navigateToEntry(selectedComponentId, index)
    useAppStore.getState().showStatus({
      message: `Viewing interaction ${index + 1}`,
      type: 'success',
      duration: 2000
    })
  }, [selectedComponentId, navigateToEntry])

  const isCurrent = useCallback((index: number) => {
    return currentIndex === index
  }, [currentIndex])

  const isFuture = useCallback((index: number) => {
    return currentIndex >= 0 && index > currentIndex
  }, [currentIndex])

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

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (scrollRef.current && chatHistory.length > 0 && showHistory) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatHistory.length, showHistory])

  return (
    <div className="ai-panel">
      {/* Context Settings (collapsible) */}
      {showSettings && (
        <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200">
          <h4 className="text-xs font-medium mb-2 text-gray-700">Context Providers</h4>
          <div className="space-y-1">
            {contextProviders.map(provider => (
              <label key={provider.id} className="flex items-center text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={provider.enabled}
                  onChange={() => toggleProvider(provider.id)}
                  className="mr-1.5"
                />
                <span className="text-gray-600">{provider.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Model selection moved to header pill */}

      {/* Prompt Input with Image Upload */}
      <div className="mb-3 relative">
        <div className="relative mb-1">
          <label htmlFor="ai-prompt" className="text-sm font-medium">
            Prompt
          </label>
          {/* Control Buttons - Centered with relative positioning for floating panels */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
            {/* Chat History Button with floating panel */}
            <div className="relative">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="px-3 py-1 bg-slate-400/60 backdrop-blur-sm hover:bg-slate-400/70 text-white rounded-full text-xs font-medium transition-all inline-flex items-center gap-1.5 shadow-sm"
              >
                <i className="fas fa-history text-[10px]"></i>
                <span>Chat History</span>
                {chatHistoryLength > 0 && (
                  <span className="bg-slate-500/80 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {chatHistoryLength}
                  </span>
                )}
              </button>
              
              {/* Floating Chat History Panel - positioned above button */}
              {showHistory && (
                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 z-50 w-[400px]">
                  <div className="bg-slate-400/30 backdrop-blur-lg rounded-lg shadow-xl border border-slate-300/30">
                    {/* Header */}
                    <div className="flex items-center justify-between p-3 border-b border-slate-300/30">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">Chat History</span>
                        <span className="text-xs px-1.5 py-0.5 bg-slate-500/50 text-white rounded-full">
                          {chatHistoryLength}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleUndo}
                          disabled={!canUndo}
                          className="p-1.5 text-gray-700 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Undo"
                        >
                          <i className="fas fa-undo text-sm"></i>
                        </button>
                        <button
                          onClick={handleRedo}
                          disabled={!canRedo}
                          className="p-1.5 text-gray-700 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Redo"
                        >
                          <i className="fas fa-redo text-sm"></i>
                        </button>
                        <button
                          onClick={handleClearHistory}
                          className="p-1.5 text-gray-700 hover:text-red-600 transition-colors"
                          title="Clear history"
                        >
                          <i className="fas fa-trash text-sm"></i>
                        </button>
                        <div className="w-px h-4 bg-slate-400 mx-1"></div>
                        <button
                          onClick={() => setShowHistory(false)}
                          className="p-1.5 text-gray-700 hover:text-gray-900 transition-colors"
                          title="Close"
                        >
                          <i className="fas fa-times text-sm"></i>
                        </button>
                      </div>
                    </div>
                    
                    {/* Chat content */}
                    <div 
                      ref={scrollRef}
                      className="overflow-y-auto p-3"
                      style={{ maxHeight: '400px' }}
                    >
                      <div className="space-y-3">
                        {chatHistory.map((entry: ChatEntry, index: number) => {
                          const isExpanded = expandedEntries.has(entry.id)
                          const current = isCurrent(index)
                          const future = isFuture(index)
                          
                          return (
                            <div key={entry.id} className={`${future ? 'opacity-50' : ''}`}>
                              {/* User message */}
                              <div className="flex justify-end mb-1.5">
                                <div className="max-w-[85%]">
                                  <div className="bg-blue-500 text-white rounded-lg rounded-br-sm px-3 py-1.5 shadow-sm">
                                    <p className="text-xs whitespace-pre-wrap break-words">{entry.prompt}</p>
                                  </div>
                                  <div className="text-[10px] text-slate-600 mt-0.5 text-right">
                                    {formatTime(entry.timestamp)}
                                  </div>
                                </div>
                              </div>
                              
                              {/* AI response */}
                              <div className="flex justify-start">
                                <div className="max-w-[85%]">
                                  <div className={`
                                    bg-white/90 border rounded-lg rounded-bl-sm px-3 py-1.5 shadow-sm
                                    ${current ? 'border-blue-400 ring-1 ring-blue-400/50' : 'border-gray-300'}
                                  `}>
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-1.5">
                                        <i className="fas fa-robot text-gray-500 text-[10px]"></i>
                                        <span className="text-[10px] font-medium text-gray-600">AI</span>
                                        {current && (
                                          <span className="text-[9px] px-1 py-0.5 bg-blue-500 text-white rounded">
                                            Current
                                          </span>
                                        )}
                                        {future && (
                                          <span className="text-[9px] px-1 py-0.5 bg-gray-400 text-white rounded">
                                            Future
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => toggleExpanded(entry.id)}
                                        className="text-xs text-gray-500 hover:text-gray-700"
                                      >
                                        <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-[9px]`}></i>
                                      </button>
                                    </div>
                                    
                                    {entry.metadata?.description && (
                                      <p className="text-[11px] text-gray-700 whitespace-pre-wrap break-words">
                                        {entry.metadata.description}
                                      </p>
                                    )}
                                    
                                    {isExpanded && (
                                      <div className="mt-1.5 pt-1.5 border-t border-gray-200">
                                        {!current && (
                                          <button
                                            onClick={() => handleNavigate(index)}
                                            className={`
                                              text-[10px] px-2 py-0.5 rounded transition-colors
                                              ${future ? 
                                                'bg-gray-400 text-white hover:bg-gray-500' : 
                                                'bg-blue-500 text-white hover:bg-blue-600'}
                                            `}
                                          >
                                            {future ? 'Go forward' : 'Restore'}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    
                    {/* Speech bubble tail pointing down */}
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                      <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-slate-400/30"></div>
                    </div>
                  </div>
                </div>
              )}  
            </div>
            {/* AI Context Button with floating panel */}
            <div className="relative">
              <button
                onClick={toggleAIContextModal}
                className={`px-3 py-1 ${aiManualContextEnabled ? 'bg-purple-500/70' : 'bg-purple-400/60'} backdrop-blur-sm hover:bg-purple-500/80 text-white rounded-full text-xs font-medium transition-all inline-flex items-center gap-1.5 shadow-sm`}
              >
                <i className="fas fa-brain text-[10px]"></i>
                <span>AI Context</span>
                {aiSelectedGuids.length > 0 && (
                  <span className="bg-purple-600/80 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {aiSelectedGuids.length}
                  </span>
                )}
                {aiManualContextEnabled && (
                  <i className="fas fa-check-circle text-[10px] text-green-300"></i>
                )}
              </button>
              
              {/* AI Context Floating Panel */}
              <AIContextOverlay />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Prompt textarea */}
          <textarea
            id="ai-prompt"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g., 'Create a script that takes a list of points and outputs their Z values.'"
            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            rows={4}
          />
          
          {/* Image upload area */}
          <div className="w-12 flex flex-col">
            {aiImage ? (
              // Show uploaded image
              <div className="relative border border-gray-300 rounded bg-gray-50 h-full min-h-[4rem]">
                <img 
                  src={aiImage} 
                  alt="Reference" 
                  className="w-full h-full object-cover rounded"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors flex items-center justify-center"
                  title="Remove image"
                >
                  ×
                </button>
              </div>
            ) : (
              // Show upload area
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  h-full min-h-[4rem] border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer transition-colors
                  ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                  ${imageProcessing ? 'opacity-50 pointer-events-none' : ''}
                `}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="image-upload"
                  disabled={imageProcessing}
                />
                <label htmlFor="image-upload" className="cursor-pointer h-full w-full flex flex-col items-center justify-center p-1">
                  {imageProcessing ? (
                    <i className="fas fa-spinner fa-spin text-gray-500 text-xs"></i>
                  ) : (
                    <div className="text-center">
                      <i className="fas fa-image text-gray-400 text-sm mb-1"></i>
                      <div className="text-xs text-gray-500 leading-tight">Drop or click</div>
                    </div>
                  )}
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generate Parameters Option */}
      <div className="mb-3 flex items-center justify-between">
        <label className="flex items-center text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={aiGenerateParams}
            onChange={(e) => setAiGenerateParams(e.target.checked)}
            className="mr-2"
          />
          <span className="text-gray-700">Generate/Update Input/Output Parameters</span>
        </label>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
          title="AI Context Settings"
        >
          <i className="fas fa-cog text-xs"></i>
        </button>
      </div>

      {/* Action Button */}
      <button
        onClick={handleGenerateAI}
        disabled={loading.ai || !apiKey || !aiPrompt}
        className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm font-medium"
      >
        {loading.ai ? (
          <>
            <i className="fas fa-spinner fa-spin text-sm"></i>
            <span>Generating...</span>
          </>
        ) : (
          <>
            <i className="fas fa-magic text-sm"></i>
            <span>Generate with AI</span>
          </>
        )}
      </button>

    </div>
  )
}