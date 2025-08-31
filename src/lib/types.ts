// Parameter type definitions (UI models and GH payload models)

export type ParameterTypeHint =
  | 'str' | 'int' | 'float' | 'bool' | 'guid'
  | 'point' | 'vector' | 'curve' | 'surface' | 'brep' | 'mesh' | 'generic'

export type ParameterAccess = 'item' | 'list' | 'tree'

// UI models (used in React state)
export interface BaseParameter {
  id: string
  kind: 'input' | 'output'
  name: string
  description: string
}

export interface InputParameter extends BaseParameter {
  kind: 'input'
  typehint: ParameterTypeHint
  access: ParameterAccess
  optional: boolean
}

export interface OutputParameter extends BaseParameter {
  kind: 'output'
}

export type Parameter = InputParameter | OutputParameter

// API request/response types
export interface GrasshopperResponse {
  status: 'success' | 'error' | 'none_selected' | 'multiple_selected'
  result?: any
}

// GH payload parameter definitions (no UI id/kind)
export type GrasshopperParameterDefinition =
  | {
      type: 'input'
      name: string
      description: string
      typehint: ParameterTypeHint
      access: ParameterAccess
      optional: boolean
    }
  | {
      type: 'output'
      name: string
      description: string
    }

export interface GrasshopperUpdatePayload {
  type: 'update_script'
  instance_guid: string
  code: string
  description?: string
  message_to_user?: string
  param_definitions: GrasshopperParameterDefinition[]
}

export interface GetSelectedComponentRequest {
  type: 'get_selected_script_component'
}

// AI types
export interface AIRequest {
  model: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  response_format?: {
    type: 'json_schema'
    json_schema: {
      name: string
      description: string
      schema: any
      strict: boolean
    }
  }
  temperature: number
}

export interface AIResponse {
  reasoning?: string
  code: string
  description: string
  explanation?: string
  param_definitions?: GrasshopperParameterDefinition[]
}

// UI State types
export type StatusType = 'success' | 'error' | 'info' | 'warning'

export interface StatusMessage {
  message: string
  type: StatusType
  duration?: number
}

// Component caching (snapshot/draft) for guarded polling and persistence
export type ComponentId = string

export interface ComponentSnapshot {
  id: ComponentId
  code: string
  inputs: InputParameter[]
  outputs: OutputParameter[]
  serverRevision: string
  fetchedAt: number
}

export interface ComponentDraft {
  id: ComponentId
  code: string
  inputs: InputParameter[]
  outputs: OutputParameter[]
  dirty: boolean
  baseRevision: string
  isBaseOutdated: boolean
  lastEditedAt?: number
}

export interface ComponentRecord {
  snapshot: ComponentSnapshot | null
  draft: ComponentDraft | null
}

export type ComponentsById = Record<ComponentId, ComponentRecord>

// Runtime issues surfaced from GH context for the currently selected component
export interface RuntimeIssues {
  errors: string[]
  warnings: string[]
  remarks?: string[]
}