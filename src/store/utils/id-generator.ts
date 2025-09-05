/**
 * Utility for generating unique IDs for parameters and other entities
 */

export const generateId = () => {
  return `param_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}