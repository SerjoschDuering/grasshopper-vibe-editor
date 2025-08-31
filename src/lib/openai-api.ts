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
}

// Model configuration
export const MODEL_CONFIG = {
  'gpt-5-nano': {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    description: 'Fastest and most cost-effective',
    pricing: { input: 0.05, output: 0.40 }, // per 1M tokens
    contextWindow: 128000,
    maxOutput: 16000,
    capabilities: ['basic', 'fast'],
    reasoningEffort: 'minimal'
  },
  'gpt-5-mini': {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    description: 'Balanced performance and cost',
    pricing: { input: 0.25, output: 2.00 },
    contextWindow: 128000,
    maxOutput: 16000,
    capabilities: ['standard', 'balanced'],
    reasoningEffort: 'medium'
  },
  'gpt-5': {
    id: 'gpt-5',
    name: 'GPT-5',
    description: 'Most capable model',
    pricing: { input: 1.25, output: 10.00 },
    contextWindow: 256000,
    maxOutput: 32000,
    capabilities: ['advanced', 'reasoning', 'long-context'],
    reasoningEffort: 'medium'
  }
} as const

export type ModelId = keyof typeof MODEL_CONFIG

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
- Available modules: rhinoscriptsyntax (as rs), ghpythonlib, scriptcontext
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

function buildSystemPrompt(generateParams: boolean, canvasContext?: string): string {
  const contexts = getEnabledContextProviders()
    .map(p => p.getContext())
    .filter(c => c.length > 0)
    .join('\n\n')

  // Add canvas context if available
  let enhancedContexts = contexts
  if (canvasContext) {
    enhancedContexts = contexts + '\n\n# Canvas Context\n' + canvasContext
  }

  const basePrompt = `
You are an expert Python programmer for Grasshopper components.

${enhancedContexts}

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

## Type Coercion (Essential for Robust Code)
- Points: rs.coerce3dpoint(obj) or provide default Point3d(0,0,0)
- Curves: rs.coercecurve(obj) and check if None
- Numbers: Use try/except with float() or int()
- GUIDs: rs.coerceguid(obj) when needed
- Always validate after coercion

## Error Handling (Production-Ready Patterns)
- Check for None/null inputs before processing
- Validate geometry: rs.IsPoint(), rs.IsCurve(), etc.
- Use try/except blocks for complex operations
- Provide meaningful error messages with print()
- Return empty lists or default values on error

## Output Assignment
- Always assign results to output parameter variable names
- Single output: output_name = result
- Multiple outputs: name each distinctly
- Trees are assigned directly after conversion

# Example Complete Component Pattern
Here's a production-ready component structure:

import rhinoscriptsyntax as rs
import ghpythonlib.treehelpers as th

# Type detection for robust handling
if hasattr(input_curves, 'BranchCount'):
    curves_nested = th.tree_to_list(input_curves)
    # Flatten if needed
    curves = [c for branch in curves_nested for c in branch]
elif isinstance(input_curves, list):
    curves = input_curves
else:
    curves = [input_curves] if input_curves else []

# Validate and process
results = []
for curve in curves:
    if curve and rs.IsCurve(curve):
        # Your processing here
        result = rs.CurveLength(curve)
        results.append(result)
    else:
        results.append(None)

# Assign to output
lengths = results

# Task
Generate ${generateParams ? 'Python code AND parameter definitions' : 'Python code only'} based on the user's prompt.

# Code Requirements
1. Use Python 2.7 syntax (NO f-strings, use .format() or % formatting)
2. Always include type detection for inputs (hasattr for DataTree check)
3. Import only what's needed (rs, th, gh, rg as appropriate)
4. Handle None/null inputs gracefully
5. Input parameters are available as variables by their names
6. Assign results to output parameter variables
7. Maintain tree structure when appropriate
8. Use proper type coercion (rs.coerce functions)

${generateParams ? `
# Parameter Requirements
1. Infer appropriate input parameters from the prompt
2. Use descriptive names (lowercase with underscores)
3. Choose appropriate type hints (str, int, float, bool, point, vector, curve, surface, brep, mesh, generic)
4. Set appropriate access levels (item, list, tree)
5. Mark parameters as optional when appropriate
6. Always include at least one output parameter
` : ''}

# Response Format
Return a JSON object with these fields:
{
  "reasoning": "Brief explanation of your approach",
  "explanation": "<=50 words, with line breaks (use \n between short lines)",
  "description": "1-2 sentence component description for documentation",
  "code": "The complete Python 2.7 code"${generateParams ? ',\n  "param_definitions": [\n    {"type": "input", "name": "param_name", "description": "what it does", "typehint": "str/int/float/etc", "access": "item/list/tree", "optional": true/false},\n    {"type": "output", "name": "result", "description": "what it outputs"}\n  ]' : ''}
}
`

  return basePrompt
}

// Removed buildJsonSchema - we're using simple JSON mode instead of strict schemas

