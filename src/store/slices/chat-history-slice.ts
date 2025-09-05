/**
 * Chat history slice - manages per-component AI chat history with simplified navigation
 * 
 * Key principles:
 * - Each entry stores the GENERATED code (output), not snapshots
 * - Navigation always shows the generated code from that interaction
 * - Going back and generating new code creates a branch (deletes future entries)
 * - Simple, consistent, and predictable behavior
 */

import { SliceCreator } from '../types'
import { generateId } from '../utils/id-generator'

// Simplified chat entry - stores only the generated output
export interface ChatEntry {
  id: string
  prompt: string
  generatedCode: string  // The code that was generated (OUTPUT)
  timestamp: number
  // Optional AI response metadata for display
  metadata?: {
    reasoning?: string
    explanation?: string
    description?: string
  }
}

// Simplified chat state
export interface ComponentChatState {
  entries: ChatEntry[]
  currentIndex: number  // Index of the entry whose code is currently shown
}

// Slice interface
export interface ChatHistorySlice {
  // Storage: componentId -> chat state
  chatByComponent: Record<string, ComponentChatState>
  
  // Core actions
  addChatEntry: (componentId: string, prompt: string, generatedCode: string, metadata?: any) => void
  navigateToEntry: (componentId: string, index: number) => void
  undoChat: (componentId: string) => boolean
  redoChat: (componentId: string) => boolean
  clearChatHistory: (componentId: string) => void
  
  // Helpers
  getChatHistory: (componentId: string) => ChatEntry[]
  getCurrentIndex: (componentId: string) => number
  getChatContext: (componentId: string) => string
  canUndo: (componentId: string) => boolean
  canRedo: (componentId: string) => boolean
}

const MAX_HISTORY_SIZE = 50
const CONTEXT_PREVIEW_LENGTH = 500

