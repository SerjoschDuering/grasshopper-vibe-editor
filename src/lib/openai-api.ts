import { 
  InputParameter, 
  OutputParameter,
  GrasshopperParameterDefinition,
  AIResponse 
} from '@/lib/types'
import { AppState } from '@/store/app-store'

interface AIGenerateOptions {
  prompt: string
  apiKey: string
  state: Pick<AppState, 'code' | 'inputs' | 'outputs'>
  generateParams: boolean
  model?: string
  contextData?: any // For canvas context
  selectedComponentId?: string
  image?: string // Base64 data URI for reference image
  chatHistory?: string // XML-formatted chat history context
}

// Model configuration
export const MODEL_CONFIG = {
  'gpt-5-nano': {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    description: 'Fastest and most cost-effective',
    pricing: { input: 0.05, output: 0.40 }, // per 1M tokens
    contextWindow: 400000,
    maxOutput: 128000,
    capabilities: ['basic', 'fast'],
    reasoningEffort: 'minimal'
  },
  'gpt-5-mini': {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    description: 'Balanced performance and cost',
    pricing: { input: 0.25, output: 2.00 },
    contextWindow: 400000,
    maxOutput: 128000,
    capabilities: ['standard', 'balanced'],
    reasoningEffort: 'medium'
  },
  'gpt-5': {
    id: 'gpt-5',
    name: 'GPT-5',
    description: 'Most capable model',
    pricing: { input: 1.25, output: 10.00 },
    contextWindow: 400000,
    maxOutput: 128000,
    capabilities: ['advanced', 'reasoning', 'long-context'],
    reasoningEffort: 'medium'
  }
} as const

export type ModelId = keyof typeof MODEL_CONFIG

// Simple MCP cooldown - disable MCP for 5 minutes after failures
let mcpDisabledUntil = 0

// AI Context providers
export interface AIContextProvider {
  id: string
  name: string
  enabled: boolean
  priority: number
  getContext: () => string
}

const contextProviders: AIContextProvider[] = [
  {
    id: 'grasshopper-env',
    name: 'Grasshopper Environment',
    enabled: true,
    priority: 1,
    getContext: () => `
# Environment Context
- Python Version: 2.7 (IronPython)
- Runtime: Rhino/Grasshopper
- IMPORTANT: Use Python 2.7 syntax only. NO f-strings. Use .format() or % formatting.
- Always import rhinoscriptsyntax as rs when needed
- Component inputs are available as variables by their names
- Outputs must be assigned to variables matching output parameter names
`
  },
  {
    id: 'custom-instructions',
    name: 'Custom Instructions',
    enabled: true,
    priority: 2,
    getContext: () => {
      if (typeof window !== 'undefined') {
        const instructions = localStorage.getItem('ai-custom-instructions')
        if (instructions) {
          return `# Custom Instructions\n${instructions}`
        }
      }
      return ''
    }
  },
  {
    id: 'component-neighbors',
    name: 'Component Neighbors',
    enabled: false,
    priority: 3,
    getContext: () => '# Component neighbors context (not implemented yet)'
  },
  {
    id: 'canvas-state',
    name: 'Canvas State',
    enabled: true,
    priority: 4,
    getContext: () => {
      // This will be dynamically populated when generateWithAI is called
      return ''
    }
  }
]

export function getEnabledContextProviders(): AIContextProvider[] {
  return contextProviders
    .filter(p => p.enabled)
    .sort((a, b) => a.priority - b.priority)
}

export function setContextProviderEnabled(id: string, enabled: boolean): void {
  const provider = contextProviders.find(p => p.id === id)
  if (provider) {
    provider.enabled = enabled
  }
}


