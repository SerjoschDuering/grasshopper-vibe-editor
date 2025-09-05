/**
 * AI Context Control Slice
 * Manages manual context selection for AI code generation
 */

import { SliceCreator, AIContextSlice } from '../types'
import { computeContextFromSelection } from '@/lib/graph-traversal'
import { processContextData, sliceProcessedContextByComponents, generateMarkdownTemplate } from '@/lib/context-utils'

export const createAIContextSlice: SliceCreator<AIContextSlice> = (set, get) => ({
  // Initial state - default to 1 upstream/downstream, max 3
  aiManualContextEnabled: false,
  aiSelectedGuids: [],
  aiUpstreamLevels: 1,
  aiDownstreamLevels: 1,
  showAIContextModal: false,
  aiContextPreview: '',
  aiContextTokens: 0,
  aiContextData: null, // Separate context data for AI, independent from main Context tab

  // Actions
  setAIManualContextEnabled: (enabled) => {
    set({ aiManualContextEnabled: enabled })
    if (enabled) {
      get().computeAIContextPreview()
    }
  },

  fetchAIContext: async () => {
    try {
      const response = await fetch((get() as any).__GH_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'get_context',
          options: { freezeCanvas: false }
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.status === 'success') {
        // Store in AI-specific context data, not the main context
        set({ aiContextData: data })
        // Compute preview after getting context
        get().computeAIContextPreview()
      } else {
        throw new Error(data.result || 'Failed to fetch context')
      }
    } catch (error) {
      console.error('Error fetching AI context:', error)
      get().showStatus({
        message: 'Failed to fetch context from Grasshopper',
        type: 'error',
        duration: 3000
      })
    }
  },

  fetchAISelection: async () => {
    try {
      // First ensure we have AI context data
      if (!get().aiContextData) {
        await get().fetchAIContext()
      }
      
      // Use the same URL pattern as the main fetchContext
      const response = await fetch((get() as any).__GH_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'get_selection'
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.status === 'success') {
        const selectedGuids = data.selectedGuids || []
        
        // If no manual selection, use the current component
        if (selectedGuids.length === 0) {
          const currentId = get().selectedComponentId
          if (currentId) {
            set({ aiSelectedGuids: [currentId] })
          } else {
            set({ aiSelectedGuids: [] })
          }
        } else {
          set({ aiSelectedGuids: selectedGuids })
        }
        
        // Compute preview when selection changes
        get().computeAIContextPreview()
      } else {
        throw new Error(data.result || 'Failed to fetch selection')
      }
    } catch (error) {
      console.error('Error fetching AI selection:', error)
      // Default to current component
      const currentId = get().selectedComponentId
      if (currentId) {
        set({ aiSelectedGuids: [currentId] })
        get().computeAIContextPreview()
      }
    }
  },

  setAISelectedGuids: (guids) => {
    set({ aiSelectedGuids: guids })
    get().computeAIContextPreview()
  },

  setAIUpstreamLevels: (levels) => {
    // Ensure minimum of 1
    set({ aiUpstreamLevels: Math.max(1, levels) })
    get().computeAIContextPreview()
  },

  setAIDownstreamLevels: (levels) => {
    // Ensure minimum of 1
    set({ aiDownstreamLevels: Math.max(1, levels) })
    get().computeAIContextPreview()
  },

  toggleAIContextModal: () => {
    set(state => ({ showAIContextModal: !state.showAIContextModal }))
  },

  clearAISelection: () => {
    set({ 
      aiSelectedGuids: [],
      aiContextPreview: '',
      aiContextTokens: 0
    })
  },

  computeAIContextPreview: () => {
    const state = get()
    const { aiSelectedGuids, aiUpstreamLevels, aiDownstreamLevels, aiContextData } = state

    if (!aiContextData || aiSelectedGuids.length === 0) {
      set({ aiContextPreview: '', aiContextTokens: 0 })
      return
    }

    try {
      // Process AI context data
      const processedContext = processContextData(aiContextData)
      if (!processedContext) {
        set({ aiContextPreview: 'Failed to process context', aiContextTokens: 0 })
        return
      }
      
      // Compute context using existing graph traversal - pass correct parameters
      const fullSelection = computeContextFromSelection(
        aiSelectedGuids,
        aiUpstreamLevels,
        aiDownstreamLevels,
        processedContext
      )
      
      // Slice context to only include relevant components
      const slicedContext = sliceProcessedContextByComponents(processedContext, fullSelection)

      // Convert to markdown for preview
      const markdown = generateMarkdownTemplate(slicedContext, 'standard')
      
      // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
      const estimatedTokens = Math.ceil(markdown.length / 4)

      set({
        aiContextPreview: markdown,
        aiContextTokens: estimatedTokens
      })
    } catch (error) {
      console.error('Error computing AI context preview:', error)
      set({ aiContextPreview: 'Error generating preview', aiContextTokens: 0 })
    }
  }
})