// Feature flags configuration
export const features = {
  ENABLE_DRAG_DROP_REORDER: true,  // Enable drag & drop reordering for parameters
  USE_NEXT_GH_PROXY: false,        // Use Next.js API proxy for Grasshopper calls (if CORS issues)
}

// Helper to check if a feature is enabled
export const isFeatureEnabled = (feature: keyof typeof features): boolean => {
  // Check environment variable override first
  if (typeof window !== 'undefined') {
    const envOverride = process.env[`NEXT_PUBLIC_${feature}`]
    if (envOverride !== undefined) {
      return envOverride === 'true'
    }
  }
  return features[feature]
}