function buildSystemPrompt(generateParams: boolean, canvasContext?: string, chatHistory?: string): string {
  const contexts = getEnabledContextProviders()
    .map(p => p.getContext())
    .filter(c => c.length > 0)
    .join('\n\n')

  // Add canvas context if available with clear tags
  let enhancedContexts = `<context_providers>\n${contexts}\n</context_providers>`
  if (canvasContext) {
    enhancedContexts += `\n\n<canvas_context>\n${canvasContext}\n</canvas_context>`
  }
  if (chatHistory) {
    enhancedContexts = `${chatHistory}\n\n${enhancedContexts}`
  }

  const basePrompt = `
<system_instructions>
You are an expert Python programmer for Grasshopper components. You will get context and instructions in tagged sections; follow tags strictly.
</system_instructions>

<guides>
# Context System
This editor provides intelligent context about your Grasshopper canvas:
- **Canvas Context**: When enabled, you receive information about connected components
- **Medium Detail**: Shows component names, types, inputs/outputs, and connections
- **Full Detail (GPT-5)**: Complete component information including script contents
- **Smart Filtering**: Context includes components ±1 level from your selected component
- The context helps you understand data flow and write compatible code

# Grasshopper Python Code Generation Guide

## CRITICAL: Input Type Detection (Always Include)
Every component should detect input types to handle data correctly:
- Check: hasattr(input, 'BranchCount') for DataTree
- Check: isinstance(input, list) for list
- Otherwise treat as single item
- Convert trees with ghpythonlib.treehelpers

## DataTree Handling (Recommended Approach)
- Use ghpythonlib.treehelpers for 95% of cases
- Convert to nested lists: th.tree_to_list(input_tree)
- Process as Python lists: [[func(x) for x in branch] for branch in nested]
- Convert back: th.list_to_tree(processed)
- For path control: use GH_Path(0, 1, 2) for {0;1;2}

## Essential Import Patterns
- Standard: import rhinoscriptsyntax as rs
- Trees: import ghpythonlib.treehelpers as th
- Direct tree: import Grasshopper as gh
- Paths: from Grasshopper.Kernel.Data import GH_Path
- Geometry: import Rhino.Geometry as rg

## Common Working Patterns
1. Process any input format: Check type, convert if needed, process uniformly
2. Flatten trees: [item for branch in th.tree_to_list(tree) for item in branch]
3. Maintain structure: Process nested lists, convert back with th.list_to_tree()
4. Single items: Wrap in list for uniform processing: [item]


## Error Handling (Production-Ready Patterns)
- Use try/except blocks for complex operations
- Provide meaningful error messages with print()
- Return empty lists or default values on error

## FORBIDDEN Patterns
- NEVER use globals() - component variables are already in scope
- NEVER use eval() or exec() - security risk and unnecessary

## Output Assignment
- Always assign results to output parameter variable names
- Single output: output_name = result

</guides>

<tools>
Tool use policy for remote MCP "context7":
- Only call this tool if the user explicitly mentions "context7" in their request.
- When used, prioritize queries about "Grasshopper API" and "RhinoCommon" types/methods.
- Preferred flow: resolve-library-id → get-library-docs.
- Keep calls minimal; summarize any lookups briefly in the reasoning.
</tools>

<task>
Generate ${generateParams ? 'Python code AND parameter definitions' : 'Python code only'} based on the user's prompt.
</task>

<context>
Here is the immediate context of the component we are working on, this helps you to undertand how its interconnected with other parts of the grasshopper definition
${enhancedContexts}
</context>

<requirements>
# Code Requirements
1. Use Python 2.7 syntax (NO f-strings, use .format() or % formatting)
2. Always include type detection for inputs (hasattr for DataTree check)
3. Import only what's needed (rs, th, gh, rg as appropriate)
4. Handle None/null inputs gracefully
5. Input parameters are available as variables by their names
6. Assign results to output parameter variables
7. Maintain tree structure when appropriate
8. Use proper type coercion (rs.coerce functions)
9. Provide a clear, user-friendly component description (focus on what it does, not how)
</requirements>

${generateParams ? `
<parameter_requirements>
1. Infer appropriate input parameters from the prompt
2. Use descriptive names (lowercase with underscores)
3. Choose appropriate type hints (str, int, float, bool, point, vector, curve, surface, brep, mesh, generic)
4. Set appropriate access levels (item, list, tree)
5. Mark parameters as optional when appropriate
6. Always include at least one output parameter
7. Each input and output MUST include a short, specific description (≤120 characters)
</parameter_requirements>
` : ''}
`

  return basePrompt
}

function buildResponseContract(generateParams: boolean, userPrompt: string): string {
  const trimmed = (userPrompt || '').trim()
  const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0
  const includeFinal = (wordCount > 0 && wordCount <= 50) || trimmed.length <= 350
  const finalBlock = includeFinal ? `\n<final_user_instructions>\n${userPrompt}\n</final_user_instructions>` : ''

  return `
<response_format>
Output ONLY a single, valid JSON object. No prose, no markdown, no code fences.
The JSON MUST have these fields:
{
  "reasoning": "Brief technical explanation of your approach (for internal use)",
  "explanation": "User-friendly explanation in plain language. What the solution does in 2-3 clear sentences. Avoid technical jargon.",
  "description": "Simple summary of what was done (e.g., 'Added filtering by height' or 'Created dynamic building generator')",
  "code": "The complete Python 2.7 code"${generateParams ? ',\n  "param_definitions": [\n    {"type": "input", "name": "param_name", "description": "<=120 chars, what it does", "typehint": "str/int/float/etc", "access": "item/list/tree", "optional": true/false},\n    {"type": "output", "name": "result", "description": "<=120 chars, what it outputs"}\n  ]' : ''}
}
</response_format>
${finalBlock}
`
}

