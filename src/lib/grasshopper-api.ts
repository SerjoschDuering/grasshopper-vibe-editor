import { 
  InputParameter, 
  OutputParameter, 
  GrasshopperUpdatePayload,
  ParameterTypeHint,
  ParameterAccess 
} from '@/lib/types'

const GH_BASE_URL = process.env.NEXT_PUBLIC_GH_BASE_URL ?? 'http://127.0.0.1:9998'
const FETCH_TIMEOUT = 5000 // 5 seconds timeout
const MAX_RETRIES = 3 // Increased retries
const RETRY_DELAY = 1000 // 1 second between retries
const RECONNECT_DELAY = 5000 // 5 seconds before auto-reconnect attempt
const MAX_RECONNECT_ATTEMPTS = 3
const POLL_INTERVAL = 2000 // ms - consistent fast polling for real-time sync

let autoFetchInterval: NodeJS.Timeout | null = null
let connectionFailures = 0
const MAX_CONSECUTIVE_FAILURES = 3 // Reduced to trigger recovery faster
let isReconnecting = false
let reconnectAttempts = 0

interface GrasshopperResponse {
  status: 'success' | 'none_selected' | 'multiple_selected' | 'error'
  result?: {
    instance_guid?: string
    code?: string
    description?: string
    param_definitions?: Array<{
      type: 'input' | 'output'
      name: string
      description: string
      typehint?: ParameterTypeHint
      access?: ParameterAccess
      optional?: boolean
    }>
  } | string  // result can also be an error string
}

// Helper function to fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if ((error as any)?.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}

// Helper function to retry failed requests
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  retries: number = MAX_RETRIES
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetchWithTimeout(url, options)
      connectionFailures = 0 // Reset failure counter on success
      reconnectAttempts = 0 // Reset reconnect attempts on success
      isReconnecting = false
      
      // Update connection health in store
      const store = (await import('@/store/app-store')).useAppStore.getState()
      store.updateConnectionHealth({
        status: 'connected',
        lastSuccessfulFetch: Date.now(),
        consecutiveFailures: 0
      })
      
      return response
    } catch (error) {
      if (i === retries) {
        connectionFailures++
        
        // Update connection health in store
        const store = (await import('@/store/app-store')).useAppStore.getState()
        store.updateConnectionHealth({
          status: connectionFailures >= MAX_CONSECUTIVE_FAILURES ? 'disconnected' : 'connected',
          consecutiveFailures: connectionFailures
        })
        
        throw error
      }
      // Exponential backoff for retries
      const delay = RETRY_DELAY * Math.pow(1.5, i)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

export async function getSelectedComponent(): Promise<GrasshopperResponse> {
  const tryTypes = [
    'get_selected_script_component',
    'get_selected_python_component',
    'get_selected_component'
  ] as const

  for (const t of tryTypes) {
    try {
      const response = await fetchWithRetry(GH_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ type: t }),
        mode: 'cors'
      }, 1) // Less retries for component selection
      
      if (!response.ok) continue
      const data = await response.json()
      if ((data as any)?.status === 'success') return data
      if ((data as any)?.status === 'none_selected' || (data as any)?.status === 'multiple_selected') return data
    } catch (error) {
      console.warn(`Failed to fetch with type ${t}:`, error)
      // try next
    }
  }

  // Final attempt: explicit error for visibility
  return { status: 'error', result: 'Failed to fetch selected component' }
}

// Attempt to fetch a specific component by GUID. Tries known message types with graceful fallback.
export async function getComponentByGuid(instanceGuid: string): Promise<GrasshopperResponse> {
  const tryTypes = [
    'get_script_component',
    'get_python_component',
    'get_component_by_guid'
  ] as const

  for (const t of tryTypes) {
    try {
      const response = await fetchWithRetry(GH_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          type: t,
          instance_guid: instanceGuid
        }),
        mode: 'cors'
      }, 1) // Less retries for component fetching
      
      if (!response.ok) continue
      const data = await response.json()
      if ((data as any)?.status === 'success') return data
    } catch (error) {
      console.warn(`Failed to fetch component by GUID with type ${t}:`, error)
      // try next
    }
  }

  // Final fallback to selected (may not match desired guid)
  return getSelectedComponent()
}

