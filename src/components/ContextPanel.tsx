'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/app-store'
import { processContextData, ProcessedContext } from '@/lib/context-utils'
import { filterComponentsBySelection, computeContextFromSelection } from '@/lib/graph-traversal'
import ContextControls from './ContextControls'
import ContextViewer from './ContextViewer'

export default function ContextPanel() {
  const contextData = useAppStore(state => state.contextData)
  const contextAutoRefresh = useAppStore(state => state.contextAutoRefresh)
  
  // Selection state
  const selectedComponentGuids = useAppStore(state => state.selectedComponentGuids)
  const contextUpstreamLevels = useAppStore(state => state.contextUpstreamLevels)
  const contextDownstreamLevels = useAppStore(state => state.contextDownstreamLevels)
  
  const fetchContext = useAppStore(state => state.fetchContext)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Auto-refresh effect
  useEffect(() => {
    if (contextAutoRefresh) {
      fetchContext() // Initial fetch
      intervalRef.current = setInterval(fetchContext, 5000) // Refresh every 5 seconds
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [contextAutoRefresh, fetchContext])
  
  // Process context data
  const processedContext: ProcessedContext | null = contextData ? processContextData(contextData) : null
  
  // Filter components by selection/traversal
  // Always show the full graph in text/canvas; we'll only highlight selection in the canvas
  let filteredComponents = processedContext?.components || []
  let extendedSelectedGuids: string[] = []
  
  // Apply selection-based filtering if there's a selection
  if (processedContext && selectedComponentGuids.length > 0) {
    // Compute extended selection (upstream/downstream) distinct from core selection
    const fullSet = computeContextFromSelection(
      selectedComponentGuids,
      contextUpstreamLevels,
      contextDownstreamLevels,
      processedContext
    )
    const coreSet = new Set(selectedComponentGuids)
    extendedSelectedGuids = fullSet.filter(g => !coreSet.has(g))

  }
  
  return (
    <div className="space-y-4">
      {/* Unified Controls */}
      <ContextControls />
      
      {/* Unified Viewer */}
      <ContextViewer 
        processedContext={processedContext}
        filteredComponents={filteredComponents}
        selectedComponentGuids={selectedComponentGuids}
        extendedSelectedGuids={extendedSelectedGuids}
      />
    </div>
  )
}