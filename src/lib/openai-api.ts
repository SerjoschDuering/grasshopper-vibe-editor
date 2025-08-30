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
}

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
    enabled: false,
    priority: 4,
    getContext: () => '# Canvas state context (not implemented yet)'
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

function buildSystemPrompt(generateParams: boolean): string {
  const contexts = getEnabledContextProviders()
    .map(p => p.getContext())
    .filter(c => c.length > 0)
    .join('\n\n')

  const basePrompt = `
You are an expert Python programmer for Grasshopper components.

${contexts}

# Task
Generate ${generateParams ? 'Python code AND parameter definitions' : 'Python code only'} based on the user's prompt.

# Code Requirements
1. Use Python 2.7 syntax (NO f-strings, use .format() or % formatting)
2. Import rhinoscriptsyntax as rs when needed
3. Handle edge cases and None/null values
4. Include helpful comments
5. Input parameters are available as variables by their names
6. Assign results to output parameter variables

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
Provide a JSON response with:
- reasoning: Brief explanation of the approach
- code: The Python code
${generateParams ? '- param_definitions: Array of parameter definitions' : ''}
`

  return basePrompt
}

function buildJsonSchema(generateParams: boolean): any {
  const schema: any = {
    type: 'object',
    properties: {
      reasoning: {
        type: 'string',
        description: 'Brief explanation of the approach'
      },
      code: {
        type: 'string',
        description: 'Python 2.7 code for the Grasshopper component'
      }
    },
    required: ['reasoning', 'code']
  }

  if (generateParams) {
    schema.properties.param_definitions = {
      type: 'array',
      items: {
        oneOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'input' },
              name: { type: 'string' },
              description: { type: 'string' },
              typehint: {
                enum: ['str', 'int', 'float', 'bool', 'guid', 'point', 'vector', 'curve', 'surface', 'brep', 'mesh', 'generic']
              },
              access: {
                enum: ['item', 'list', 'tree']
              },
              optional: { type: 'boolean' }
            },
            required: ['type', 'name', 'description', 'typehint', 'access', 'optional']
          },
          {
            type: 'object',
            properties: {
              type: { const: 'output' },
              name: { type: 'string' },
              description: { type: 'string' }
            },
            required: ['type', 'name', 'description']
          }
        ]
      }
    }
    schema.required.push('param_definitions')
  }

  return schema
}

export async function generateWithAI(options: AIGenerateOptions): Promise<AIResponse> {
  const { prompt, apiKey, state, generateParams } = options

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

  const requestBody = {
    model: 'gpt-4o',
    messages: [
      {
        role: 'system' as const,
        content: buildSystemPrompt(generateParams)
      },
      {
        role: 'user' as const,
        content: userMessage
      }
    ],
    response_format: {
      type: 'json_schema' as const,
      json_schema: {
        name: 'grasshopper_component',
        description: 'Grasshopper Python component code and parameters',
        schema: buildJsonSchema(generateParams),
        strict: true
      }
    },
    temperature: 0.3
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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

    const data = await response.json()
    const content = JSON.parse(data.choices[0].message.content)
    
    return {
      reasoning: content.reasoning,
      code: content.code,
      description: content.reasoning,
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