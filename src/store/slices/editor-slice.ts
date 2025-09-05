/**
 * Editor slice - manages code editing and parameter management
 */

import { SliceCreator, EditorSlice, InputParameter, OutputParameter, Parameter } from '../types'
import { generateId } from '../utils/id-generator'
import { isDefaultOutput } from '../utils/parameter-utils'

const DEFAULT_CODE = `# Python code for the Grasshopper component
# Access inputs using their names if defined, e.g.:
# my_point = point_input
# numbers = list_of_numbers
#
# Or access by index (less robust if params change):
# x = IN[0]
#
# Assign results to output parameters by name:
# output = some_result
# curves_out = generated_curves

print("VibeCode Editor Ready")`

export const createEditorSlice: SliceCreator<EditorSlice> = (set, get) => ({
  code: DEFAULT_CODE,
  targetGuid: '',
  inputs: [],
  outputs: [
    {
      id: 'default_output',
      kind: 'output',
      name: 'output',
      description: 'Default output'
    }
  ],

  setCode: (code) => {
    // For now, just set the code directly
    // The component-cache slice will handle draft management
    set({ code })
  },

  setTargetGuid: (guid) => {
    set({ targetGuid: guid })
  },

  addInput: () => {
    const newInput: InputParameter = {
      id: generateId(),
      kind: 'input',
      name: `input_${get().inputs.length + 1}`,
      description: '',
      typehint: 'generic',
      access: 'item',
      optional: false
    }
    set(state => ({ inputs: [...state.inputs, newInput] }))
  },

  addOutput: () => {
    const newOutput: OutputParameter = {
      id: generateId(),
      kind: 'output',
      name: `output_${get().outputs.length + 1}`,
      description: ''
    }
    set(state => ({ outputs: [...state.outputs, newOutput] }))
  },

  updateParameter: (p) => {
    set(state => {
      if (p.kind === 'input') {
        return {
          inputs: state.inputs.map(inp => inp.id === p.id ? p as InputParameter : inp)
        }
      } else {
        // Prevent renaming default output
        if (isDefaultOutput(p) && 'name' in p) {
          const existing = state.outputs.find(o => o.id === p.id)
          if (existing && existing.name !== p.name) {
            return state
          }
        }
        return {
          outputs: state.outputs.map(out => out.id === p.id ? p as OutputParameter : out)
        }
      }
    })
  },

  removeParameter: (id) => {
    set(state => {
      const param = [...state.inputs, ...state.outputs].find(p => p.id === id)
      if (param && isDefaultOutput(param)) return state
      return {
        inputs: state.inputs.filter(p => p.id !== id),
        outputs: state.outputs.filter(p => p.id !== id)
      }
    })
  },

  reorderInputs: (activeId, overId) => {
    set(state => {
      const fromIndex = state.inputs.findIndex(p => p.id === activeId)
      const toIndex = state.inputs.findIndex(p => p.id === overId)
      if (fromIndex === -1 || toIndex === -1) return state

      const reorderedInputs = [...state.inputs]
      const [moved] = reorderedInputs.splice(fromIndex, 1)
      reorderedInputs.splice(toIndex, 0, moved)

      return { inputs: reorderedInputs }
    })
  },

  reorderOutputs: (activeId, overId) => {
    set(state => {
      // Don't allow reordering if either is the default output
      const activeParam = state.outputs.find(p => p.id === activeId)
      const overParam = state.outputs.find(p => p.id === overId)
      if (!activeParam || !overParam) return state
      if (isDefaultOutput(activeParam) || isDefaultOutput(overParam)) return state

      const fromIndex = state.outputs.findIndex(p => p.id === activeId)
      const toIndex = state.outputs.findIndex(p => p.id === overId)
      if (fromIndex === -1 || toIndex === -1) return state

      const reorderedOutputs = [...state.outputs]
      const [moved] = reorderedOutputs.splice(fromIndex, 1)
      reorderedOutputs.splice(toIndex, 0, moved)

      return { outputs: reorderedOutputs }
    })
  }
})