import { 
  Parameter, 
  InputParameter, 
  OutputParameter, 
  StatusMessage,
  ComponentsById,
  ComponentDraft,
  ComponentSnapshot,
  ComponentId,
  ComponentRecord,
  RuntimeIssues 
} from '@/lib/types'
import { ModelId } from '@/lib/openai-api'
import { StateCreator } from 'zustand'

export interface LoadingFlags {
  ai: boolean
  fetch: boolean
  send: boolean
  autoFetch: boolean
}

export interface ConnectionHealth {
  status: 'connected' | 'reconnecting' | 'disconnected' | 'unknown'
  lastSuccessfulFetch: number | null
  consecutiveFailures: number
  message?: string
}

// Slice types for better organization
export interface EditorSlice {
  code: string
  targetGuid: string
  inputs: InputParameter[]
  outputs: OutputParameter[]
  
  setCode: (code: string) => void
  setTargetGuid: (guid: string) => void
  addInput: () => void
  addOutput: () => void
  updateParameter: (p: Parameter) => void
  removeParameter: (id: string) => void
  reorderInputs: (activeId: string, overId: string) => void
  reorderOutputs: (activeId: string, overId: string) => void
}

export interface ConnectionSlice {
  connectionHealth: ConnectionHealth
  loading: LoadingFlags
  status?: StatusMessage
  
  updateConnectionHealth: (health: Partial<ConnectionHealth>) => void
  showStatus: (status: StatusMessage) => void
  clearStatus: () => void
  fetchFromGrasshopper: () => Promise<void>
  sendToGrasshopper: () => Promise<void>
  revertToGrasshopperVersion: () => Promise<void>
}

export interface AISlice {
  aiPrompt: string
  aiGenerateParams: boolean
  aiModel: ModelId
  aiImage: string | null
  aiExplanation?: string
  aiComponentDescription?: string
  aiPhase?: 'building_prompt' | 'requesting' | 'done' | 'error'
  aiStartedAt?: number
  aiElapsedMs?: number
  aiLastGeneratedAt?: number
  
  setAiPrompt: (prompt: string) => void
  setAiGenerateParams: (on: boolean) => void
  setAiModel: (model: ModelId) => void
  setAiImage: (image: string | null) => void
  generateWithAI: () => Promise<void>
}

export interface ContextSlice {
  activeTab: 'coding' | 'context' | 'docs'
  contextData: any | null
  contextLoading: boolean
  contextError: string | null
  contextAutoRefresh: boolean
  runtimeIssues?: RuntimeIssues | null
  selectedComponentGuids: string[]
  contextUpstreamLevels: number
  contextDownstreamLevels: number
  contextDetailLevel: 'simple' | 'standard' | 'detailed'
  contextSize: {
    componentCount: number
    estimatedTokens: number
  }
  contextViewMode: 'full' | 'selection'
  
  setActiveTab: (tab: 'coding' | 'context' | 'docs') => void
  setContextData: (data: any) => void
  fetchContext: () => Promise<void>
  toggleContextAutoRefresh: () => void
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

export interface ComponentCacheSlice {
  componentsById: ComponentsById
  selectedComponentId: ComponentId | null
  
  receiveServerSnapshot: (snap: ComponentSnapshot) => void
  updateDraft: (id: ComponentId, updater: (d: ComponentDraft) => ComponentDraft) => void
  markDraftClean: (id: ComponentId, snap: ComponentSnapshot) => void
  discardDraft: (id: ComponentId) => void
}

export interface UISlice {
  theme: 'classic' | 'ocean' | 'grape' | 'dark'
  collapsedCards: Set<string>
  showChatHistory: boolean
  
  setTheme: (theme: 'classic' | 'ocean' | 'grape' | 'dark') => void
  toggleCardCollapsed: (cardId: string) => void
  setShowChatHistory: (show: boolean) => void
}

export interface SettingsSlice {
  apiKey: string
  autoFetch: boolean
  __GH_SERVER_URL: string
  
  setApiKey: (key: string) => void
  setAutoFetch: (on: boolean) => void
  toggleAutoFetch: () => void
  loadTestData: () => void
}

// Import ChatHistorySlice type
import type { ChatHistorySlice } from './slices/chat-history-slice'

// AI Context Control Slice
export interface AIContextSlice {
  // AI manual context state
  aiManualContextEnabled: boolean
  aiSelectedGuids: string[]
  aiUpstreamLevels: number
  aiDownstreamLevels: number
  showAIContextModal: boolean
  aiContextPreview: string
  aiContextTokens: number
  aiContextData: any | null  // Separate context data for AI, independent from main Context tab
  
  // Actions
  setAIManualContextEnabled: (enabled: boolean) => void
  fetchAISelection: () => Promise<void>
  fetchAIContext: () => Promise<void>
  setAISelectedGuids: (guids: string[]) => void
  setAIUpstreamLevels: (levels: number) => void
  setAIDownstreamLevels: (levels: number) => void
  toggleAIContextModal: () => void
  clearAISelection: () => void
  computeAIContextPreview: () => void
}

// Combined store type
export type AppState = EditorSlice & 
  ConnectionSlice & 
  AISlice & 
  ContextSlice & 
  ComponentCacheSlice & 
  UISlice & 
  SettingsSlice &
  ChatHistorySlice &
  AIContextSlice

// Helper type for slice creators
export type SliceCreator<T> = StateCreator<
  AppState,
  [],
  [],
  T
>

// Re-export commonly used types
export type { 
  Parameter, 
  InputParameter, 
  OutputParameter, 
  StatusMessage,
  ComponentsById,
  ComponentDraft,
  ComponentSnapshot,
  ComponentId,
  ComponentRecord,
  RuntimeIssues,
  ModelId
}