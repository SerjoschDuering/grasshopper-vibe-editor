import { useEffect } from 'react'
import { useAppStore } from '@/store/app-store'

export function useClientInit() {
  useEffect(() => {
    // Initialize from localStorage after mount
    const savedAutoFetch = localStorage.getItem('autoFetch')
    const savedApiKey = localStorage.getItem('apiKey')
    const savedCollapsed = localStorage.getItem('collapsedCards')
    
    const store = useAppStore.getState()
    if (savedAutoFetch === 'true') {
      store.setAutoFetch(true)
    } else if (savedAutoFetch === 'false') {
      store.setAutoFetch(false)
    } else if (store.autoFetch) {
      // No saved preference; start auto-fetch if default is on
      store.setAutoFetch(true)
    }
    
    if (savedApiKey) {
      // Don't trigger setApiKey to avoid re-saving to localStorage
      useAppStore.setState({ apiKey: savedApiKey })
    }
    
    if (savedCollapsed) {
      try {
        const parsed = JSON.parse(savedCollapsed)
        useAppStore.setState({ collapsedCards: new Set(parsed) })
      } catch (e) {
        console.error('Failed to parse collapsed cards:', e)
      }
    }
  }, [])
}