// Temporary file containing the full AI implementation to be added to the store
// This will be copied into the main store file

export const generateWithAIImplementation = async (get: any, set: any) => {
  const state = get()
  
  // Basic rate limiting - prevent rapid fire requests (3 second cooldown)
  const MIN_INTERVAL_MS = 3000
  const now = Date.now()
  if (state.aiLastGeneratedAt && (now - state.aiLastGeneratedAt) < MIN_INTERVAL_MS) {
    const remaining = Math.ceil((MIN_INTERVAL_MS - (now - state.aiLastGeneratedAt)) / 1000)
    get().showStatus({
      message: `Please wait ${remaining} seconds before generating again`,
      type: 'warning',
      duration: 3000
    })
    return
  }
  
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
  set((state: any) => ({ 
    loading: { ...state.loading, ai: true },
    aiPhase: 'building_prompt',
    aiStartedAt: startedAt,
    aiElapsedMs: 0,
    aiLastGeneratedAt: startedAt
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
    // Get chat context for the current component
    const selectedId = state.selectedComponentId
    let chatContext = ''
    if (selectedId) {
      chatContext = get().getChatContext(selectedId) // Get contextual chat history
    }
    
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
      selectedComponentId: state.selectedComponentId || undefined,
      image: state.aiImage || undefined,
      chatHistory: chatContext // Pass chat history to AI
    })
    
    // Inject minimal footer to persist component description inside GHPython before updating editor code
    let codeFromAI = result.code || ''
    try {
      const startMarker = '# --- VibeCode: auto-apply component description (begin)'
      const endMarker = '# --- VibeCode: auto-apply component description (end)'
      const desc = (result.description || '').trim()
      const pyDesc = JSON.stringify(desc)

      // 1) Replace any existing ghenv.Component.Description = "..." occurrences
      //    Handles both single and double quoted strings conservatively
      const descAssignRegex = /(ghenv\.Component\.Description\s*=\s*)(["'])(?:[^"'\\]|\\.|\n)*?\2/g
      const hasExistingDescAssignment = descAssignRegex.test(codeFromAI)
      if (desc.length > 0 && hasExistingDescAssignment) {
        // Reset regex pointer before replace
        descAssignRegex.lastIndex = 0
        codeFromAI = codeFromAI.replace(descAssignRegex, '$1' + pyDesc)
      } else {
        // 2) If a VibeCode marker block exists, update inside it
        const startIdx = codeFromAI.indexOf(startMarker)
        const endIdx = codeFromAI.indexOf(endMarker)
        if (desc.length > 0 && startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          const block = codeFromAI.slice(startIdx, endIdx)
          const updatedBlock = block.replace(descAssignRegex, '$1' + pyDesc)
          codeFromAI = codeFromAI.slice(0, startIdx) + updatedBlock + codeFromAI.slice(endIdx)
        } else if (desc.length > 0) {
          // 3) Otherwise append a fresh minimal block
          const footer = [
            '',
            startMarker,
            'try:',
            '    ghenv.Component.Description = ' + pyDesc,
            'except:',
            '    pass',
            endMarker,
            ''
          ].join('\n')
          codeFromAI = (codeFromAI || '').replace(/\s+$/, '') + footer
        }
      }
    } catch {}
    
    // Save AI explanation and component description (code will be set by addChatEntry)
    set({ aiExplanation: result.explanation, aiComponentDescription: result.description })

    // Update parameters if requested
    if (state.aiGenerateParams && result.param_definitions) {
      const { generateId } = await import('./utils/id-generator')
      const newInputs: any[] = []
      const newOutputs: any[] = []
      
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
      const defaultOutput = {
        id: 'default_output',
        kind: 'output',
        name: 'output',
        description: 'Default output'
      }

      const outputsCombined = [defaultOutput, ...newOutputs]

      // Update parameters through the proper store functions
      // First, clear existing parameters (except default output)
      const currentInputs = get().inputs
      const currentOutputs = get().outputs

      // Clear existing inputs
      for (const input of currentInputs) {
        get().removeParameter(input.id)
      }

      // Clear non-default outputs
      for (const output of currentOutputs) {
        if (output.name.toLowerCase() !== 'output') {
          get().removeParameter(output.id)
        }
      }

      // Add new inputs
      for (const input of newInputs) {
        // Use a more direct approach to add the input with specific properties
        const addedInput = {
          id: input.id,
          kind: 'input' as const,
          name: input.name,
          description: input.description,
          typehint: input.typehint,
          access: input.access,
          optional: input.optional
        }
        set((state: any) => ({ inputs: [...state.inputs, addedInput] }))

        // Also update draft if component selected
        const selectedId = get().selectedComponentId
        if (selectedId && get().updateDraft) {
          get().updateDraft(selectedId, (d: any) => ({
            ...d,
            inputs: [...(d.inputs || []), addedInput]
          }))
        }
      }

      // Add new outputs (skip default as it already exists)
      for (const output of newOutputs) {
        const addedOutput = {
          id: output.id,
          kind: 'output' as const,
          name: output.name,
          description: output.description
        }
        set((state: any) => ({ outputs: [...state.outputs, addedOutput] }))

        // Also update draft if component selected
        const selectedId = get().selectedComponentId
        if (selectedId && get().updateDraft) {
          get().updateDraft(selectedId, (d: any) => ({
            ...d,
            outputs: [...(d.outputs || []), addedOutput]
          }))
        }
      }
    }
    
    // Save chat history entry for this component
    // IMPORTANT: The new addChatEntry will also update the code in the editor
    if (selectedId) {
      console.log('[AI] Adding chat entry for component:', selectedId)
      get().addChatEntry(
        selectedId,
        state.aiPrompt,
        codeFromAI,
        {
          reasoning: result.reasoning,
          explanation: result.explanation,
          description: result.description
        }
      )

      // CRITICAL: Always ensure code is updated even if chat entry logic fails
      // This fixes the bug where AI-generated fixes weren't being applied
      const currentCode = get().code
      if (currentCode !== codeFromAI) {
        console.log('[AI] Ensuring code update after chat entry')
        get().setCode(codeFromAI)
      }
    } else {
      // If no component selected, still update the code
      console.log('[AI] No component selected, updating code directly')
      get().setCode(codeFromAI)
    }
    
    set({ aiPhase: 'done', aiImage: null })
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
    set((state: any) => ({ 
      loading: { ...state.loading, ai: false }
    }))
  }
}