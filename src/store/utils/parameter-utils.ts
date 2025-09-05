/**
 * Utilities for parameter manipulation and validation
 */

import { Parameter } from '@/lib/types'

export const isDefaultOutput = (p: Parameter): boolean => {
  return p.kind === 'output' && p.name.toLowerCase() === 'output'
}