'use client'

import { useAppStore } from '@/store/app-store'
import { useEffect, useRef, useState, useMemo } from 'react'
import SimplifiedCanvas from './SimplifiedCanvas'
import { processContextData, sliceProcessedContextByComponents, generateMarkdownTemplate } from '@/lib/context-utils'
import { computeContextFromSelection } from '@/lib/graph-traversal'

export default function AIContextOverlay() {
  const showAIContextModal = useAppStore(state => state.showAIContextModal)
  const aiManualContextEnabled = useAppStore(state => state.aiManualContextEnabled)
  const aiSelectedGuids = useAppStore(state => state.aiSelectedGuids)
  const aiUpstreamLevels = useAppStore(state => state.aiUpstreamLevels)
  const aiDownstreamLevels = useAppStore(state => state.aiDownstreamLevels)
  const aiContextData = useAppStore(state => state.aiContextData)
  
  const setAIManualContextEnabled = useAppStore(state => state.setAIManualContextEnabled)
  const fetchAISelection = useAppStore(state => state.fetchAISelection)
  const fetchAIContext = useAppStore(state => state.fetchAIContext)
  const setAIUpstreamLevels = useAppStore(state => state.setAIUpstreamLevels)
  const setAIDownstreamLevels = useAppStore(state => state.setAIDownstreamLevels)
  const setAISelectedGuids = useAppStore(state => state.setAISelectedGuids)
  const toggleAIContextModal = useAppStore(state => state.toggleAIContextModal)
  const clearAISelection = useAppStore(state => state.clearAISelection)
  
  const [contextLoading, setContextLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'text' | 'visual'>('visual')
  const scrollRef = useRef<HTMLDivElement>(null)
  
  // Check if current component is in selection
  const selectedComponentId = useAppStore(state => state.selectedComponentId)
  
  // Process AI context data for display (separate from main Context tab)
  const { displayContext, coreGuids, extendedGuids, markdownContent } = useMemo(() => {
    if (!aiContextData || aiSelectedGuids.length === 0) {
      return { displayContext: null, coreGuids: [], extendedGuids: [], markdownContent: '' }
    }
    
    const processedContext = processContextData(aiContextData)
    if (!processedContext) {
      return { displayContext: null, coreGuids: [], extendedGuids: [], markdownContent: '' }
    }
    
    // Compute full selection with traversal
    const fullSelection = computeContextFromSelection(
      aiSelectedGuids,
      aiUpstreamLevels,
      aiDownstreamLevels,
      processedContext
    )
    
    // Slice context to only include relevant components
    const slicedContext = sliceProcessedContextByComponents(processedContext, fullSelection)
    
    // Generate markdown for text view
    const markdown = generateMarkdownTemplate(slicedContext, 'standard')
    
    // Separate core from extended selection for visualization
    const coreSet = new Set(aiSelectedGuids)
    const extended = fullSelection.filter(guid => !coreSet.has(guid))
    
    return {
      displayContext: slicedContext,
      coreGuids: aiSelectedGuids,
      extendedGuids: extended,
      markdownContent: markdown
    }
  }, [aiContextData, aiSelectedGuids, aiUpstreamLevels, aiDownstreamLevels])
  
  // Token estimation
  const estimatedTokens = useMemo(() => {
    return Math.ceil(markdownContent.length / 4)
  }, [markdownContent])
  
  // Fetch AI context when first opening or when no selection exists
  useEffect(() => {
    if (showAIContextModal && !aiContextData) {
      handleFetchContext()
    }
    // If we have no selection when opening, use current component
    if (showAIContextModal && aiSelectedGuids.length === 0) {
      if (selectedComponentId) {
        setAISelectedGuids([selectedComponentId])
      }
    }
  }, [showAIContextModal, selectedComponentId])
  
  // Auto-update selection when in "Current Component" mode and component changes
  useEffect(() => {
    if (!aiManualContextEnabled && selectedComponentId) {
      setAISelectedGuids([selectedComponentId])
    }
  }, [selectedComponentId, aiManualContextEnabled])
  
  const handleFetchContext = async () => {
    setContextLoading(true)
    await fetchAIContext()
    setContextLoading(false)
  }
  
  const handleFetchSelection = async () => {
    await fetchAISelection()
  }
  
  const handleSwitchToCurrentComponent = () => {
    setAIManualContextEnabled(false)
    // Switch selection back to the current component
    if (selectedComponentId) {
      setAISelectedGuids([selectedComponentId])
    }
  }
  
  const handleSwitchToManualSelection = () => {
    setAIManualContextEnabled(true)
    // Keep the existing selection when switching to manual mode
  }
  
  if (!showAIContextModal) return null
  
  return (
    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-[600px]" style={{zIndex: 100}}>
      <div className="bg-purple-400/30 backdrop-blur-lg rounded-lg shadow-xl border border-purple-300/30">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-purple-300/30">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-800">AI Context Control</span>
            {aiSelectedGuids.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 bg-purple-500/50 text-white rounded-full">
                {aiSelectedGuids.length}
              </span>
            )}
            {estimatedTokens > 0 && (
              <span className="text-xs px-1.5 py-0.5 bg-purple-400/50 text-white rounded-full">
                ~{estimatedTokens} tokens
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFetchContext}
              disabled={contextLoading}
              className="p-1.5 text-gray-700 hover:text-purple-700 transition-colors"
              title="Refresh Context"
            >
              {contextLoading ? (
                <i className="fas fa-spinner fa-spin text-sm"></i>
              ) : (
                <i className="fas fa-sync-alt text-sm"></i>
              )}
            </button>
            <button
              onClick={toggleAIContextModal}
              className="p-1.5 text-gray-700 hover:text-gray-900 transition-colors"
              title="Close"
            >
              <i className="fas fa-times text-sm"></i>
            </button>
          </div>
        </div>
        
        {/* Simplified Controls */}
        <div className="p-3 space-y-3 bg-white/20">
          {/* Context Source Toggle */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 font-medium">Context Source:</span>
            <div className="flex gap-2 items-center">
              <button
                onClick={handleSwitchToCurrentComponent}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  !aiManualContextEnabled 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                Current Component
              </button>
              <button
                onClick={handleSwitchToManualSelection}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  aiManualContextEnabled 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                Manual Selection
              </button>
              {aiManualContextEnabled && (
                <button
                  onClick={handleFetchSelection}
                  className="px-2 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600 flex items-center gap-1 ml-1"
                  title="Get GH Selection"
                >
                  <i className="fas fa-mouse-pointer text-xs"></i>
                  <span>Get</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Compact Sliders */}
          <div className="flex gap-3">
            <div className="flex items-center gap-2 flex-1">
              <i className="fas fa-arrow-up text-green-600 text-xs"></i>
              <span className="text-xs text-gray-600">Up</span>
              <input
                type="range"
                min="1"
                max="3"
                value={aiUpstreamLevels}
                onChange={(e) => setAIUpstreamLevels(Number(e.target.value))}
                className="flex-1 h-4"
                title={`Upstream levels: ${aiUpstreamLevels}`}
              />
              <span className="text-xs text-gray-700 w-3">{aiUpstreamLevels}</span>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <i className="fas fa-arrow-down text-orange-600 text-xs"></i>
              <span className="text-xs text-gray-600">Down</span>
              <input
                type="range"
                min="1"
                max="3"
                value={aiDownstreamLevels}
                onChange={(e) => setAIDownstreamLevels(Number(e.target.value))}
                className="flex-1 h-4"
                title={`Downstream levels: ${aiDownstreamLevels}`}
              />
              <span className="text-xs text-gray-700 w-3">{aiDownstreamLevels}</span>
            </div>
          </div>
        </div>
        
        {/* Context Display */}
        <div 
          ref={scrollRef}
          className="overflow-auto border-t border-purple-300/30 bg-white/10"
          style={{ maxHeight: '300px' }}
        >
          {displayContext ? (
            viewMode === 'text' ? (
              // Markdown Text View
              <div className="p-3">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                  {markdownContent}
                </pre>
              </div>
            ) : (
              // Visual Canvas View - using simplified component
              <div className="p-3">
                <SimplifiedCanvas
                  processedContext={displayContext}
                  selectedGuids={coreGuids}
                  extendedGuids={extendedGuids}
                  scale={0.9}
                />
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500">
              <i className="fas fa-sitemap text-2xl mb-2"></i>
              <p className="text-sm">No context loaded</p>
              <p className="text-xs mt-1">Click "Refresh Context" to start</p>
            </div>
          )}
        </div>
        
        {/* View Mode Toggle - Bottom Center */}
        <div className="flex justify-center border-t border-purple-300/30 bg-purple-400/20 py-2">
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('text')}
              className={`px-3 py-1 rounded-l text-xs transition-colors ${
                viewMode === 'text' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              <i className="fas fa-code mr-1"></i>
              Markdown
            </button>
            <button
              onClick={() => setViewMode('visual')}
              className={`px-3 py-1 rounded-r text-xs transition-colors ${
                viewMode === 'visual' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              <i className="fas fa-project-diagram mr-1"></i>
              Canvas
            </button>
          </div>
        </div>
        
        {/* Footer Status */}
        {displayContext && (
          <div className="px-3 py-2 border-t border-purple-300/30 bg-purple-400/20 text-xs text-gray-600 flex justify-between">
            <span>{displayContext.components.length} components</span>
            <span>{coreGuids.length} selected + {extendedGuids.length} traversed</span>
          </div>
        )}
        
        {/* Speech bubble tail */}
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
          <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-purple-400/30"></div>
        </div>
      </div>
    </div>
  )
}