export async function updateScript(payload: GrasshopperUpdatePayload): Promise<GrasshopperResponse> {
  try {
    const response = await fetchWithRetry(GH_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      mode: 'cors'
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error sending to Grasshopper:', error)
    throw error
  }
}

// Lightweight reachability probe using GH server health endpoint
export async function checkServerReachable(timeoutMs: number = 3000): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${GH_BASE_URL}/healthz`, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain'
      },
      mode: 'cors'
    }, timeoutMs)
    return response.ok
  } catch (e) {
    return false
  }
}

export function mapStoreToParamDefinitions(
  inputs: InputParameter[], 
  outputs: OutputParameter[]
): GrasshopperUpdatePayload['param_definitions'] {
  const paramDefinitions: GrasshopperUpdatePayload['param_definitions'] = []

  // Map inputs
  for (const input of inputs) {
    paramDefinitions.push({
      type: 'input',
      name: input.name,
      description: input.description || '',
      typehint: input.typehint,
      access: input.access,
      optional: input.optional
    })
  }

  // Map outputs
  for (const output of outputs) {
    paramDefinitions.push({
      type: 'output',
      name: output.name,
      description: output.description || ''
    })
  }

  return paramDefinitions
}

export function startAutoFetch(onTick: () => Promise<void>): void {
  // Clear any existing interval
  stopAutoFetch()
  
  // Reset connection failure counter when starting
  connectionFailures = 0
  isReconnecting = false
  reconnectAttempts = 0

  // Start consistent fast polling for real-time sync
  autoFetchInterval = setInterval(() => {
    // Wrap the async call to properly handle unhandled promise rejections
    onTick().then(() => {
      // Reset failures on success
      connectionFailures = 0
    }).catch((error) => {
      console.error('Auto-fetch error:', error)
      
      // Track connection failures
      connectionFailures++
      
      // If we've had too many consecutive failures, attempt reconnection
      if (connectionFailures >= MAX_CONSECUTIVE_FAILURES && !isReconnecting) {
        isReconnecting = true
        console.warn('Connection issues detected, attempting to reconnect...')
        
        // Don't stop auto-fetch immediately, try to recover
        import('@/store/app-store').then(({ useAppStore }) => {
          const store = useAppStore.getState()
          store.updateConnectionHealth({
            status: 'reconnecting',
            consecutiveFailures: connectionFailures,
            message: 'Attempting to reconnect...'
          })
          store.showStatus({
            message: 'Connection unstable. Attempting to reconnect...',
            type: 'warning',
            duration: 3000
          })
          
          // Attempt reconnection with exponential backoff
          attemptReconnection(onTick)
        }).catch((importError) => {
          console.error('Failed to load store for reconnection:', importError)
        })
      }
    })
  }, POLL_INTERVAL)
}

// New function to handle reconnection attempts
async function attemptReconnection(onTick: () => Promise<void>): Promise<void> {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('Max reconnection attempts reached')
    stopAutoFetch()
    const store = (await import('@/store/app-store')).useAppStore.getState()
    store.updateConnectionHealth({
      status: 'disconnected',
      message: 'Connection lost. Please check GH server.',
      consecutiveFailures: connectionFailures
    })
    store.showStatus({
      message: 'Connection lost. Please check GH server and refresh the page.',
      type: 'error',
      duration: 0 // Persistent message
    })
    return
  }
  
  reconnectAttempts++
  const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1)
  
  setTimeout(async () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`)
    }
    
    if (await checkServerReachable(1000)) {
      // Server is back!
      if (process.env.NODE_ENV !== 'production') {
        console.log('Server connection restored')
      }
      connectionFailures = 0
      reconnectAttempts = 0
      isReconnecting = false
      
      const store = (await import('@/store/app-store')).useAppStore.getState()
      store.updateConnectionHealth({
        status: 'connected',
        lastSuccessfulFetch: Date.now(),
        consecutiveFailures: 0,
        message: undefined
      })
      store.showStatus({
        message: 'Connection restored!',
        type: 'success',
        duration: 3000
      })
      
      // Resume normal operation if auto-fetch was stopped
      if (!isAutoFetchRunning()) {
        startAutoFetch(onTick)
      }
    } else {
      // Continue trying
      attemptReconnection(onTick)
    }
  }, delay)
}

export function stopAutoFetch(): void {
  if (autoFetchInterval) {
    clearInterval(autoFetchInterval)
    autoFetchInterval = null
  }
}

export function isAutoFetchRunning(): boolean {
  return autoFetchInterval !== null
}