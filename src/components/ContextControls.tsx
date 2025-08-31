'use client'

import React from 'react'
import { useAppStore } from '@/store/app-store'

export default function ContextControls() {
  const contextLoading = useAppStore(state => state.contextLoading)
  const contextAutoRefresh = useAppStore(state => state.contextAutoRefresh)
  const selectedComponentGuids = useAppStore(state => state.selectedComponentGuids)
  const contextUpstreamLevels = useAppStore(state => state.contextUpstreamLevels)
  const contextDownstreamLevels = useAppStore(state => state.contextDownstreamLevels)
  const contextDetailLevel = useAppStore(state => state.contextDetailLevel)
  const contextSize = useAppStore(state => state.contextSize)
  const contextViewMode = useAppStore(state => state.contextViewMode)
  const setContextViewMode = useAppStore(state => state.setContextViewMode)

  const fetchContext = useAppStore(state => state.fetchContext)
  const fetchSelection = useAppStore(state => state.fetchSelection)
  const clearSelection = useAppStore(state => state.clearSelection)
  const toggleContextAutoRefresh = useAppStore(state => state.toggleContextAutoRefresh)
  const setUpstreamLevels = useAppStore(state => state.setUpstreamLevels)
  const setDownstreamLevels = useAppStore(state => state.setDownstreamLevels)
  // Removed detail controls from this bar per UX request

  return (<div className="card p-3">
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={fetchContext} disabled={contextLoading} className="btn btn-primary btn-sm">
          {contextLoading ? (<><i className="fas fa-spinner fa-spin mr-1"></i>Loading...</>) : (<><i className="fas fa-sitemap mr-1"></i>Get Context</>)}
        </button>
        <div className="flex items-center gap-2 px-2 py-1 rounded border border-gray-200 bg-white/60">
          <button onClick={fetchSelection} className="btn btn-secondary btn-sm">
            <i className="fas fa-mouse-pointer mr-1"></i>Get Selection
          </button>
          <div className="flex items-center">
            <i className="fas fa-arrow-up text-green-600 mr-1 text-xs"></i>
            <label className="text-xs mr-2">Up {contextUpstreamLevels}</label>
            <input type="range" min="0" max="10" value={contextUpstreamLevels} onChange={(e) => setUpstreamLevels(Number(e.target.value))} className="w-20" style={{ height: '20px' }} />
          </div>
          <div className="flex items-center">
            <i className="fas fa-arrow-down text-orange-600 mr-1 text-xs"></i>
            <label className="text-xs mr-2">Down {contextDownstreamLevels}</label>
            <input type="range" min="0" max="10" value={contextDownstreamLevels} onChange={(e) => setDownstreamLevels(Number(e.target.value))} className="w-20" style={{ height: '20px' }} />
          </div>
        </div>
        {selectedComponentGuids.length > 0 && (<>
          <button onClick={clearSelection} className="btn btn-secondary btn-sm"><i className="fas fa-times mr-1"></i>Clear</button>
          <span className="text-sm text-gray-600">{selectedComponentGuids.length} selected</span>
        </>)}
        <div className="flex items-center ml-auto gap-3">
          {/* View mode toggle */}
          <div className="flex items-center gap-2 px-2 py-1 rounded border border-gray-200 bg-white/60">
            <span className="text-xs text-gray-600">View</span>
            <div className="btn-group">
              <button onClick={() => setContextViewMode('selection')} className={`btn btn-xs ${contextViewMode === 'selection' ? 'btn-primary' : 'btn-secondary'}`}>Selection</button>
              <button onClick={() => setContextViewMode('full')} className={`btn btn-xs ${contextViewMode === 'full' ? 'btn-primary' : 'btn-secondary'}`}>Full</button>
            </div>
          </div>
          <input type="checkbox" id="auto-refresh" checked={contextAutoRefresh} onChange={toggleContextAutoRefresh} className="mr-2" />
          <label htmlFor="auto-refresh" className="text-sm">Auto Refresh</label>
        </div>
      </div>
      {selectedComponentGuids.length > 0 && (
        <div className="ml-auto text-xs text-gray-600">
          <span>{contextSize.componentCount} components</span>
          <span className="mx-2">•</span>
          <span>~{contextSize.estimatedTokens.toLocaleString()} tokens</span>
        </div>
      )}
    </div>
  </div>)
}