export async function generateWithAI(options: AIGenerateOptions): Promise<AIResponse> {
  const { prompt, apiKey, state, generateParams, model = 'gpt-5-mini', contextData, selectedComponentId } = options
  
  // Validate model
  const modelConfig = MODEL_CONFIG[model as ModelId] || MODEL_CONFIG['gpt-5-mini']

  // Build the user message with current state
  let userMessage = prompt
  if (state.code && state.code.trim()) {
    userMessage += `\n\nCurrent code:\n\`\`\`python\n${state.code}\n\`\`\``
  }
  if (state.inputs.length > 0 || state.outputs.length > 0) {
    userMessage += '\n\nCurrent parameters:'
    state.inputs.forEach(input => {
      userMessage += `\n- Input: ${input.name} (${input.typehint}, ${input.access}${input.optional ? ', optional' : ''})`
    })
    state.outputs.forEach(output => {
      userMessage += `\n- Output: ${output.name}`
    })
  }

  // Generate canvas context if available and enabled
  let canvasContext = ''
  if (contextData && selectedComponentId) {
    // Import context utilities dynamically
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
      let markdown = generateMarkdownTemplate(slicedContext, detailLevel as any)
      
      // Replace selected component's code with placeholder
      const selectedComp = slicedContext.components.find(c => c.instanceGuid === selectedComponentId)
      if (selectedComp && selectedComp.scriptContent) {
        markdown = markdown.replace(
          selectedComp.scriptContent,
          '<YOUR_CODE_HERE: This is the component code you are working on - you have it separately>'
        )
      }
      
      canvasContext = markdown
    }
  }

  // GPT-5 uses the responses API
  const fullPrompt = buildSystemPrompt(generateParams, canvasContext) + '\n\n' + userMessage
  const requestBody = {
    model: modelConfig.id,
    input: fullPrompt,
    reasoning: { effort: modelConfig.reasoningEffort || 'medium' },  // Use medium reasoning effort
    text: {
      format: { type: 'json_object' as const }
    },
    max_output_tokens: Math.min(16000, modelConfig.maxOutput)
  }
  const apiEndpoint = 'https://api.openai.com/v1/responses'

  try {
    try {
      console.groupCollapsed('[OpenAI] Request')
      console.debug('Endpoint:', apiEndpoint)
      console.debug('Model:', requestBody.model)
      console.debug('Max output tokens:', requestBody.max_output_tokens)
      console.debug('Reasoning effort:', (requestBody as any).reasoning?.effort)
      console.debug('Text format:', (requestBody as any).text?.format)
      console.debug('Input preview:', fullPrompt.slice(0, 300) + (fullPrompt.length > 300 ? '…' : ''))
      console.groupEnd()
    } catch {}
    console.time('openai:responses')
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })
    console.timeEnd('openai:responses')

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API request failed: ${response.status}`)
    }

    // Log headers and raw body for debugging
    try {
      console.groupCollapsed('[OpenAI] Response meta')
      const headersObj: Record<string, string> = {}
      response.headers.forEach((v, k) => { headersObj[k] = v })
      console.debug('Status:', response.status)
      console.debug('Headers:', headersObj)
      const raw = await response.clone().text().catch(() => '(failed to read raw body)')
      console.debug('Raw body:', raw)
      console.groupEnd()
    } catch {}

    const data = await response.json()
    try { console.debug('[OpenAI] Parsed body:', data) } catch {}

    // Extract content: support output_text, message content 'output_text' | 'text', and structured 'json'
    let outputText: string | undefined = typeof data.output_text === 'string' ? data.output_text : undefined
    let contentObj: any | undefined
    if (!outputText && Array.isArray(data.output)) {
      // Walk output items and their content blocks
      outer: for (const item of data.output) {
        if (item && Array.isArray(item.content)) {
          for (const c of item.content) {
            if (!c) continue
            if (c.type === 'json' && c.json && typeof c.json === 'object') {
              contentObj = c.json
              break outer
            }
            if ((c.type === 'output_text' || c.type === 'text') && typeof c.text === 'string') {
              outputText = c.text
              break outer
            }
          }
        }
      }
    }

    if (!contentObj && (!outputText || typeof outputText !== 'string')) {
      // Surface unexpected shape to aid debugging
      try { console.debug('Unexpected OpenAI response shape', data) } catch {}
      throw new Error('Missing output text in OpenAI response')
    }

    const content = contentObj ?? JSON.parse(outputText as string)
    
    // Validate output if parameters were generated
    if (generateParams && content.param_definitions) {
      const validation = validateGeneratedParameters(content.param_definitions)
      if (!validation.isValid) {
        // TODO: Implement retry with gpt-5-nano for parameter regeneration
        // This would involve:
        // 1. Call gpt-5-nano with specific instructions to fix the parameters
        // 2. Include the validation errors in the prompt
        // 3. Retry once with the corrected parameters
        console.warn('Parameter validation failed:', validation.errors)
        // For now, we'll still return the result but log the issues
      }
    }
    
    return {
      reasoning: content.reasoning,
      explanation: content.explanation,
      code: content.code,
      description: content.description || content.reasoning,
      param_definitions: content.param_definitions
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