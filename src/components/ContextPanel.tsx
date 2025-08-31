'use client'

import { useEffect, useRef, useMemo } from 'react'
import { useAppStore } from '@/store/app-store'
import { processContextData, ProcessedContext, sliceProcessedContextByComponents } from '@/lib/context-utils'
import { filterComponentsBySelection, computeContextFromSelection } from '@/lib/graph-traversal'
import ContextControls from './ContextControls'
import ContextViewer from './ContextViewer'

export default function ContextPanel() {
  const contextData = useAppStore(state => state.contextData)
  const contextAutoRefresh = useAppStore(state => state.contextAutoRefresh)
  const contextViewMode = useAppStore(state => state.contextViewMode)
  
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
  
  // Derive display context reactively
  const { displayContext, displayComponents, extendedGuids } = useMemo(() => {
    let ctx = processedContext
    let comps = processedContext?.components || []
    let ext: string[] = []
    if (processedContext && selectedComponentGuids.length > 0) {
      const fullSet = computeContextFromSelection(
        selectedComponentGuids,
        contextUpstreamLevels,
        contextDownstreamLevels,
        processedContext
      )
      if (process.env.NODE_ENV !== 'production') {
        try { console.debug('[ContextPanel] traversal set size=%d (core=%d, up=%d, down=%d)', fullSet.length, selectedComponentGuids.length, contextUpstreamLevels, contextDownstreamLevels) } catch {}
      }
      const core = new Set(selectedComponentGuids)
      ext = fullSet.filter(g => !core.has(g))
      if (contextViewMode === 'selection') {
        const sliced = sliceProcessedContextByComponents(processedContext, fullSet)
        ctx = sliced
        comps = sliced.components
      }
    }
    return { displayContext: ctx, displayComponents: comps, extendedGuids: ext }
  }, [processedContext, selectedComponentGuids, contextUpstreamLevels, contextDownstreamLevels, contextViewMode])
  
  return (
    <div className="space-y-4">
      {/* Unified Controls */}
      <ContextControls />
      
      {/* Unified Viewer */}
      <ContextViewer 
        processedContext={displayContext}
        filteredComponents={displayComponents}
        selectedComponentGuids={selectedComponentGuids}
        extendedSelectedGuids={extendedGuids}
      />
    </div>
  )
}