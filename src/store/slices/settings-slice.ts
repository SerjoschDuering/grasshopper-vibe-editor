/**
 * Settings slice - manages API keys, preferences, and auto-fetch settings
 */

import { SliceCreator, SettingsSlice, InputParameter, OutputParameter } from '../types'
import { getInitialAutoFetch, getInitialApiKey } from '../utils/storage-utils'
import { generateId } from '../utils/id-generator'
import { computeRevisionFromGhData, toGhParamDefsForRevisionFromUi } from '../utils/revision-utils'
import { ComponentSnapshot } from '@/lib/types'

export const createSettingsSlice: SliceCreator<SettingsSlice> = (set, get) => ({
  apiKey: getInitialApiKey(),
  autoFetch: getInitialAutoFetch(),
  __GH_SERVER_URL: process.env.NEXT_PUBLIC_GH_SERVER_URL || 'http://127.0.0.1:9998',

  setApiKey: (key) => {
    set({ apiKey: key })
    if (typeof window !== 'undefined') {
      localStorage.setItem('apiKey', key)
    }
  },

  setAutoFetch: (on) => {
    set({ autoFetch: on })
    if (typeof window !== 'undefined') {
      localStorage.setItem('autoFetch', on.toString())
    }
    
    // We need to handle the auto-fetch polling here
    // Import dynamically to avoid circular dependency
    import('@/lib/grasshopper-api').then(({ startAutoFetch, stopAutoFetch }) => {
      if (on) {
        startAutoFetch(async () => {
          const state = get()
          if (state.loading.fetch || state.loading.send) return
          await get().fetchFromGrasshopper()
        })
        set(state => ({ 
          loading: { ...state.loading, autoFetch: true } 
        }))
      } else {
        stopAutoFetch()
        set(state => ({ 
          loading: { ...state.loading, autoFetch: false } 
        }))
      }
    })
  },

  toggleAutoFetch: () => {
    const newValue = !get().autoFetch
    get().setAutoFetch(newValue)
  },

  loadTestData: () => {
    const testCode = `import rhinoscriptsyntax as rs

def process_points(points, scale_factor=1.0):
    """Scale and process input points"""
    if not points:
        return []
    
    scaled_points = []
    for pt in points:
        if pt:
            # Scale point from origin
            scaled = rs.PointScale(pt, [0,0,0], [scale_factor]*3)
            scaled_points.append(scaled)
    
    return scaled_points

# Main execution
output = process_points(points, scale)`

    const testInputs: InputParameter[] = [
      {
        id: generateId(),
        kind: 'input',
        name: 'points',
        description: 'List of points to process',
        typehint: 'point',
        access: 'list',
        optional: false
      },
      {
        id: generateId(),
        kind: 'input',
        name: 'scale',
        description: 'Scale factor for points',
        typehint: 'float',
        access: 'item',
        optional: true
      }
    ]

    const testOutputs: OutputParameter[] = [
      {
        id: 'default_output',
        kind: 'output',
        name: 'output',
        description: 'Scaled points'
      }
    ]

    const serverRevision = computeRevisionFromGhData(
      testCode,
      toGhParamDefsForRevisionFromUi(testInputs, testOutputs)
    )

    const snap: ComponentSnapshot = {
      id: 'test-guid-12345',
      code: testCode,
      inputs: testInputs,
      outputs: testOutputs,
      serverRevision,
      fetchedAt: Date.now()
    }

    get().receiveServerSnapshot(snap)

    get().showStatus({ 
      message: 'Test data loaded', 
      type: 'success',
      duration: 3000 
    })
  }
})