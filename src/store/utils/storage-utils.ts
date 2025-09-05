/**
 * LocalStorage utilities for persisting user preferences
 */

import { ModelId } from '@/lib/openai-api'

export const getInitialAutoFetch = (): boolean => {
  if (typeof window === 'undefined') return true
  const stored = localStorage.getItem('autoFetch')
  return stored !== null ? stored === 'true' : true
}

export const getInitialApiKey = (): string => {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('apiKey') || ''
}

export const getInitialAiModel = (): ModelId => {
  if (typeof window === 'undefined') return 'gpt-5-mini'
  const stored = localStorage.getItem('aiModel') as ModelId
  return stored || 'gpt-5-mini'
}

export const getInitialCollapsedCards = (): Set<string> => {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem('collapsedCards')
    if (stored) {
      return new Set(JSON.parse(stored))
    }
  } catch {}
  return new Set()
}

export const getInitialTheme = (): 'classic' | 'ocean' | 'grape' | 'dark' => {
  if (typeof window === 'undefined') return 'classic'
  const stored = localStorage.getItem('theme') as 'classic' | 'ocean' | 'grape' | 'dark'
  return stored || 'classic'
}

export const getInitialActiveTab = (): 'coding' | 'context' | 'docs' => {
  if (typeof window === 'undefined') return 'coding'
  const stored = localStorage.getItem('vibecode_activeTab') as 'coding' | 'context' | 'docs'
  return stored || 'coding'
}