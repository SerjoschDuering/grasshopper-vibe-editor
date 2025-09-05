/**
 * Component cache slice - manages component snapshots and drafts
 */

import { SliceCreator, ComponentCacheSlice, ComponentDraft, ComponentSnapshot, ComponentRecord, ComponentsById, ComponentId } from '../types'

export const createComponentCacheSlice: SliceCreator<ComponentCacheSlice> = (set, get) => ({
  componentsById: {},
  selectedComponentId: null,

  receiveServerSnapshot: (snap) => {
    set(state => {
      const currentRec = state.componentsById[snap.id]
      const prevSnap = currentRec?.snapshot
      let nextRec: ComponentRecord

      if (prevSnap && prevSnap.serverRevision === snap.serverRevision) {
        nextRec = {
          snapshot: { ...prevSnap, fetchedAt: snap.fetchedAt },
          draft: currentRec?.draft ?? null
        }
      } else {
        if (!currentRec?.draft) {
          nextRec = {
            snapshot: snap,
            draft: {
              id: snap.id,
              code: snap.code,
              inputs: snap.inputs,
              outputs: snap.outputs,
              dirty: false,
              baseRevision: snap.serverRevision,
              isBaseOutdated: false
            }
          }
        } else if (currentRec.draft.dirty) {
          nextRec = {
            snapshot: snap,
            draft: { ...currentRec.draft, isBaseOutdated: currentRec.draft.baseRevision !== snap.serverRevision }
          }
        } else {
          nextRec = {
            snapshot: snap,
            draft: {
              ...currentRec.draft,
              code: snap.code,
              inputs: snap.inputs,
              outputs: snap.outputs,
              dirty: false,
              baseRevision: snap.serverRevision,
              isBaseOutdated: false
            }
          }
        }
      }

      const nextMap: ComponentsById = { ...state.componentsById, [snap.id]: nextRec }
      const code = nextRec.draft ? nextRec.draft.code : state.code
      const inputs = nextRec.draft ? nextRec.draft.inputs : state.inputs
      const outputs = nextRec.draft ? nextRec.draft.outputs : state.outputs

      return {
        componentsById: nextMap,
        selectedComponentId: snap.id,
        targetGuid: snap.id,
        code,
        inputs,
        outputs
      }
    })
  },

  updateDraft: (id, updater) => {
    set(state => {
      const currentRec = state.componentsById[id]
      const baseSnap = currentRec?.snapshot ?? {
        id,
        code: state.code,
        inputs: state.inputs,
        outputs: state.outputs,
        serverRevision: '0',
        fetchedAt: Date.now()
      }
      const currDraft: ComponentDraft = currentRec?.draft ?? {
        id,
        code: baseSnap.code,
        inputs: baseSnap.inputs,
        outputs: baseSnap.outputs,
        dirty: false,
        baseRevision: baseSnap.serverRevision,
        isBaseOutdated: false
      }
      const nextDraft = { ...updater(currDraft), dirty: true, lastEditedAt: Date.now() }
      const nextRec: ComponentRecord = { snapshot: currentRec?.snapshot ?? baseSnap, draft: nextDraft }
      const nextMap: ComponentsById = { ...state.componentsById, [id]: nextRec }

      const partial: any = { componentsById: nextMap }
      if (state.selectedComponentId === id) {
        partial.code = nextDraft.code
        partial.inputs = nextDraft.inputs
        partial.outputs = nextDraft.outputs
      }
      return partial
    })
  },

  markDraftClean: (id, snap) => {
    set(state => {
      const nextRec: ComponentRecord = {
        snapshot: snap,
        draft: {
          id,
          code: snap.code,
          inputs: snap.inputs,
          outputs: snap.outputs,
          dirty: false,
          baseRevision: snap.serverRevision,
          isBaseOutdated: false
        }
      }
      const nextMap: ComponentsById = { ...state.componentsById, [id]: nextRec }
      const partial: any = { componentsById: nextMap }
      if (state.selectedComponentId === id) {
        partial.code = snap.code
        partial.inputs = snap.inputs
        partial.outputs = snap.outputs
      }
      return partial
    })
  },

  discardDraft: (id) => {
    set(state => {
      const rec = state.componentsById[id]
      if (!rec?.snapshot) return {}
      const nextDraft: ComponentDraft = {
        id,
        code: rec.snapshot.code,
        inputs: rec.snapshot.inputs,
        outputs: rec.snapshot.outputs,
        dirty: false,
        baseRevision: rec.snapshot.serverRevision,
        isBaseOutdated: false
      }
      const nextMap: ComponentsById = { ...state.componentsById, [id]: { snapshot: rec.snapshot, draft: nextDraft } }
      const partial: any = { componentsById: nextMap }
      if (state.selectedComponentId === id) {
        partial.code = nextDraft.code
        partial.inputs = nextDraft.inputs
        partial.outputs = nextDraft.outputs
      }
      return partial
    })
  }
})