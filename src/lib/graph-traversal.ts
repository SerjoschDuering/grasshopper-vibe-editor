import { ProcessedContext, ContextComponent } from './context-utils'

/**
 * Get all upstream components from a starting component, traversing up to specified levels
 * @param componentGuid The starting component GUID
 * @param levels Number of levels to traverse upstream (0 = only the component itself)
 * @param processedContext The processed context containing component data and connections
 * @param visited Set of already visited component GUIDs to prevent cycles
 * @returns Array of component GUIDs including the starting component and all upstream components
 */
export function getUpstreamComponents(
  componentGuid: string,
  levels: number,
  processedContext: ProcessedContext,
  visited: Set<string> = new Set()
): string[] {
  // Prevent cycles and limit traversal
  if (levels < 0 || visited.has(componentGuid)) return []
  
  visited.add(componentGuid)
  const result = [componentGuid]
  
  // If we've reached the traversal limit, stop here
  if (levels === 0) return result
  
  const component = processedContext.componentMap[componentGuid]
  if (!component) return result
  
  // Find all components that feed into this one by checking which components have this one in their adjacency list
  const adjacencyList = (processedContext as any).adjacencyList || {}
  
  for (const [sourceGuid, targets] of Object.entries(adjacencyList)) {
    if ((targets as string[]).includes(componentGuid) && !visited.has(sourceGuid)) {
      const upstream = getUpstreamComponents(
        sourceGuid,
        levels - 1,
        processedContext,
        visited
      )
      result.push(...upstream)
    }
  }
  
  return Array.from(new Set(result)) // Remove duplicates
}

/**
 * Get all downstream components from a starting component, traversing up to specified levels
 * @param componentGuid The starting component GUID
 * @param levels Number of levels to traverse downstream (0 = only the component itself)
 * @param processedContext The processed context containing component data and connections
 * @param visited Set of already visited component GUIDs to prevent cycles
 * @returns Array of component GUIDs including the starting component and all downstream components
 */
export function getDownstreamComponents(
  componentGuid: string,
  levels: number,
  processedContext: ProcessedContext,
  visited: Set<string> = new Set()
): string[] {
  // Prevent cycles and limit traversal
  if (levels < 0 || visited.has(componentGuid)) return []
  
  visited.add(componentGuid)
  const result = [componentGuid]
  
  // If we've reached the traversal limit, stop here
  if (levels === 0) return result
  
  const component = processedContext.componentMap[componentGuid]
  if (!component) return result
  
  // Use the adjacencyList which already has component-to-component connections
  const downstreamComponents = (processedContext as any).adjacencyList?.[componentGuid] || []
  
  for (const downstreamGuid of downstreamComponents) {
    if (!visited.has(downstreamGuid)) {
      const downstream = getDownstreamComponents(
        downstreamGuid,
        levels - 1,
        processedContext,
        visited
      )
      result.push(...downstream)
    }
  }
  
  return Array.from(new Set(result)) // Remove duplicates
}

/**
 * Compute the context from selected components with upstream/downstream traversal
 * @param selectedGuids Array of selected component GUIDs
 * @param upstreamLevels Number of levels to traverse upstream
 * @param downstreamLevels Number of levels to traverse downstream
 * @param processedContext The processed context containing all component data
 * @returns Array of component GUIDs that should be included in the context
 */
export function computeContextFromSelection(
  selectedGuids: string[],
  upstreamLevels: number,
  downstreamLevels: number,
  processedContext: ProcessedContext
): string[] {
  const contextGuids = new Set<string>()
  const visited = new Set<string>()
  
  // For each selected component, get upstream and downstream components
  for (const guid of selectedGuids) {
    // Get upstream components
    const upstream = getUpstreamComponents(guid, upstreamLevels, processedContext, new Set(visited))
    upstream.forEach(g => contextGuids.add(g))
    
    // Get downstream components
    const downstream = getDownstreamComponents(guid, downstreamLevels, processedContext, new Set(visited))
    downstream.forEach(g => contextGuids.add(g))
  }
  if (process.env.NODE_ENV !== 'production') {
    try { console.debug('[Traversal] selected=%o up=%d down=%d → total=%d', selectedGuids, upstreamLevels, downstreamLevels, contextGuids.size) } catch {}
  }
  
  return Array.from(contextGuids)
}

/**
 * Estimate the token count for a given set of components at a specific detail level
 * @param componentGuids Array of component GUIDs to estimate
 * @param detailLevel The level of detail (simple, standard, detailed)
 * @param processedContext The processed context containing component data
 * @returns Estimated token count
 */
export function estimateTokenCount(
  componentGuids: string[],
  detailLevel: 'simple' | 'standard' | 'detailed',
  processedContext: ProcessedContext
): number {
  let totalTokens = 0
  
  for (const guid of componentGuids) {
    const component = processedContext.componentMap[guid]
    if (!component) continue
    
    // Base token count for component metadata
    let componentTokens = 20 // GUID, name, basic info
    
    // Add tokens for description
    if (component.description) {
      componentTokens += Math.ceil(component.description.length / 4)
    }
    
    // Add tokens based on detail level
    switch (detailLevel) {
      case 'simple':
        // Just basic connections
        componentTokens += (component.inputs?.length || 0) * 5
        componentTokens += (component.outputs?.length || 0) * 5
        break
        
      case 'standard':
        // Include port details, errors, warnings
        componentTokens += (component.inputs?.length || 0) * 15
        componentTokens += (component.outputs?.length || 0) * 15
        componentTokens += (component.runtime?.errors?.length || 0) * 10
        componentTokens += (component.runtime?.warnings?.length || 0) * 10
        break
        
      case 'detailed':
        // Include everything including script content
        componentTokens += (component.inputs?.length || 0) * 20
        componentTokens += (component.outputs?.length || 0) * 20
        componentTokens += (component.runtime?.errors?.length || 0) * 20
        componentTokens += (component.runtime?.warnings?.length || 0) * 15
        
        // If it's a script component, add tokens for the code
        if (component.isScript) {
          // Rough estimate: 1 token per 4 characters in code
          // This would need to be fetched from server in detailed mode
          componentTokens += 200 // Placeholder for script content
        }
        break
    }
    
    totalTokens += componentTokens
  }
  
  return Math.floor(totalTokens)
}

/**
 * Filter components based on selection and traversal settings
 * @param allComponents All components in the context
 * @param selectedGuids Selected component GUIDs
 * @param upstreamLevels Upstream traversal levels
 * @param downstreamLevels Downstream traversal levels
 * @param processedContext Processed context data
 * @returns Filtered array of components
 */
export function filterComponentsBySelection(
  allComponents: ContextComponent[],
  selectedGuids: string[],
  upstreamLevels: number,
  downstreamLevels: number,
  processedContext: ProcessedContext
): ContextComponent[] {
  // If no selection, return all components
  if (selectedGuids.length === 0) {
    return allComponents
  }
  
  // Compute which components should be included based on selection and traversal
  const contextGuids = computeContextFromSelection(
    selectedGuids,
    upstreamLevels,
    downstreamLevels,
    processedContext
  )
  
  // Create a Set for faster lookup
  const contextGuidSet = new Set(contextGuids)
  
  // Filter components
  return allComponents.filter(comp => contextGuidSet.has(comp.instanceGuid))
}