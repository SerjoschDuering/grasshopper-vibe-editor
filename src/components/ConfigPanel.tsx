'use client'

import { useAppStore } from '@/store/app-store'
import { useState, useEffect } from 'react'

export default function ConfigPanel() {
  const targetGuid = useAppStore(state => state.targetGuid)
  const setTargetGuid = useAppStore(state => state.setTargetGuid)
  const autoFetch = useAppStore(state => state.autoFetch)
  const toggleAutoFetch = useAppStore(state => state.toggleAutoFetch)
  const fetchFromGrasshopper = useAppStore(state => state.fetchFromGrasshopper)
  const loadTestData = useAppStore(state => state.loadTestData)
  const loading = useAppStore(state => state.loading)
  
  const [autoFetchIndicator, setAutoFetchIndicator] = useState(false)

  // Auto-fetch indicator animation
  useEffect(() => {
    if (autoFetch) {
      const interval = setInterval(() => {
        setAutoFetchIndicator(prev => !prev)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [autoFetch])

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <i className="fas fa-cog text-gray-600"></i>
          Configuration
        </h3>
        
        {/* Target GUID */}
        <div className="flex items-center gap-2">
          <label htmlFor="target-guid" className="text-xs font-medium text-gray-600">
            Target Component GUID
          </label>
          <input
            id="target-guid"
            type="text"
            value={targetGuid}
            onChange={(e) => setTargetGuid(e.target.value)}
            placeholder="Component GUID or fetch selected"
            className="w-64 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Auto-fetch Toggle */}
        <div className="flex items-center gap-2">
          <label htmlFor="auto-fetch" className="text-xs font-medium text-gray-600">
            Auto-fetch
          </label>
          {autoFetch && (
            <span className={`inline-block w-1.5 h-1.5 rounded-full transition-all ${
              autoFetchIndicator ? 'bg-green-500' : 'bg-green-300'
            }`} />
          )}
          <button
            id="auto-fetch"
            onClick={toggleAutoFetch}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              autoFetch ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                autoFetch ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Action Buttons */}
        <button
          onClick={fetchFromGrasshopper}
          disabled={loading.fetch || autoFetch}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 text-xs font-medium"
          title={autoFetch ? "Auto-fetch is enabled" : "Fetch component from Grasshopper"}
        >
          {loading.fetch ? (
            <>
              <i className="fas fa-spinner fa-spin text-xs"></i>
              <span>Fetching...</span>
            </>
          ) : (
            <>
              <i className="fas fa-download text-xs"></i>
              <span>Fetch</span>
            </>
          )}
        </button>

        <button
          onClick={loadTestData}
          className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center gap-1.5 text-xs font-medium"
          title="Load sample Python code and parameters"
        >
          <i className="fas fa-flask text-xs"></i>
          <span>Test Data</span>
        </button>

        {/* Server Status */}
        <div className="text-xs text-gray-500">
          <i className="fas fa-server mr-1"></i>
          {process.env.NEXT_PUBLIC_GH_BASE_URL || 'http://127.0.0.1:9998'}
        </div>
      </div>
    </div>
  )
}