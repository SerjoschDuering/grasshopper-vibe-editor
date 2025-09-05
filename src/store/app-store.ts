/**
 * Main application store - combines all slices
 * This is a refactored version that breaks down the monolithic store into manageable slices
 */

import { create } from 'zustand'
import { AppState } from './types'

// Re-export AppState for backward compatibility
export type { AppState } from './types'
import { createEditorSlice } from './slices/editor-slice'
import { createUISlice } from './slices/ui-slice'
import { createSettingsSlice } from './slices/settings-slice'
import { createComponentCacheSlice } from './slices/component-cache-slice'
import { createChatHistorySlice } from './slices/chat-history-slice'
import { createAIContextSlice } from './slices/ai-context-slice'

// Import original store functions temporarily for the slices we haven't migrated yet
import { 
  getSelectedComponent,
  getComponentByGuid,
  updateScript,
  mapStoreToParamDefinitions
} from '@/lib/grasshopper-api'
import { generateId } from './utils/id-generator'
import { computeRevisionFromGhData, toGhParamDefsForRevisionFromUi } from './utils/revision-utils'
import { getInitialActiveTab } from './utils/storage-utils'
import { InputParameter, OutputParameter, ComponentSnapshot } from '@/lib/types'

// Create the combined store
export const useAppStore = create<AppState>((set, get, api) => ({
  // Combine all slices
  ...createEditorSlice(set, get, api),
  ...createUISlice(set, get, api),
  ...createSettingsSlice(set, get, api),
  ...createComponentCacheSlice(set, get, api),
  ...createChatHistorySlice(set, get, api),
  ...createAIContextSlice(set, get, api),

  // Temporary: Add remaining functionality that hasn't been migrated to slices yet
  // These will be moved to proper slices in the next iteration

  // Connection slice (to be created)
  connectionHealth: {
    status: 'unknown',
    lastSuccessfulFetch: null,
    consecutiveFailures: 0
  },
  loading: {
    ai: false,
    fetch: false,
    send: false,
    autoFetch: false
  },
  status: undefined,

  updateConnectionHealth: (health) => set((state) => ({
    connectionHealth: { ...state.connectionHealth, ...health }
  })),

  showStatus: (status) => {
    set({ status })
    if (status.duration && status.duration > 0) {
      setTimeout(() => {
        get().clearStatus()
      }, status.duration)
    }
  },

  clearStatus: () => set({ status: undefined }),

  fetchFromGrasshopper: async () => {
    console.log('[GH] fetchFromGrasshopper called')
    if (process.env.NODE_ENV !== 'production') {
      try { console.debug('[GH] poll: start') } catch {}
    }
    set(state => ({ 
      loading: { ...state.loading, fetch: true } 
    }))
    
    if (!get().autoFetch) {
      get().showStatus({ 
        message: 'Fetching from Grasshopper...', 
        type: 'info' 
      })
    }
    
    try {
      console.log('[GH] Calling getSelectedComponent...')
      const response = await getSelectedComponent()
      console.log('[GH] Response:', response)
      
      if ((response as any).status === 'success' && (response as any).result) {
        const data = (response as any).result
        const id = data.instance_guid
        const newInputs: InputParameter[] = []
        const newOutputs: OutputParameter[] = []
        
        if (data.param_definitions) {
          for (const param of data.param_definitions) {
            if (param.type === 'input') {
              newInputs.push({
                id: generateId(),
                kind: 'input',
                name: param.name,
                description: param.description || '',
                typehint: param.typehint || 'generic',
                access: param.access || 'item',
                optional: param.optional || false
              })
            } else if (param.type === 'output') {
              if (param.name.toLowerCase() === 'output') {
                newOutputs.push({ 
                  id: 'default_output', 
                  kind: 'output', 
                  name: 'output', 
                  description: param.description || 'Default output' 
                })
              } else {
                newOutputs.push({ 
                  id: generateId(), 
                  kind: 'output', 
                  name: param.name, 
                  description: param.description || '' 
                })
              }
            }
          }
        }
        
        if (!newOutputs.some(o => o.name.toLowerCase() === 'output')) {
          newOutputs.unshift({ 
            id: 'default_output', 
            kind: 'output', 
            name: 'output', 
            description: 'Default output' 
          })
        }

        const code = data.code || ''
        if (typeof data.description === 'string' && data.description.length > 0) {
          set({ aiComponentDescription: data.description })
        }
        
        const serverRevision = computeRevisionFromGhData(
          code,
          toGhParamDefsForRevisionFromUi(newInputs, newOutputs)
        )

        const snap: ComponentSnapshot = {
          id,
          code,
          inputs: newInputs,
          outputs: newOutputs,
          serverRevision,
          fetchedAt: Date.now()
        }

        const current = get().componentsById[id]?.snapshot
        if (current && current.serverRevision === serverRevision && get().selectedComponentId === id) {
          if (process.env.NODE_ENV !== 'production') {
            try { console.debug('[GH] poll: no change, skip') } catch {}
          }
          return
        }

        get().receiveServerSnapshot(snap)

        if (!get().autoFetch) {
          get().showStatus({ 
            message: 'Successfully fetched from Grasshopper', 
            type: 'success',
            duration: 3000 
          })
        }
      } else if ((response as any).status === 'none_selected') {
        if (!get().autoFetch) {
          get().showStatus({ 
            message: 'No component selected in Grasshopper', 
            type: 'warning',
            duration: 3000 
          })
        }
      } else if ((response as any).status === 'multiple_selected') {
        if (!get().autoFetch) {
          get().showStatus({ 
            message: 'Multiple components selected. Please select only one.', 
            type: 'warning',
            duration: 3000 
          })
        }
      } else {
        if (!get().autoFetch) {
          get().showStatus({ 
            message: `Unexpected response: ${(response as any).result || 'Unknown error'}`, 
            type: 'error',
            duration: 3000 
          })
        }
      }
    } catch (error) {
      console.error('Fetch error:', error)
      get().showStatus({ 
        message: 'Failed to fetch from Grasshopper. Is the server running?', 
        type: 'error',
        duration: 5000 
      })
    } finally {
      set(state => ({ 
        loading: { ...state.loading, fetch: false } 
      }))
    }
  },

  sendToGrasshopper: async () => {
    const state = get()
    
    if (!state.targetGuid) {
      get().showStatus({ 
        message: 'No target GUID specified', 
        type: 'error',
        duration: 3000 
      })
      return
    }
    
    set(state => ({ 
      loading: { ...state.loading, send: true } 
    }))
    
    get().showStatus({ 
      message: 'Sending to Grasshopper...', 
      type: 'info' 
    })
    
    try {
      const selectedId = state.selectedComponentId
      const draft = selectedId ? state.componentsById[selectedId]?.draft : null
      const codeToSend = draft ? draft.code : state.code
      const inputsToSend = draft ? draft.inputs : state.inputs
      const outputsToSend = draft ? draft.outputs : state.outputs

      const paramDefinitions = mapStoreToParamDefinitions(inputsToSend, outputsToSend)
      
      const payload = {
        type: 'update_script' as const,
        instance_guid: state.targetGuid,
        code: codeToSend,
        description: state.aiComponentDescription || undefined,
        param_definitions: paramDefinitions
      }
      
      const response = await updateScript(payload)
      
      if ((response as any).status === 'success') {
        const serverRevision = computeRevisionFromGhData(
          codeToSend,
          toGhParamDefsForRevisionFromUi(inputsToSend, outputsToSend)
        )
        const snap: ComponentSnapshot = {
          id: state.targetGuid,
          code: codeToSend,
          inputs: inputsToSend,
          outputs: outputsToSend,
          serverRevision,
          fetchedAt: Date.now()
        }
        get().markDraftClean(state.targetGuid, snap)
        
        get().showStatus({ 
          message: 'Successfully sent to Grasshopper', 
          type: 'success',
          duration: 3000 
        })
      }
    } catch (error) {
      console.error('Send error:', error)
      get().showStatus({ 
        message: 'Failed to send to Grasshopper. Is the server running?', 
        type: 'error',
        duration: 5000 
      })
    } finally {
      set(state => ({ 
        loading: { ...state.loading, send: false } 
      }))
    }
  },

  revertToGrasshopperVersion: async () => {
    try {
      const guid = get().targetGuid
      const response = guid ? await getComponentByGuid(guid) : await getSelectedComponent()
      if ((response as any).status !== 'success' || !(response as any).result) {
        get().showStatus({ 
          message: 'Cannot fetch latest component from Grasshopper', 
          type: 'error', 
          duration: 3000 
        })
        return
      }
      
      const data = (response as any).result
      const id = data.instance_guid
      const newInputs: InputParameter[] = []
      const newOutputs: OutputParameter[] = []
      
      if (data.param_definitions) {
        for (const param of data.param_definitions) {
          if (param.type === 'input') {
            newInputs.push({
              id: generateId(),
              kind: 'input',
              name: param.name,
              description: param.description || '',
              typehint: param.typehint || 'generic',
              access: param.access || 'item',
              optional: param.optional || false
            })
          } else if (param.type === 'output') {
            if (param.name.toLowerCase() === 'output') {
              newOutputs.push({ 
                id: 'default_output', 
                kind: 'output', 
                name: 'output', 
                description: param.description || 'Default output' 
              })
            } else {
              newOutputs.push({ 
                id: generateId(), 
                kind: 'output', 
                name: param.name, 
                description: param.description || '' 
              })
            }
          }
        }
      }
      
      if (!newOutputs.some(o => o.name.toLowerCase() === 'output')) {
        newOutputs.unshift({ 
          id: 'default_output', 
          kind: 'output', 
          name: 'output', 
          description: 'Default output' 
        })
      }
      
      const code = data.code || ''
      const serverRevision = computeRevisionFromGhData(
        code, 
        toGhParamDefsForRevisionFromUi(newInputs, newOutputs)
      )
      const snap: ComponentSnapshot = { 
        id, 
        code, 
        inputs: newInputs, 
        outputs: newOutputs, 
        serverRevision, 
        fetchedAt: Date.now() 
      }

      set(state => {
        const nextRecord = {
          snapshot: snap,
          draft: {
            id,
            code,
            inputs: newInputs,
            outputs: newOutputs,
            dirty: false,
            baseRevision: serverRevision,
            isBaseOutdated: false
          }
        }
        const nextMap = {
          ...state.componentsById,
          [id]: nextRecord
        }
        return {
          componentsById: nextMap,
          selectedComponentId: id,
          targetGuid: id,
          code,
          inputs: newInputs,
          outputs: newOutputs
        }
      })

      get().showStatus({ 
        message: 'Reverted to Grasshopper version', 
        type: 'success', 
        duration: 2500 
      })
    } catch (error) {
      console.error('Revert error:', error)
      get().showStatus({ 
        message: 'Failed to fetch from Grasshopper. Is the server running?', 
        type: 'error', 
        duration: 4000 
      })
    }
  },

  // AI slice (to be created)
  aiPrompt: '',
  aiGenerateParams: false,
  aiModel: 'gpt-5-mini',
  aiImage: null,
  aiExplanation: undefined,
  aiComponentDescription: undefined,
  aiPhase: undefined,
  aiStartedAt: undefined,
  aiElapsedMs: 0,
  aiLastGeneratedAt: undefined,

  setAiPrompt: (prompt) => set({ aiPrompt: prompt }),
  setAiGenerateParams: (on) => set({ aiGenerateParams: on }),
  setAiModel: (model) => {
    set({ aiModel: model })
    if (typeof window !== 'undefined') {
      localStorage.setItem('aiModel', model)
    }
  },
  setAiImage: (image) => set({ aiImage: image }),

  generateWithAI: async () => {
    const { generateWithAIImplementation } = await import('./ai-implementation')
    await generateWithAIImplementation(get, set)
  },

  // Context slice (to be created) 
  activeTab: getInitialActiveTab(),
  contextData: null,
  contextLoading: false,
  contextError: null,
  contextAutoRefresh: false,
  runtimeIssues: null,
  selectedComponentGuids: [],
  contextUpstreamLevels: 0,
  contextDownstreamLevels: 0,
  contextDetailLevel: 'simple',
  contextSize: {
    componentCount: 0,
    estimatedTokens: 0
  },
  contextViewMode: 'selection',

  setActiveTab: (tab) => {
    set({ activeTab: tab })
    if (typeof window !== 'undefined') {
      localStorage.setItem('vibecode_activeTab', tab)
    }
  },
  setContextData: (data) => set({ contextData: data, contextError: null }),
  fetchContext: async () => {
    set({ contextLoading: true, contextError: null })
    
    try {
      const response = await fetch((get() as any).__GH_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        set({ 
          contextData: data,
          contextLoading: false,
          contextError: null
        })
      } else {
        throw new Error(data.result || 'Failed to fetch context')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch context'
      set({ 
        contextLoading: false,
        contextError: errorMsg
      })
      get().showStatus({ 
        message: `Context fetch failed: ${errorMsg}`, 
        type: 'error', 
        duration: 4000 
      })
    }
  },
  toggleContextAutoRefresh: () => set(state => ({ contextAutoRefresh: !state.contextAutoRefresh })),
  fetchSelection: async () => {
    try {
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
        set({ 
          selectedComponentGuids: data.selectedGuids || []
        })
        // Compute context size when selection changes
        get().computeContextSize()
        // Also refresh context when selection changes
        get().fetchContext()
        // Removed intrusive notification - selection updates silently
      } else {
        throw new Error(data.result || 'Failed to fetch selection')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch selection'
      get().showStatus({ 
        message: `Selection fetch failed: ${errorMsg}`, 
        type: 'error', 
        duration: 3000 
      })
    }
  },
  setUpstreamLevels: (levels) => {
    set({ contextUpstreamLevels: Math.max(0, Math.min(10, levels)) })
    get().computeContextSize()
    // Refresh context to show new traversal
    get().fetchContext()
  },
  setDownstreamLevels: (levels) => {
    set({ contextDownstreamLevels: Math.max(0, Math.min(10, levels)) })
    get().computeContextSize()
    // Refresh context to show new traversal
    get().fetchContext()
  },
  setContextDetailLevel: (level) => set({ contextDetailLevel: level }),
  setContextViewMode: (mode) => set({ contextViewMode: mode }),
  clearSelection: () => set({ selectedComponentGuids: [], contextSize: { componentCount: 0, estimatedTokens: 0 } }),
  addToSelection: (guid) => set(state => {
    const guids = new Set(state.selectedComponentGuids)
    guids.add(guid)
    return {
      selectedComponentGuids: Array.from(guids)
    }
  }),
  removeFromSelection: (guid) => set(state => ({
    selectedComponentGuids: state.selectedComponentGuids.filter(g => g !== guid)
  })),
  computeContextSize: () => {
    const state = get()
    const { selectedComponentGuids, contextUpstreamLevels, contextDownstreamLevels, contextDetailLevel, contextData } = state
    
    if (!contextData || selectedComponentGuids.length === 0) {
      set({ 
        contextSize: {
          componentCount: 0,
          estimatedTokens: 0
        }
      })
      return
    }
    
    // Simple estimation for now - will be refined with actual traversal
    const baseComponents = selectedComponentGuids.length
    const upstreamMultiplier = Math.pow(2, contextUpstreamLevels) // Rough estimate
    const downstreamMultiplier = Math.pow(2, contextDownstreamLevels)
    const totalComponents = Math.min(
      baseComponents * upstreamMultiplier * downstreamMultiplier,
      contextData.components?.length || 0
    )
    
    // Token estimation based on detail level
    let tokensPerComponent = 50 // simple
    if (contextDetailLevel === 'standard') tokensPerComponent = 150
    if (contextDetailLevel === 'detailed') tokensPerComponent = 500
    
    set({
      contextSize: {
        componentCount: Math.floor(totalComponents),
        estimatedTokens: Math.floor(totalComponents * tokensPerComponent)
      }
    })
  }
}))

// Make store accessible globally for AI context integration
if (typeof window !== 'undefined') {
  (window as any).appStore = useAppStore
}