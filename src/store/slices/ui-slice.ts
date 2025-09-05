/**
 * UI slice - manages theme, collapsed cards, and other UI state
 */

import { SliceCreator, UISlice } from '../types'
import { getInitialCollapsedCards, getInitialTheme } from '../utils/storage-utils'

export const createUISlice: SliceCreator<UISlice> = (set, get) => ({
  theme: getInitialTheme(),
  collapsedCards: getInitialCollapsedCards(),
  showChatHistory: false,

  setTheme: (theme) => {
    set({ theme })
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme)
    }
  },

  toggleCardCollapsed: (cardId) => {
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

  setShowChatHistory: (show) => {
    set({ showChatHistory: show })
  }
})