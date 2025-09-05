/**
 * Utilities for computing and managing component revisions
 */

import { InputParameter, OutputParameter } from '@/lib/types'

export type GhParamForRevision =
  | { type: 'input'; name: string; description: string; typehint: string; access: string; optional: boolean }
  | { type: 'output'; name: string; description: string }

export function computeRevisionFromGhData(code: string, paramDefs: GhParamForRevision[]): string {
  // Normalize and sort deterministically by type then name to avoid spurious diffs
  const normalized = paramDefs.map(p => {
    if (p.type === 'input') {
      return { t: 'i', n: p.name, d: p.description || '', th: p.typehint, a: p.access, o: !!p.optional }
    }
    return { t: 'o', n: p.name, d: p.description || '' }
  }).sort((a: any, b: any) => (a.t === b.t ? a.n.localeCompare(b.n) : a.t.localeCompare(b.t)))

  const s = JSON.stringify({ code: code || '', params: normalized })
  let h = 0
  for (let i = 0; i < s.length; i++) { 
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0 
  }
  return String(h)
}

export function toGhParamDefsForRevisionFromUi(
  inputs: InputParameter[], 
  outputs: OutputParameter[]
): GhParamForRevision[] {
  const arr: GhParamForRevision[] = []
  for (const i of inputs) {
    arr.push({ 
      type: 'input', 
      name: i.name, 
      description: i.description || '', 
      typehint: i.typehint, 
      access: i.access, 
      optional: !!i.optional 
    })
  }
  for (const o of outputs) {
    arr.push({ 
      type: 'output', 
      name: o.name, 
      description: o.description || '' 
    })
  }
  return arr
}