import { create } from 'zustand'
import { 
  Parameter, 
  InputParameter, 
  OutputParameter, 
  StatusMessage,
  ParameterTypeHint,
  ParameterAccess,
  ComponentsById,
  ComponentDraft,
  ComponentSnapshot,
  ComponentId,
  ComponentRecord,
  RuntimeIssues 
} from '@/lib/types'
import { ModelId } from '@/lib/openai-api'
import {
  getSelectedComponent,
  getComponentByGuid,
  updateScript,
  mapStoreToParamDefinitions,
  startAutoFetch,
  stopAutoFetch
} from '@/lib/grasshopper-api'

interface LoadingFlags {
  ai: boolean
  fetch: boolean
  send: boolean
  autoFetch: boolean
}

interface ConnectionHealth {
  status: 'connected' | 'reconnecting' | 'disconnected' | 'unknown'
  lastSuccessfulFetch: number | null
  consecutiveFailures: number
  message?: string
}

export interface AppState {
  // Editor
  code: string
  targetGuid: string

  // Parameters
  inputs: InputParameter[]
  outputs: OutputParameter[]

  // Component cache
  componentsById: ComponentsById
  selectedComponentId: ComponentId | null

  // Connection health
  connectionHealth: ConnectionHealth

  // Settings
  apiKey: string
  autoFetch: boolean
  // Theme
  theme: 'classic' | 'ocean' | 'grape' | 'dark'

  // AI
  aiPrompt: string
  aiGenerateParams: boolean
  aiModel: ModelId
  aiExplanation?: string
  aiComponentDescription?: string
  aiPhase?: 'building_prompt' | 'requesting' | 'done' | 'error'
  aiStartedAt?: number
  aiElapsedMs?: number

  // UI
  loading: LoadingFlags
  status?: StatusMessage
  collapsedCards: Set<string>
  
  // Context Tab
  activeTab: 'coding' | 'context'
  contextData: any | null
  contextLoading: boolean
  contextError: string | null
  contextAutoRefresh: boolean
  runtimeIssues?: RuntimeIssues | null
  
  // Selection & Traversal
  selectedComponentGuids: string[]
  contextUpstreamLevels: number
  contextDownstreamLevels: number
  contextDetailLevel: 'simple' | 'standard' | 'detailed'
  contextSize: {
    componentCount: number
    estimatedTokens: number
  }
  // View mode: full graph vs selection subgraph
  contextViewMode: 'full' | 'selection'

  // Sync actions
  setCode: (code: string) => void
  setTargetGuid: (guid: string) => void
  setApiKey: (key: string) => void
  setTheme: (theme: 'classic' | 'ocean' | 'grape' | 'dark') => void
  setAiPrompt: (prompt: string) => void
  setAiGenerateParams: (on: boolean) => void
  setAiModel: (model: ModelId) => void

  addInput: () => void
  addOutput: () => void
  updateParameter: (p: Parameter) => void
  removeParameter: (id: string) => void

  setAutoFetch: (on: boolean) => void
  toggleAutoFetch: () => void
  
  toggleCardCollapsed: (cardId: string) => void

  showStatus: (status: StatusMessage) => void
  clearStatus: () => void
  
  // Connection health
  updateConnectionHealth: (health: Partial<ConnectionHealth>) => void

  // Async ops
  fetchFromGrasshopper: () => Promise<void>
  sendToGrasshopper: () => Promise<void>
  generateWithAI: () => Promise<void>
  loadTestData: () => void

  // Cache/draft management
  receiveServerSnapshot: (snap: ComponentSnapshot) => void
  updateDraft: (id: ComponentId, updater: (d: ComponentDraft) => ComponentDraft) => void
  markDraftClean: (id: ComponentId, snap: ComponentSnapshot) => void
  discardDraft: (id: ComponentId) => void

  // Forced refetch/reset
  revertToGrasshopperVersion: () => Promise<void>

  // Optional: reordering
  reorderInputs: (activeId: string, overId: string) => void
  reorderOutputs: (activeId: string, overId: string) => void
  
  // Context Tab actions
  setActiveTab: (tab: 'coding' | 'context') => void
  setContextData: (data: any) => void
  fetchContext: () => Promise<void>
  toggleContextAutoRefresh: () => void
  
  // Selection & Traversal actions
  fetchSelection: () => Promise<void>
  setUpstreamLevels: (levels: number) => void
  setDownstreamLevels: (levels: number) => void
  setContextDetailLevel: (level: 'simple' | 'standard' | 'detailed') => void
  setContextViewMode: (mode: 'full' | 'selection') => void
  clearSelection: () => void
  addToSelection: (guid: string) => void
  removeFromSelection: (guid: string) => void
  computeContextSize: () => void
}