// Removed buildJsonSchema - we're using simple JSON mode instead of strict schemas

export async function generateWithAI(options: AIGenerateOptions): Promise<AIResponse> {
  const { prompt, apiKey, state, generateParams, model = 'gpt-5-mini', contextData, selectedComponentId, image, chatHistory } = options
  
  // Validate model
  const modelConfig = MODEL_CONFIG[model as ModelId] || MODEL_CONFIG['gpt-5-mini']

  // Build the user message with clear XML-like markers
  let userMessage = `<user_instructions> \n THis is very IMPORTANT, this is what your coding tasks is about:\n${prompt}\n</user_instructions>`
  if (state.code && state.code.trim()) {
    userMessage += `\n\n<current_code language="python">\n${state.code}\n</current_code>`
  }
  if (state.inputs.length > 0 || state.outputs.length > 0) {
    userMessage += '\n\n<current_parameters>'
    state.inputs.forEach(input => {
      const optionalAttr = input.optional ? 'true' : 'false'
      userMessage += `\n  <input name="${input.name}" typehint="${input.typehint}" access="${input.access}" optional="${optionalAttr}" />`
    })
    state.outputs.forEach(output => {
      userMessage += `\n  <output name="${output.name}" />`
    })
    userMessage += '\n</current_parameters>'
  }

  // Generate canvas context if available and enabled
  let canvasContext = ''
  
  // Check if manual AI context is enabled and available
  const store = typeof window !== 'undefined' ? (window as any).appStore?.getState?.() : null
  const useManualContext = store?.aiManualContextEnabled && store?.aiSelectedGuids?.length > 0
  
  if (useManualContext && contextData) {
    // Use manual context selection with user-defined upstream/downstream levels
    const { processContextData, generateMarkdownTemplate, sliceProcessedContextByComponents } = await import('@/lib/context-utils')
    const { computeContextFromSelection } = await import('@/lib/graph-traversal')
    const processedContext = processContextData(contextData)
    
    if (processedContext) {
      const contextGuids = computeContextFromSelection(
        store.aiSelectedGuids,
        store.aiUpstreamLevels || 2,
        store.aiDownstreamLevels || 1,
        processedContext
      )
      
      // Slice context to relevant components
      const slicedContext = sliceProcessedContextByComponents(processedContext, contextGuids)
      
      const detailLevel = model === 'gpt-5' ? 'detailed' : 'standard'
      canvasContext = generateMarkdownTemplate(slicedContext, detailLevel as any)
    }
  } else if (contextData && selectedComponentId) {
    // Fall back to automatic context (original behavior)
    const { processContextData, generateMarkdownTemplate, sliceProcessedContextByComponents } = await import('@/lib/context-utils')
    const { computeContextFromSelection } = await import('@/lib/graph-traversal')
    const processedContext = processContextData(contextData)
    
    if (processedContext) {
      // Determine detail level based on model
      const detailLevel = model === 'gpt-5' ? 'detailed' : 'standard'
      
      // Get components within ±1 of selected
      const selectedGuids = [selectedComponentId]
      const contextGuids = computeContextFromSelection(
        selectedGuids,
        1, // upstream levels
        1, // downstream levels
        processedContext
      )
      
      // Slice context to relevant components
      const slicedContext = sliceProcessedContextByComponents(processedContext, contextGuids)
      
      // Generate markdown
      const markdown = generateMarkdownTemplate(slicedContext, detailLevel as any)

      // Add a clear banner identifying the target component
      const selectedComp = slicedContext.components.find(c => c.instanceGuid === selectedComponentId)
      const selectedName = (selectedComp && (selectedComp.nickName || selectedComp.name || selectedComp.kind)) || 'Unknown'

      const banner = [
        '# Target Component',
        `- GUID: ${selectedComponentId}`,
        `- Name: ${selectedName}`,
        ''
      ].join('\n')

      canvasContext = banner + '\n' + markdown
    }
  }

  // GPT-5 uses the responses API
  const fullPrompt = buildSystemPrompt(generateParams, canvasContext, chatHistory) 
    + '\n\n' + userMessage
    + '\n\n' + buildResponseContract(generateParams, prompt)
  
  const apiEndpoint = 'https://api.openai.com/v1/responses'
  
  // Helper function to make API request
  const makeRequest = async (includeMCP: boolean) => {
    const requestBody: any = {
      model: modelConfig.id,
      input: [
        {
          role: 'user',
          content: image
            ? [
                { type: 'input_text', text: fullPrompt },
                { type: 'input_image', image_url: image }
              ]
            : [
                { type: 'input_text', text: fullPrompt }
              ]
        }
      ],
      reasoning: { effort: modelConfig.reasoningEffort || 'medium' },
      text: { format: { type: 'json_object' as const } },
      max_output_tokens: Math.min(128000, modelConfig.maxOutput)
    }
    
    // Add MCP tools if requested
    if (includeMCP) {
      requestBody.tools = [
        {
          type: 'mcp',
          server_label: 'context7',
          server_url: 'https://mcp.context7.com/mcp',
          allowed_tools: ['resolve-library-id', 'get-library-docs'],
          require_approval: 'never'
        }
      ]
      requestBody.tool_choice = 'auto'
    }
    
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[OpenAI] Making request ${includeMCP ? 'with' : 'without'} MCP tools`)
    }
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API request failed: ${response.status}`)
    }
    
    return response.json()
  }

  // Check if MCP is in cooldown
  const now = Date.now()
  const mcpAvailable = now > mcpDisabledUntil
  
  try {
    // First try: with MCP tools (if not in cooldown)
    if (mcpAvailable) {
      try {
        const data = await makeRequest(true)
      
      // Extract and parse response (same logic as before)
      let outputText: string | undefined = typeof data.output_text === 'string' ? data.output_text : undefined
      let contentObj: any | undefined
      
      if (!outputText && Array.isArray(data.output)) {
        outer: for (const item of data.output) {
          if (item && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (!c) continue
              if (c.type === 'json' && c.json && typeof c.json === 'object') {
                contentObj = c.json
                break outer
              }
              if (c.type === 'output_text' && typeof c.text === 'string') {
                outputText = c.text
                break outer
              }
            }
          }
        }
      }
      
      const content = contentObj ?? JSON.parse(outputText as string)
      
      // Validate parameters if needed
      if (generateParams && content.param_definitions) {
        const validation = validateGeneratedParameters(content.param_definitions)
        if (!validation.isValid) {
          console.warn('Parameter validation failed:', validation.errors)
        }
      }
      
        if (process.env.NODE_ENV !== 'production') {
          console.log('[OpenAI] Request with MCP tools succeeded')
        }
        
        return {
          reasoning: content.reasoning,
          explanation: content.explanation,
          code: content.code,
          description: content.description || content.reasoning,
          param_definitions: content.param_definitions
        }
        
      } catch (mcpError) {
        // Check if error is dependency-related (expand to catch all dependency failures)
        const errorMessage = mcpError instanceof Error ? mcpError.message : String(mcpError)
        const isDependencyError = errorMessage.includes('Failed Dependency') || 
                                 errorMessage.includes('424') ||
                                 errorMessage.includes('MCP server') || 
                                 errorMessage.includes('context7') ||
                                 errorMessage.includes('dependency') ||
                                 errorMessage.includes('unavailable') ||
                                 errorMessage.includes('timeout')
        
        if (!isDependencyError) {
          // Not a dependency error, just rethrow
          throw mcpError
        }
        
        // Set 5-minute cooldown
        mcpDisabledUntil = Date.now() + (5 * 60 * 1000)
        const cooldownMinutes = 5
        console.warn(`[OpenAI] Dependency failure detected, disabling MCP for ${cooldownMinutes} minutes:`, errorMessage)
        
        // Fallback: try without MCP tools
        const data = await makeRequest(false)
      
      // Same response parsing logic
      let outputText: string | undefined = typeof data.output_text === 'string' ? data.output_text : undefined
      let contentObj: any | undefined
      
      if (!outputText && Array.isArray(data.output)) {
        outer: for (const item of data.output) {
          if (item && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (!c) continue
              if (c.type === 'json' && c.json && typeof c.json === 'object') {
                contentObj = c.json
                break outer
              }
              if (c.type === 'output_text' && typeof c.text === 'string') {
                outputText = c.text
                break outer
              }
            }
          }
        }
      }
      
      const content = contentObj ?? JSON.parse(outputText as string)
      
      if (generateParams && content.param_definitions) {
        const validation = validateGeneratedParameters(content.param_definitions)
        if (!validation.isValid) {
          console.warn('Parameter validation failed:', validation.errors)
        }
      }
      
        console.log('[OpenAI] Fallback request without MCP tools succeeded')
        
        return {
          reasoning: content.reasoning,
          explanation: content.explanation,
          code: content.code,
          description: content.description || content.reasoning,
          param_definitions: content.param_definitions
        }
      }
    } else {
      // MCP is in cooldown, skip directly to non-MCP request
      const remainingMinutes = Math.ceil((mcpDisabledUntil - now) / (60 * 1000))
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[OpenAI] MCP in cooldown for ${remainingMinutes} more minutes, using fallback`)
      }
      
      const data = await makeRequest(false)
      
      // Parse response
      let outputText: string | undefined = typeof data.output_text === 'string' ? data.output_text : undefined
      let contentObj: any | undefined
      
      if (!outputText && Array.isArray(data.output)) {
        outer: for (const item of data.output) {
          if (item && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (!c) continue
              if (c.type === 'json' && c.json && typeof c.json === 'object') {
                contentObj = c.json
                break outer
              }
              if (c.type === 'output_text' && typeof c.text === 'string') {
                outputText = c.text
                break outer
              }
            }
          }
        }
      }
      
      const content = contentObj ?? JSON.parse(outputText as string)
      
      if (generateParams && content.param_definitions) {
        const validation = validateGeneratedParameters(content.param_definitions)
        if (!validation.isValid) {
          console.warn('Parameter validation failed:', validation.errors)
        }
      }
      
      return {
        reasoning: content.reasoning,
        explanation: content.explanation,
        code: content.code,
        description: content.description || content.reasoning,
        param_definitions: content.param_definitions
      }
    }
    
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw error
  }
}

// Validation utilities
export function validateApiKey(key: string): boolean {
  return key.startsWith('sk-') && key.length > 20
}

export function validatePrompt(prompt: string): boolean {
  return prompt.trim().length >= 10
}

export function validateGuid(guid: string): boolean {
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return guidRegex.test(guid)
}

export function validateParameterName(name: string): boolean {
  const pythonIdentifierRegex = /^[a-z_][a-z0-9_]*$/i
  return pythonIdentifierRegex.test(name)
}

// Validate generated parameters
export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export function validateGeneratedParameters(paramDefinitions: any[]): ValidationResult {
  const errors: string[] = []
  const names = new Set<string>()
  let hasOutput = false
  const maxParamDescLen = 120
  
  if (!Array.isArray(paramDefinitions)) {
    return { isValid: false, errors: ['Parameters must be an array'] }
  }
  
  for (const param of paramDefinitions) {
    // Check parameter structure
    if (!param.type || !param.name) {
      errors.push('Parameter missing required fields (type, name)')
      continue
    }
    
    // Validate parameter name
    if (!validateParameterName(param.name)) {
      errors.push(`Invalid parameter name: "${param.name}" (must be valid Python identifier)`)
    }
    
    // Check for duplicates
    if (names.has(param.name)) {
      errors.push(`Duplicate parameter name: "${param.name}"`)
    }
    names.add(param.name)
    
    // Track outputs
    if (param.type === 'output') {
      hasOutput = true
    }
    
    // Validate input-specific fields
    if (param.type === 'input') {
      const validTypeHints = ['str', 'int', 'float', 'bool', 'guid', 'point', 'vector', 'curve', 'surface', 'brep', 'mesh', 'generic']
      if (!validTypeHints.includes(param.typehint)) {
        errors.push(`Invalid type hint for ${param.name}: "${param.typehint}"`)
      }
      
      const validAccess = ['item', 'list', 'tree']
      if (!validAccess.includes(param.access)) {
        errors.push(`Invalid access level for ${param.name}: "${param.access}"`)
      }
    }

    // Validate description presence and length for both input and output
    if (!param.description || typeof param.description !== 'string' || param.description.trim().length === 0) {
      errors.push(`Missing description for ${param.name}`)
    } else if (param.description.length > maxParamDescLen) {
      errors.push(`Description too long for ${param.name} (>${maxParamDescLen} chars)`) 
    }
  }
  
  // Check for at least one output
  if (!hasOutput) {
    errors.push('At least one output parameter is required')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Utility to check MCP status and cooldown
export function getMCPStatus(): { enabled: boolean; cooldownRemaining?: number } {
  const now = Date.now()
  const enabled = now > mcpDisabledUntil
  
  if (!enabled) {
    const remainingMs = mcpDisabledUntil - now
    const remainingMinutes = Math.ceil(remainingMs / (60 * 1000))
    return { enabled: false, cooldownRemaining: remainingMinutes }
  }
  
  return { enabled: true }
}

// Legacy function for compatibility
export function getMCPEnabled(): boolean {
  return getMCPStatus().enabled
}