export const createChatHistorySlice: SliceCreator<ChatHistorySlice> = (set, get) => ({
  chatByComponent: {},

  addChatEntry: (componentId, prompt, generatedCode, metadata) => {
    const entry: ChatEntry = {
      id: generateId(),
      prompt,
      generatedCode,
      timestamp: Date.now(),
      metadata
    }

    set(state => {
      const currentState = state.chatByComponent[componentId] || {
        entries: [],
        currentIndex: -1
      }

      let newEntries = [...currentState.entries]
      
      // If we're not at the latest, create a branch by removing future entries
      if (currentState.currentIndex >= 0 && currentState.currentIndex < currentState.entries.length - 1) {
        newEntries = newEntries.slice(0, currentState.currentIndex + 1)
        console.log(`[Chat History] Creating branch from index ${currentState.currentIndex}, removing ${currentState.entries.length - currentState.currentIndex - 1} future entries`)
      }

      // Add the new entry
      newEntries.push(entry)

      // Trim if exceeds max size
      if (newEntries.length > MAX_HISTORY_SIZE) {
        newEntries = newEntries.slice(-MAX_HISTORY_SIZE)
      }

      const newIndex = newEntries.length - 1

      // IMPORTANT: Update the code in the editor
      const selectedId = state.selectedComponentId
      if (selectedId === componentId && state.setCode) {
        console.log(`[Chat History] Setting code for component ${componentId}`)
        state.setCode(generatedCode)
        
        // Also update draft if needed
        if (state.updateDraft) {
          state.updateDraft(componentId, (draft) => ({
            ...draft,
            code: generatedCode
          }))
        }
      }

      return {
        chatByComponent: {
          ...state.chatByComponent,
          [componentId]: {
            entries: newEntries,
            currentIndex: newIndex
          }
        }
      }
    })
  },

  navigateToEntry: (componentId, index) => {
    const state = get()
    const chatState = state.chatByComponent[componentId]
    
    if (!chatState || index < 0 || index >= chatState.entries.length) {
      console.error(`[Chat History] Invalid navigation: component=${componentId}, index=${index}`)
      return
    }

    const entry = chatState.entries[index]
    const selectedId = state.selectedComponentId
    
    // Update the code if this is the selected component
    if (selectedId === componentId && state.setCode) {
      console.log(`[Chat History] Navigating to entry ${index}, setting code`)
      state.setCode(entry.generatedCode)
      
      // Update draft as well
      if (state.updateDraft) {
        state.updateDraft(componentId, (draft) => ({
          ...draft,
          code: entry.generatedCode
        }))
      }
    }

    // Update the current index
    set(state => ({
      chatByComponent: {
        ...state.chatByComponent,
        [componentId]: {
          ...chatState,
          currentIndex: index
        }
      }
    }))
  },

  undoChat: (componentId) => {
    const state = get()
    const chatState = state.chatByComponent[componentId]
    
    if (!chatState || chatState.entries.length === 0) return false
    
    // Can't undo if we're at the first entry (index 0)
    if (chatState.currentIndex <= 0) {
      console.log(`[Chat History] Cannot undo: already at first entry`)
      return false
    }

    const newIndex = chatState.currentIndex - 1
    get().navigateToEntry(componentId, newIndex)
    return true
  },

  redoChat: (componentId) => {
    const state = get()
    const chatState = state.chatByComponent[componentId]
    
    if (!chatState || chatState.entries.length === 0) return false
    
    // Can't redo if we're at the latest
    if (chatState.currentIndex >= chatState.entries.length - 1) {
      console.log(`[Chat History] Cannot redo: already at latest entry`)
      return false
    }

    const newIndex = chatState.currentIndex + 1
    get().navigateToEntry(componentId, newIndex)
    return true
  },

  clearChatHistory: (componentId) => {
    set(state => ({
      chatByComponent: {
        ...state.chatByComponent,
        [componentId]: {
          entries: [],
          currentIndex: -1
        }
      }
    }))
    
    // IMPORTANT: Keep the current code in the editor!
    // The user wants to clear history but continue working with the current code
    console.log(`[Chat History] Cleared history for component ${componentId}, keeping current code`)
  },

  getChatHistory: (componentId) => {
    const chatState = get().chatByComponent[componentId]
    return chatState?.entries || []
  },

  getCurrentIndex: (componentId) => {
    const chatState = get().chatByComponent[componentId]
    return chatState?.currentIndex ?? -1
  },

  getChatContext: (componentId) => {
    const chatState = get().chatByComponent[componentId]
    if (!chatState || chatState.entries.length === 0) return ''

    const entries = chatState.entries
    const currentIdx = chatState.currentIndex
    const contextParts: string[] = ['<chat_history>']

    // Include all entries up to and including current
    const relevantEntries = entries.slice(0, currentIdx + 1)
    
    // Show last 3 entries in detail, summarize the rest
    const detailCount = 3
    const summaryCount = Math.max(0, relevantEntries.length - detailCount)

    // Add summarized older entries
    for (let i = 0; i < summaryCount; i++) {
      const entry = relevantEntries[i]
      contextParts.push(`<interaction_${i + 1}>`)
      contextParts.push(`  <human>${entry.prompt}</human>`)
      contextParts.push(`  <assistant_summary>Code generated successfully</assistant_summary>`)
      contextParts.push(`</interaction_${i + 1}>`)
    }

    // Add detailed recent entries
    for (let i = summaryCount; i < relevantEntries.length; i++) {
      const entry = relevantEntries[i]
      contextParts.push(`<interaction_${i + 1}_full>`)
      contextParts.push(`  <human>${entry.prompt}</human>`)
      contextParts.push(`  <assistant>`)
      
      if (entry.metadata?.reasoning) {
        contextParts.push(`    <reasoning>${entry.metadata.reasoning}</reasoning>`)
      }
      if (entry.metadata?.explanation) {
        contextParts.push(`    <explanation>${entry.metadata.explanation}</explanation>`)
      }
      
      const codePreview = entry.generatedCode.slice(0, CONTEXT_PREVIEW_LENGTH)
      contextParts.push(`    <code_generated>${codePreview}${entry.generatedCode.length > CONTEXT_PREVIEW_LENGTH ? '...' : ''}</code_generated>`)
      contextParts.push(`  </assistant>`)
      contextParts.push(`</interaction_${i + 1}_full>`)
    }

    contextParts.push('</chat_history>')
    
    // Add navigation context if not at latest
    if (currentIdx < entries.length - 1) {
      contextParts.push('\n<navigation_note>')
      contextParts.push(`User has navigated back to interaction ${currentIdx + 1} of ${entries.length}.`)
      contextParts.push('Future interactions have been hidden and will be deleted if new code is generated.')
      contextParts.push('</navigation_note>')
    }
    
    return contextParts.join('\n')
  },

  canUndo: (componentId) => {
    const chatState = get().chatByComponent[componentId]
    if (!chatState || chatState.entries.length === 0) return false
    return chatState.currentIndex > 0
  },

  canRedo: (componentId) => {
    const chatState = get().chatByComponent[componentId]
    if (!chatState || chatState.entries.length === 0) return false
    return chatState.currentIndex < chatState.entries.length - 1
  }
})