// Generate unique IDs
const generateId = () => `param_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// Check if parameter is the default output
const isDefaultOutput = (p: Parameter): boolean => {
  return p.kind === 'output' && p.name.toLowerCase() === 'output'
}

// Initialize with default values - localStorage will be checked after mount
const getInitialAutoFetch = (): boolean => {
  return true
}

const getInitialApiKey = (): string => {
  return ''
}

const getInitialAiModel = (): ModelId => {
  return 'gpt-5-mini'
}

const getInitialCollapsedCards = (): Set<string> => {
  return new Set()
}

// Compute a stable revision from code + normalized GH param_definitions (ignoring UI-only ids)
type GhParamForRevision =
  | { type: 'input'; name: string; description: string; typehint: string; access: string; optional: boolean }
  | { type: 'output'; name: string; description: string }

function computeRevisionFromGhData(code: string, paramDefs: GhParamForRevision[]): string {
  // Normalize and sort deterministically by type then name to avoid spurious diffs
  const normalized = paramDefs.map(p => {
    if (p.type === 'input') {
      return { t: 'i', n: p.name, d: p.description || '', th: p.typehint, a: p.access, o: !!p.optional }
    }
    return { t: 'o', n: p.name, d: p.description || '' }
  }).sort((a: any, b: any) => (a.t === b.t ? a.n.localeCompare(b.n) : a.t.localeCompare(b.t)))

  const s = JSON.stringify({ code: code || '', params: normalized })
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 }
  return String(h)
}

function toGhParamDefsForRevisionFromUi(inputs: InputParameter[], outputs: OutputParameter[]): GhParamForRevision[] {
  const arr: GhParamForRevision[] = []
  for (const i of inputs) {
    arr.push({ type: 'input', name: i.name, description: i.description || '', typehint: i.typehint, access: i.access, optional: !!i.optional })
  }
  for (const o of outputs) {
    arr.push({ type: 'output', name: o.name, description: o.description || '' })
  }
  return arr
}

export const useAppStore = create<AppState>((set, get) => ({
  // Config
  // Use env var so the deployed app can talk to a tunneled local server
  // e.g. NEXT_PUBLIC_GH_SERVER_URL=https://xxxxx.ngrok.app
  // Fallback to localhost during development
  __GH_SERVER_URL: (process.env.NEXT_PUBLIC_GH_SERVER_URL as string) || (typeof window !== 'undefined' ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://127.0.0.1:9998' : 'http://127.0.0.1:9998') : 'http://127.0.0.1:9998'),
  // Initial state
  code: `# Python code for the Grasshopper component
# Access inputs using their names if defined, e.g.:
# my_point = point_input
# numbers = list_of_numbers
#
# Or access by index (less robust if params change):
# x = IN[0]
#
# Assign results to output parameters by name:
# output = some_result
# curves_out = generated_curves

