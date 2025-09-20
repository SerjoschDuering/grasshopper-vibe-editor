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
    // Update global code value
    set({ code })

    // If a component is selected, also update its draft to mark it as dirty
    const selectedId = get().selectedComponentId
    if (selectedId) {
      // Safely access updateDraft from the component cache slice
      const state = get() as any
      const updateDraft = state.updateDraft

      if (typeof updateDraft === 'function') {
        try {
          updateDraft(selectedId, (d: any) => ({ ...d, code }))
        } catch (error) {
          console.warn('Failed to update draft for code change:', error)
        }
      }
    }
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

    // Also update the draft if a component is selected
    const selectedId = get().selectedComponentId
    if (selectedId) {
      const updateDraft = (get() as any).updateDraft
      if (typeof updateDraft === 'function') {
        updateDraft(selectedId, (d: any) => ({
          ...d,
          inputs: [...d.inputs, newInput]
        }))
      }
    }
  },

  addOutput: () => {
    const newOutput: OutputParameter = {
      id: generateId(),
      kind: 'output',
      name: `output_${get().outputs.length + 1}`,
      description: ''
    }
    set(state => ({ outputs: [...state.outputs, newOutput] }))

    // Also update the draft if a component is selected
    const selectedId = get().selectedComponentId
    if (selectedId) {
      const updateDraft = (get() as any).updateDraft
      if (typeof updateDraft === 'function') {
        updateDraft(selectedId, (d: any) => ({
          ...d,
          outputs: [...d.outputs, newOutput]
        }))
      }
    }
  },

  updateParameter: (p) => {
    // Update the global state
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

    // Also update the draft if a component is selected
    const selectedId = get().selectedComponentId
    if (selectedId) {
      const updateDraft = (get() as any).updateDraft
      if (typeof updateDraft === 'function') {
        updateDraft(selectedId, (d: any) => {
          if (p.kind === 'input') {
            return {
              ...d,
              inputs: d.inputs.map((inp: InputParameter) => inp.id === p.id ? p as InputParameter : inp)
            }
          } else {
            // Prevent renaming default output in draft as well
            if (isDefaultOutput(p) && 'name' in p) {
              const existing = d.outputs.find((o: OutputParameter) => o.id === p.id)
              if (existing && existing.name !== p.name) {
                return d
              }
            }
            return {
              ...d,
              outputs: d.outputs.map((out: OutputParameter) => out.id === p.id ? p as OutputParameter : out)
            }
          }
        })
      }
    }
  },

  removeParameter: (id) => {
    // Check if it's the default output before removing
    const allParams = [...get().inputs, ...get().outputs]
    const param = allParams.find(p => p.id === id)
    if (param && isDefaultOutput(param)) return

    set(state => ({
      inputs: state.inputs.filter(p => p.id !== id),
      outputs: state.outputs.filter(p => p.id !== id)
    }))

    // Also update the draft if a component is selected
    const selectedId = get().selectedComponentId
    if (selectedId) {
      const updateDraft = (get() as any).updateDraft
      if (typeof updateDraft === 'function') {
        updateDraft(selectedId, (d: any) => {
          const draftParam = [...d.inputs, ...d.outputs].find((p: Parameter) => p.id === id)
          if (draftParam && isDefaultOutput(draftParam)) return d
          return {
            ...d,
            inputs: d.inputs.filter((p: InputParameter) => p.id !== id),
            outputs: d.outputs.filter((p: OutputParameter) => p.id !== id)
          }
        })
      }
    }
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

    // Also update the draft if a component is selected
    const selectedId = get().selectedComponentId
    if (selectedId) {
      const updateDraft = (get() as any).updateDraft
      if (typeof updateDraft === 'function') {
        updateDraft(selectedId, (d: any) => {
          const fromIndex = d.inputs.findIndex((p: InputParameter) => p.id === activeId)
          const toIndex = d.inputs.findIndex((p: InputParameter) => p.id === overId)
          if (fromIndex === -1 || toIndex === -1) return d

          const reorderedInputs = [...d.inputs]
          const [moved] = reorderedInputs.splice(fromIndex, 1)
          reorderedInputs.splice(toIndex, 0, moved)

          return { ...d, inputs: reorderedInputs }
        })
      }
    }
  },

  reorderOutputs: (activeId, overId) => {
    // Check if either is default output before any changes
    const outputs = get().outputs
    const activeParam = outputs.find(p => p.id === activeId)
    const overParam = outputs.find(p => p.id === overId)
    if (!activeParam || !overParam) return
    if (isDefaultOutput(activeParam) || isDefaultOutput(overParam)) return

    set(state => {
      const fromIndex = state.outputs.findIndex(p => p.id === activeId)
      const toIndex = state.outputs.findIndex(p => p.id === overId)
      if (fromIndex === -1 || toIndex === -1) return state

      const reorderedOutputs = [...state.outputs]
      const [moved] = reorderedOutputs.splice(fromIndex, 1)
      reorderedOutputs.splice(toIndex, 0, moved)

      return { outputs: reorderedOutputs }
    })

    // Also update the draft if a component is selected
    const selectedId = get().selectedComponentId
    if (selectedId) {
      const updateDraft = (get() as any).updateDraft
      if (typeof updateDraft === 'function') {
        updateDraft(selectedId, (d: any) => {
          // Don't allow reordering if either is the default output in draft
          const activeParam = d.outputs.find((p: OutputParameter) => p.id === activeId)
          const overParam = d.outputs.find((p: OutputParameter) => p.id === overId)
          if (!activeParam || !overParam) return d
          if (isDefaultOutput(activeParam) || isDefaultOutput(overParam)) return d

          const fromIndex = d.outputs.findIndex((p: OutputParameter) => p.id === activeId)
          const toIndex = d.outputs.findIndex((p: OutputParameter) => p.id === overId)
          if (fromIndex === -1 || toIndex === -1) return d

          const reorderedOutputs = [...d.outputs]
          const [moved] = reorderedOutputs.splice(fromIndex, 1)
          reorderedOutputs.splice(toIndex, 0, moved)

          return { ...d, outputs: reorderedOutputs }
        })
      }
    }
  }
})