print("VibeCode Editor Ready")`,
  targetGuid: '',
  
  inputs: [],
  outputs: [
    {
      id: 'default_output',
      kind: 'output',
      name: 'output',
      description: 'Default output'
    }
  ],
  
  apiKey: getInitialApiKey(),
  autoFetch: getInitialAutoFetch(),
  theme: 'classic',
  
  componentsById: {},
  selectedComponentId: null,
  
  connectionHealth: {
    status: 'unknown',
    lastSuccessfulFetch: null,
    consecutiveFailures: 0
  },
  
  aiPrompt: '',
  aiGenerateParams: false,
  aiModel: getInitialAiModel(),
  
  loading: {
    ai: false,
    fetch: false,
    send: false,
    autoFetch: false
  },
  status: undefined,
  collapsedCards: getInitialCollapsedCards(),
  aiExplanation: undefined,
  aiComponentDescription: undefined,
  aiPhase: undefined,
  aiStartedAt: undefined,
  aiElapsedMs: 0,
  
  // Context Tab initial state
  activeTab: 'coding' as const,
  contextData: null,
  contextLoading: false,
  contextError: null,
  contextAutoRefresh: false,
  contextViewMode: 'selection' as const,
  runtimeIssues: null,
  
  // Selection & Traversal initial state
  selectedComponentGuids: [],
  contextUpstreamLevels: 0,
  contextDownstreamLevels: 0,
  contextDetailLevel: 'simple' as const,
  contextSize: {
    componentCount: 0,
    estimatedTokens: 0
  },

  // Sync actions
  setCode: (code) => {
    const selectedId = get().selectedComponentId
    if (selectedId) {
      get().updateDraft(selectedId, (d) => ({ ...d, code }))
    } else {
      set({ code })
    }
  },
  setTargetGuid: (guid) => set({ targetGuid: guid, selectedComponentId: guid || null }),
  setApiKey: (key) => {
    set({ apiKey: key })
    if (typeof window !== 'undefined') {
      localStorage.setItem('apiKey', key)
    }
  },
  setTheme: (theme) => {
    set({ theme })
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme)
    }
  },
  setAiPrompt: (prompt) => set({ aiPrompt: prompt }),
  setAiGenerateParams: (on) => set({ aiGenerateParams: on }),
  setAiModel: (model) => {
    set({ aiModel: model })
    if (typeof window !== 'undefined') {
      localStorage.setItem('aiModel', model)
    }
  },

  addInput: () => {
    const newInput: InputParameter = {
      id: generateId(),
      kind: 'input',
      name: `input_${get().inputs.length + 1}`,
      description: '',
      typehint: 'generic',
      access: 'item',
      optional: false
    }
    const selectedId = get().selectedComponentId
    if (selectedId) {
      get().updateDraft(selectedId, d => ({ ...d, inputs: [...d.inputs, newInput] }))
    } else {
      set(state => ({ inputs: [...state.inputs, newInput] }))
    }
  },

  addOutput: () => {
    const newOutput: OutputParameter = {
      id: generateId(),
      kind: 'output',
      name: `output_${get().outputs.length + 1}`,
      description: ''
    }
    const selectedId = get().selectedComponentId
    if (selectedId) {
      get().updateDraft(selectedId, d => ({ ...d, outputs: [...d.outputs, newOutput] }))
    } else {
      set(state => ({ outputs: [...state.outputs, newOutput] }))
    }
  },

  updateParameter: (p) => {
    const selectedId = get().selectedComponentId
    if (selectedId) {
      get().updateDraft(selectedId, (d) => {
        if (p.kind === 'input') {
          return { ...d, inputs: d.inputs.map(i => i.id === p.id ? p as InputParameter : i) }
        } else {
          if (isDefaultOutput(p) && 'name' in p) {
            const existing = d.outputs.find(o => o.id === p.id)
            if (existing && existing.name !== p.name) {
              return d
            }
          }
          return { ...d, outputs: d.outputs.map(o => o.id === p.id ? p as OutputParameter : o) }
        }
      })
    } else {
      set(state => {
        if (p.kind === 'input') {
          return {
            inputs: state.inputs.map(inp => inp.id === p.id ? p as InputParameter : inp)
          }
        } else {
          if (isDefaultOutput(p) && 'name' in p) {
            const existing = state.outputs.find(o => o.id === p.id)
            if (existing && existing.name !== p.name) {
              return state
            }
          }
          return {
            outputs: state.outputs.map(out => out.id === p.id ? p as OutputParameter : out)
          }
        }
      })
    }
  },

  removeParameter: (id) => {
    const selectedId = get().selectedComponentId
    if (selectedId) {
      get().updateDraft(selectedId, (d) => {
        const param = [...d.inputs, ...d.outputs].find(p => p.id === id)
        if (param && isDefaultOutput(param)) return d
        return {
          ...d,
          inputs: d.inputs.filter(p => p.id !== id),
          outputs: d.outputs.filter(p => p.id !== id)
        }
      })
    } else {
      set(state => {
        const param = [...state.inputs, ...state.outputs].find(p => p.id === id)
        if (param && isDefaultOutput(param)) return state
        return {
          inputs: state.inputs.filter(p => p.id !== id),
          outputs: state.outputs.filter(p => p.id !== id)
        }
      })
    }
  },

  setAutoFetch: (on) => {
    set({ autoFetch: on })
    if (typeof window !== 'undefined') {
      localStorage.setItem('autoFetch', on.toString())
    }
    
    // Handle auto-fetch polling
    if (on) {
      startAutoFetch(async () => {
        const state = get()
        if (state.loading.fetch || state.loading.send) return
        await get().fetchFromGrasshopper()
      })
      set(state => ({ 
        loading: { ...state.loading, autoFetch: true } 
      }))
    } else {
      stopAutoFetch()
      set(state => ({ 
        loading: { ...state.loading, autoFetch: false } 
      }))
    }
  },

  toggleAutoFetch: () => {
    const newValue = !get().autoFetch
    get().setAutoFetch(newValue)
  },

  toggleCardCollapsed: (cardId: string) => {
    set(state => {
      const newCollapsed = new Set(state.collapsedCards)
      if (newCollapsed.has(cardId)) {
        newCollapsed.delete(cardId)
      } else {
        newCollapsed.add(cardId)
      }
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('collapsedCards', JSON.stringify(Array.from(newCollapsed)))
      }
      
      return { collapsedCards: newCollapsed }
    })
  },

  showStatus: (status) => {
    set({ status })
    if (status.duration && status.duration > 0) {
      setTimeout(() => {
        get().clearStatus()
      }, status.duration)
    }
  },

  clearStatus: () => set({ status: undefined }),

  // Async operations
  fetchFromGrasshopper: async () => {
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
      const response = await getSelectedComponent()
      
      // Handle the nested response structure from the original API
      // The response has a 'status' field and a 'result' field with the actual data
      if ((response as any).status === 'success' && (response as any).result) {
        const data = (response as any).result
        const id: ComponentId = data.instance_guid
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
                newOutputs.push({ id: 'default_output', kind: 'output', name: 'output', description: param.description || 'Default output' })
              } else {
                newOutputs.push({ id: generateId(), kind: 'output', name: param.name, description: param.description || '' })
              }
            }
          }
        }
        if (!newOutputs.some(o => o.name.toLowerCase() === 'output')) {
          newOutputs.unshift({ id: 'default_output', kind: 'output', name: 'output', description: 'Default output' })
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

        // Guard: if nothing changed and selection already on this id, skip entirely
        const current = get().componentsById[id]?.snapshot
        if (current && current.serverRevision === serverRevision && get().selectedComponentId === id) {
          if (process.env.NODE_ENV !== 'production') {
            try { console.debug('[GH] poll: no change, skip (id=%s rev=%s)', id, serverRevision) } catch {}
          }
          // Even if no code/params change, we still want to surface runtime issues.
          try {
            const resp = await fetch((get() as any).__GH_SERVER_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'get_context', options: { freezeCanvas: false } })
            })
            if (resp.ok) {
              const ctx = await resp.json()
              if (ctx && ctx.status === 'success' && Array.isArray(ctx.components)) {
                const comp = ctx.components.find((c: any) => c.instanceGuid === id)
                if (comp && comp.runtime) {
                  const errs = Array.isArray(comp.runtime.errors) ? comp.runtime.errors : []
                  const warns = Array.isArray(comp.runtime.warnings) ? comp.runtime.warnings : []
                  const rems = Array.isArray(comp.runtime.remarks) ? comp.runtime.remarks : []
                  set({ runtimeIssues: { errors: errs, warnings: warns, remarks: rems } })
                  if (process.env.NODE_ENV !== 'production') {
                    try { console.debug('[GH] runtime issues updated (errors=%d warnings=%d)', errs.length, warns.length) } catch {}
                  }
                }
              }
            }
          } catch {}
          return
        }

        if (process.env.NODE_ENV !== 'production') {
          try { console.debug('[GH] poll: update received (id=%s rev=%s prev=%s dirty=%s)', id, serverRevision, current?.serverRevision, !!get().componentsById[id]?.draft?.dirty) } catch {}
        }
        get().receiveServerSnapshot(snap)
        // Refresh runtime issues after snapshot update
        try {
          const resp = await fetch((get() as any).__GH_SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'get_context', options: { freezeCanvas: false } })
          })
          if (resp.ok) {
            const ctx = await resp.json()
            if (ctx && ctx.status === 'success' && Array.isArray(ctx.components)) {
              const comp = ctx.components.find((c: any) => c.instanceGuid === id)
              if (comp && comp.runtime) {
                const errs = Array.isArray(comp.runtime.errors) ? comp.runtime.errors : []
                const warns = Array.isArray(comp.runtime.warnings) ? comp.runtime.warnings : []
                const rems = Array.isArray(comp.runtime.remarks) ? comp.runtime.remarks : []
                set({ runtimeIssues: { errors: errs, warnings: warns, remarks: rems } })
                if (process.env.NODE_ENV !== 'production') {
                  try { console.debug('[GH] runtime issues updated (errors=%d warnings=%d)', errs.length, warns.length) } catch {}
                }
              }
            }
          }
        } catch {}

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
      if (process.env.NODE_ENV !== 'production') {
        try { console.debug('[GH] poll: end') } catch {}
      }
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
      const paramDefinitions = mapStoreToParamDefinitions(state.inputs, state.outputs)
      
      const payload = {
        type: 'update_script' as const,
        instance_guid: state.targetGuid,
        code: state.code,
        description: state.aiComponentDescription || undefined,
        param_definitions: paramDefinitions
      }
      
      const response = await updateScript(payload)
      
      if ((response as any).status === 'success') {
        // Mark current draft as clean using the just-sent content
        const inputs = state.inputs
        const outputs = state.outputs
        const code = state.code
        const serverRevision = computeRevisionFromGhData(
          code,
          toGhParamDefsForRevisionFromUi(inputs, outputs)
        )
        const snap: ComponentSnapshot = {
          id: state.targetGuid,
          code,
          inputs,
          outputs,
          serverRevision,
          fetchedAt: Date.now()
        }
        get().markDraftClean(state.targetGuid, snap)
        if (process.env.NODE_ENV !== 'production') {
          try { console.debug('[GH] send: success (id=%s rev=%s)', state.targetGuid, serverRevision) } catch {}
        }
        get().showStatus({ 
          message: 'Successfully sent to Grasshopper', 
          type: 'success',
          duration: 3000 
        })
      } else if ((response as any).result) {
        get().showStatus({ 
          message: `Error: ${(response as any).result}`, 
          type: 'error',
          duration: 5000 
        })
      } else {
        get().showStatus({ 
          message: 'Update sent but status unknown', 
          type: 'warning',
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

  generateWithAI: async () => {
    const state = get()
    
    // Import the generateWithAI function from openai-api
    const { generateWithAI: callOpenAI, validateApiKey, validatePrompt } = await import('@/lib/openai-api')
    
    // Validate inputs
    if (!validateApiKey(state.apiKey)) {
      get().showStatus({ 
        message: 'Invalid API key. Must start with "sk-"', 
        type: 'error',
        duration: 3000 
      })
      return
    }
    
    if (!validatePrompt(state.aiPrompt)) {
      get().showStatus({ 
        message: 'Prompt too short (minimum 10 characters)', 
        type: 'error',
        duration: 3000 
      })
      return
    }
    
    // Start AI timing + phase
    const startedAt = Date.now()
    set(state => ({ 
      loading: { ...state.loading, ai: true },
      aiPhase: 'building_prompt',
      aiStartedAt: startedAt,
      aiElapsedMs: 0
    }))
    let tickId: any = setInterval(() => {
      const s = get()
      if (!s.loading.ai || !s.aiStartedAt) return
      set({ aiElapsedMs: Date.now() - s.aiStartedAt })
    }, 250)
    
    get().showStatus({ 
      message: 'Generating with AI...', 
      type: 'info' 
    })
    
    try {
      set({ aiPhase: 'requesting' })
      const result = await callOpenAI({
        prompt: state.aiPrompt,
        apiKey: state.apiKey,
        state: {
          code: state.code,
          inputs: state.inputs,
          outputs: state.outputs
        },
        generateParams: state.aiGenerateParams,
        model: state.aiModel,
        contextData: state.contextData,
        selectedComponentId: state.selectedComponentId || undefined
      })
      
      // Update code via the same path as user edits (respects draft selection)
      get().setCode(result.code)
      // Save AI explanation and component description
      set({ aiExplanation: result.explanation, aiComponentDescription: result.description })
      // Save AI explanation and component description
      set({ aiExplanation: result.explanation, aiComponentDescription: result.description })

      // Update parameters if requested
      if (state.aiGenerateParams && result.param_definitions) {
        const newInputs: InputParameter[] = []
        const newOutputs: OutputParameter[] = []
        
        for (const param of result.param_definitions) {
          if (param.type === 'input') {
            newInputs.push({
              id: generateId(),
              kind: 'input',
              name: param.name,
              description: param.description,
              typehint: param.typehint,
              access: param.access,
              optional: param.optional
            })
          } else if (param.type === 'output') {
            // Skip default output, we'll add it separately
            if (param.name.toLowerCase() === 'output') continue
            
            newOutputs.push({
              id: generateId(),
              kind: 'output',
              name: param.name,
              description: param.description
            })
          }
        }
        
        // Ensure default output exists
        const defaultOutput: OutputParameter = {
          id: 'default_output',
          kind: 'output',
          name: 'output',
          description: 'Default output'
        }
        
        const outputsCombined = [defaultOutput, ...newOutputs]
        const selectedId = get().selectedComponentId
        if (selectedId) {
          get().updateDraft(selectedId, d => ({
            ...d,
            inputs: newInputs,
            outputs: outputsCombined
          }))
        } else {
          set({
            inputs: newInputs,
            outputs: outputsCombined
          })
        }
      }
      
      set({ aiPhase: 'done' })
      get().showStatus({ 
        message: 'AI generation complete', 
        type: 'success',
        duration: 3000 
      })
    } catch (error) {
      console.error('AI generation error:', error)
      set({ aiPhase: 'error' })
      get().showStatus({ 
        message: `AI error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        type: 'error',
        duration: 5000 
      })
    } finally {
      clearInterval(tickId)
      set(state => ({ 
        loading: { ...state.loading, ai: false }
      }))
    }
  },

  loadTestData: () => {
    const testCode = `import rhinoscriptsyntax as rs

def process_points(points, scale_factor=1.0):
    """Scale and process input points"""
    if not points:
        return []
    
    scaled_points = []
    for pt in points:
        if pt:
            # Scale point from origin
            scaled = rs.PointScale(pt, [0,0,0], [scale_factor]*3)
            scaled_points.append(scaled)
    
    return scaled_points

# Main execution
output = process_points(points, scale)`

    const testInputs: InputParameter[] = [
      {
        id: generateId(),
        kind: 'input',
        name: 'points',
        description: 'List of points to process',
        typehint: 'point',
        access: 'list',
        optional: false
      },
      {
        id: generateId(),
        kind: 'input',
        name: 'scale',
        description: 'Scale factor for points',
        typehint: 'float',
        access: 'item',
        optional: true
      }
    ]

    const testOutputs: OutputParameter[] = [
      {
        id: 'default_output',
        kind: 'output',
        name: 'output',
        description: 'Scaled points'
      }
    ]

    const serverRevision = computeRevisionFromGhData(
      testCode,
      toGhParamDefsForRevisionFromUi(testInputs, testOutputs)
    )

    const snap: ComponentSnapshot = {
      id: 'test-guid-12345',
      code: testCode,
      inputs: testInputs,
      outputs: testOutputs,
      serverRevision,
      fetchedAt: Date.now()
    }

    get().receiveServerSnapshot(snap)

    get().showStatus({ 
      message: 'Test data loaded', 
      type: 'success',
      duration: 3000 
    })
  },

  reorderInputs: (activeId, overId) => {
    set(state => {
      const fromIndex = state.inputs.findIndex(p => p.id === activeId)
      const toIndex = state.inputs.findIndex(p => p.id === overId)
      if (fromIndex === -1 || toIndex === -1) return state

      const reorderedInputs = [...state.inputs]
      const [moved] = reorderedInputs.splice(fromIndex, 1)
      reorderedInputs.splice(toIndex, 0, moved)

      const selectedId = state.selectedComponentId
      if (!selectedId) {
        return { inputs: reorderedInputs }
      }

      const currentRecord = state.componentsById[selectedId]
      if (!currentRecord?.draft) {
        return { inputs: reorderedInputs }
      }

      const nextDraft: ComponentDraft = {
        ...currentRecord.draft,
        inputs: reorderedInputs,
        dirty: true,
        lastEditedAt: Date.now()
      }
      const nextRecord: ComponentRecord = {
        snapshot: currentRecord.snapshot,
        draft: nextDraft
      }
      const nextMap: ComponentsById = {
        ...state.componentsById,
        [selectedId]: nextRecord
      }

      return {
        componentsById: nextMap,
        inputs: reorderedInputs
      }
    })
  },

  reorderOutputs: (activeId, overId) => {
    set(state => {
      // Don't allow reordering if either is the default output
      const activeParam = state.outputs.find(p => p.id === activeId)
      const overParam = state.outputs.find(p => p.id === overId)
      if (!activeParam || !overParam) return state
      if (isDefaultOutput(activeParam) || isDefaultOutput(overParam)) return state

      const fromIndex = state.outputs.findIndex(p => p.id === activeId)
      const toIndex = state.outputs.findIndex(p => p.id === overId)
      if (fromIndex === -1 || toIndex === -1) return state

      const reorderedOutputs = [...state.outputs]
      const [moved] = reorderedOutputs.splice(fromIndex, 1)
      reorderedOutputs.splice(toIndex, 0, moved)

      const selectedId = state.selectedComponentId
      if (!selectedId) {
        return { outputs: reorderedOutputs }
      }

      const currentRecord = state.componentsById[selectedId]
      if (!currentRecord?.draft) {
        return { outputs: reorderedOutputs }
      }

      const nextDraft: ComponentDraft = {
        ...currentRecord.draft,
        outputs: reorderedOutputs,
        dirty: true,
        lastEditedAt: Date.now()
      }
      const nextRecord: ComponentRecord = {
        snapshot: currentRecord.snapshot,
        draft: nextDraft
      }
      const nextMap: ComponentsById = {
        ...state.componentsById,
        [selectedId]: nextRecord
      }

      return {
        componentsById: nextMap,
        outputs: reorderedOutputs
      }
    })
  },

  // Cache/draft management implementations
  receiveServerSnapshot: (snap) => {
    set(state => {
      const currentRec = state.componentsById[snap.id]
      const prevSnap = currentRec?.snapshot
      let nextRec: ComponentRecord

      if (prevSnap && prevSnap.serverRevision === snap.serverRevision) {
        nextRec = {
          snapshot: { ...prevSnap, fetchedAt: snap.fetchedAt },
          draft: currentRec?.draft ?? null
        }
      } else {
        if (!currentRec?.draft) {
          nextRec = {
            snapshot: snap,
            draft: {
              id: snap.id,
              code: snap.code,
              inputs: snap.inputs,
              outputs: snap.outputs,
              dirty: false,
              baseRevision: snap.serverRevision,
              isBaseOutdated: false
            }
          }
        } else if (currentRec.draft.dirty) {
          nextRec = {
            snapshot: snap,
            draft: { ...currentRec.draft, isBaseOutdated: currentRec.draft.baseRevision !== snap.serverRevision }
          }
        } else {
          nextRec = {
            snapshot: snap,
            draft: {
              ...currentRec.draft,
              code: snap.code,
              inputs: snap.inputs,
              outputs: snap.outputs,
              dirty: false,
              baseRevision: snap.serverRevision,
              isBaseOutdated: false
            }
          }
        }
      }

      const nextMap: ComponentsById = { ...state.componentsById, [snap.id]: nextRec }
      const code = nextRec.draft ? nextRec.draft.code : state.code
      const inputs = nextRec.draft ? nextRec.draft.inputs : state.inputs
      const outputs = nextRec.draft ? nextRec.draft.outputs : state.outputs

      return {
        componentsById: nextMap,
        selectedComponentId: snap.id,
        targetGuid: snap.id,
        code,
        inputs,
        outputs
      }
    })
  },

  updateDraft: (id, updater) => {
    set(state => {
      const currentRec = state.componentsById[id]
      const baseSnap = currentRec?.snapshot ?? {
        id,
        code: state.code,
        inputs: state.inputs,
        outputs: state.outputs,
        serverRevision: '0',
        fetchedAt: Date.now()
      }
      const currDraft: ComponentDraft = currentRec?.draft ?? {
        id,
        code: baseSnap.code,
        inputs: baseSnap.inputs,
        outputs: baseSnap.outputs,
        dirty: false,
        baseRevision: baseSnap.serverRevision,
        isBaseOutdated: false
      }
      const nextDraft = { ...updater(currDraft), dirty: true, lastEditedAt: Date.now() }
      const nextRec: ComponentRecord = { snapshot: currentRec?.snapshot ?? baseSnap, draft: nextDraft }
      const nextMap: ComponentsById = { ...state.componentsById, [id]: nextRec }

      const partial: any = { componentsById: nextMap }
      if (state.selectedComponentId === id) {
        partial.code = nextDraft.code
        partial.inputs = nextDraft.inputs
        partial.outputs = nextDraft.outputs
      }
      return partial
    })
  },

  markDraftClean: (id, snap) => {
    set(state => {
      const nextRec: ComponentRecord = {
        snapshot: snap,
        draft: {
          id,
          code: snap.code,
          inputs: snap.inputs,
          outputs: snap.outputs,
          dirty: false,
          baseRevision: snap.serverRevision,
          isBaseOutdated: false
        }
      }
      const nextMap: ComponentsById = { ...state.componentsById, [id]: nextRec }
      const partial: any = { componentsById: nextMap }
      if (state.selectedComponentId === id) {
        partial.code = snap.code
        partial.inputs = snap.inputs
        partial.outputs = snap.outputs
      }
      return partial
    })
  },

  discardDraft: (id) => {
    set(state => {
      const rec = state.componentsById[id]
      if (!rec?.snapshot) return {}
      const nextDraft: ComponentDraft = {
        id,
        code: rec.snapshot.code,
        inputs: rec.snapshot.inputs,
        outputs: rec.snapshot.outputs,
        dirty: false,
        baseRevision: rec.snapshot.serverRevision,
        isBaseOutdated: false
      }
      const nextMap: ComponentsById = { ...state.componentsById, [id]: { snapshot: rec.snapshot, draft: nextDraft } }
      const partial: any = { componentsById: nextMap }
      if (state.selectedComponentId === id) {
        partial.code = nextDraft.code
        partial.inputs = nextDraft.inputs
        partial.outputs = nextDraft.outputs
      }
      return partial
    })
  },

  // Force fetch latest from GH and reset snapshot+draft, discarding local edits
  revertToGrasshopperVersion: async () => {
    try {
      const guid = get().targetGuid
      const response = guid ? await getComponentByGuid(guid) : await getSelectedComponent()
      if ((response as any).status !== 'success' || !(response as any).result) {
        get().showStatus({ message: 'Cannot fetch latest component from Grasshopper', type: 'error', duration: 3000 })
        return
      }
      const data = (response as any).result
      const id: ComponentId = data.instance_guid
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
              newOutputs.push({ id: 'default_output', kind: 'output', name: 'output', description: param.description || 'Default output' })
            } else {
              newOutputs.push({ id: generateId(), kind: 'output', name: param.name, description: param.description || '' })
            }
          }
        }
      }
      if (!newOutputs.some(o => o.name.toLowerCase() === 'output')) {
        newOutputs.unshift({ id: 'default_output', kind: 'output', name: 'output', description: 'Default output' })
      }
      const code = data.code || ''
      const serverRevision = computeRevisionFromGhData(code, toGhParamDefsForRevisionFromUi(newInputs, newOutputs))
      const snap: ComponentSnapshot = { id, code, inputs: newInputs, outputs: newOutputs, serverRevision, fetchedAt: Date.now() }

      // Overwrite snapshot and draft regardless of dirty state (immutably)
      set(state => {
        const nextRecord: ComponentRecord = {
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
        const nextMap: ComponentsById = {
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

      get().showStatus({ message: 'Reverted to Grasshopper version', type: 'success', duration: 2500 })
    } catch (error) {
      console.error('Revert error:', error)
      get().showStatus({ message: 'Failed to fetch from Grasshopper. Is the server running?', type: 'error', duration: 4000 })
    }
  },

  // Context Tab actions
  setActiveTab: (tab) => {
    set({ activeTab: tab })
    // Store in localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('vibecode_activeTab', tab)
    }
  },

  setContextData: (data) => {
    set({ contextData: data, contextError: null })
  },

  fetchContext: async () => {
    set({ contextLoading: true, contextError: null })
    
    try {
      const response = await fetch((get() as any).__GH_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'get_context',
          options: {
            freezeCanvas: false
          }
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.status === 'success') {
        // Extract runtime issues for the selected component (if any)
        let runtimeIssues: { errors: string[]; warnings: string[] } | null = null
        try {
          const selectedId = get().selectedComponentId
          if (selectedId && Array.isArray(data.components)) {
            const comp = data.components.find((c: any) => c.instanceGuid === selectedId)
            if (comp && comp.runtime) {
              const errs = Array.isArray(comp.runtime.errors) ? comp.runtime.errors : []
              const warns = Array.isArray(comp.runtime.warnings) ? comp.runtime.warnings : []
              runtimeIssues = { errors: errs, warnings: warns }
            }
          }
        } catch {}

        set({ 
          contextData: data,
          contextLoading: false,
          contextError: null,
          runtimeIssues
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


  toggleContextAutoRefresh: () => {
    set(state => ({ contextAutoRefresh: !state.contextAutoRefresh }))
  },
  
  // Selection & Traversal actions implementation
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
        get().showStatus({ 
          message: `Fetched ${data.count || 0} selected components`, 
          type: 'success', 
          duration: 2000 
        })
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
  },
  
  setDownstreamLevels: (levels) => {
    set({ contextDownstreamLevels: Math.max(0, Math.min(10, levels)) })
    get().computeContextSize()
  },
  
  setContextDetailLevel: (level) => {
    set({ contextDetailLevel: level })
    get().computeContextSize()
  },
  setContextViewMode: (mode) => set({ contextViewMode: mode }),
  
  clearSelection: () => {
    set({ 
      selectedComponentGuids: [],
      contextSize: {
        componentCount: 0,
        estimatedTokens: 0
      }
    })
  },
  
  addToSelection: (guid) => {
    set(state => {
      const guids = new Set(state.selectedComponentGuids)
      guids.add(guid)
      return {
        selectedComponentGuids: Array.from(guids)
      }
    })
    get().computeContextSize()
  },
  
  removeFromSelection: (guid) => {
    set(state => ({
      selectedComponentGuids: state.selectedComponentGuids.filter(g => g !== guid)
    }))
    get().computeContextSize()
  },
  
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
  },
  
  // Connection health actions
  updateConnectionHealth: (health: Partial<ConnectionHealth>) => set((state) => ({
    connectionHealth: { ...state.connectionHealth, ...health }
  }))
}))