import { generateMarkdownTemplateNew } from './context-markdown-new'
import { generateJSONTemplateNew } from './context-json-new'

export interface ContextComponent {
  instanceGuid: string
  name: string
  nickName: string
  description: string
  category: string | null
  subCategory: string | null
  kind: string
  isScript: boolean
  scriptContent?: string | null
  scriptLanguage?: string | null
  locked: boolean
  hidden: boolean
  runtime: {
    errors: string[]
    warnings: string[]
    remarks: string[]
  }
  inputs: ContextParam[]  // Now nested within component
  outputs: ContextParam[] // Now nested within component
  bounds?: any
  pivot?: any
  computationTime?: number
  stage?: number
}

export interface ContextParam {
  instanceGuid: string
  componentGuid: string | null
  name: string
  nickName: string
  kind: string
  dataType?: string
  access?: string
  optional?: boolean
  bounds?: any
  // Panel-specific fields (for standalone params like GH Panel)
  isPanel?: boolean
  panelContent?: string
  multiline?: boolean
  wrap?: boolean
}

export interface ContextConnection {
  from: string
  to: string
  type: string
}

export interface ProcessedContext {
  components: ContextComponent[]
  params: ContextParam[]
  connections: ContextConnection[]
  stages: string[][]
  // New: full DAG including standalone params
  stagesWithParams: string[][]
  componentMap: Record<string, ContextComponent>
  paramMap: Record<string, ContextParam>
  adjacencyList: Record<string, string[]>
  // New: node type map for unified DAG traversal
  nodeTypeMap: Record<string, 'component' | 'param'>
}

export function processContextData(contextData: any): ProcessedContext | null {
  if (!contextData) return null
  
  const components = contextData.components || []
  const params = contextData.params || []
  const connections = contextData.connections || []
  
  // Build adjacency lists for DAG computation
  const componentMap: Record<string, ContextComponent> = {}
  const adjacencyList: Record<string, string[]> = {}
  const inDegree: Record<string, number> = {}
  const paramMap: Record<string, ContextParam> = {}
  const nodeTypeMap: Record<string, 'component' | 'param'> = {}
  const nodeAdjacency: Record<string, string[]> = {}
  const nodeInDegree: Record<string, number> = {}
  
  // Initialize component map and adjacency structures
  components.forEach((comp: ContextComponent) => {
    componentMap[comp.instanceGuid] = comp
    adjacencyList[comp.instanceGuid] = []
    inDegree[comp.instanceGuid] = 0
    nodeTypeMap[comp.instanceGuid] = 'component'
    nodeAdjacency[comp.instanceGuid] = []
    nodeInDegree[comp.instanceGuid] = 0
  })
  
  // Build param to component mapping
  const paramToComponent: Record<string, string> = {}
  params.forEach((param: ContextParam) => {
    paramMap[param.instanceGuid] = param
    if (param.componentGuid) {
      paramToComponent[param.instanceGuid] = param.componentGuid
    } else {
      // Standalone params are DAG nodes
      if (!nodeTypeMap[param.instanceGuid]) {
        nodeTypeMap[param.instanceGuid] = 'param'
        nodeAdjacency[param.instanceGuid] = []
        nodeInDegree[param.instanceGuid] = 0
      }
    }
  })
  
  // Process connections to build component-level edges
  connections.forEach((conn: ContextConnection) => {
    const fromComponent = paramToComponent[conn.from] || conn.from
    const toComponent = paramToComponent[conn.to] || conn.to
    
    if (fromComponent && toComponent && 
        fromComponent !== toComponent &&
        componentMap[fromComponent] && 
        componentMap[toComponent]) {
      
      if (!adjacencyList[fromComponent].includes(toComponent)) {
        adjacencyList[fromComponent].push(toComponent)
        inDegree[toComponent]++
      }
    }
    // Unified node-level edges (components + standalone params)
    const fromNode = paramToComponent[conn.from] || conn.from
    const toNode = paramToComponent[conn.to] || conn.to
    if (fromNode && toNode && fromNode !== toNode) {
      // Ensure nodes exist in generic structures
      if (!nodeAdjacency[fromNode]) {
        nodeAdjacency[fromNode] = []
        nodeInDegree[fromNode] = nodeInDegree[fromNode] ?? 0
        nodeTypeMap[fromNode] = nodeTypeMap[fromNode] || (componentMap[fromNode] ? 'component' : 'param')
      }
      if (!nodeAdjacency[toNode]) {
        nodeAdjacency[toNode] = []
        nodeInDegree[toNode] = nodeInDegree[toNode] ?? 0
        nodeTypeMap[toNode] = nodeTypeMap[toNode] || (componentMap[toNode] ? 'component' : 'param')
      }
      if (!nodeAdjacency[fromNode].includes(toNode)) {
        nodeAdjacency[fromNode].push(toNode)
        nodeInDegree[toNode] = (nodeInDegree[toNode] || 0) + 1
      }
    }
  })
  
  // Compute DAG stages using Kahn's algorithm
  const stages = computeDAGStages(componentMap, adjacencyList, inDegree)
  // Compute full DAG stages including standalone params
  const stagesWithParams = computeDAGStagesGeneric(nodeAdjacency, nodeInDegree)
  
  return {
    components,
    params,
    connections,
    stages,
    stagesWithParams,
    componentMap,
    paramMap,
    adjacencyList,
    nodeTypeMap
  }
}

export function computeDAGStages(
  componentMap: Record<string, ContextComponent>,
  adjacencyList: Record<string, string[]>,
  inDegree: Record<string, number>
): string[][] {
  const stages: string[][] = []
  const stageMap: Record<string, number> = {}
  const queue: string[] = []
  
  // Find all nodes with no incoming edges (stage 0)
  Object.keys(inDegree).forEach(id => {
    if (inDegree[id] === 0) {
      queue.push(id)
      stageMap[id] = 0
    }
  })
  
  // Process queue
  const tempInDegree = {...inDegree}
  while (queue.length > 0) {
    const current = queue.shift()!
    const currentStage = stageMap[current] || 0
    
    // Initialize stage array if needed
    if (!stages[currentStage]) {
      stages[currentStage] = []
    }
    if (stages[currentStage] && Array.isArray(stages[currentStage])) {
      stages[currentStage].push(current)
    }
    
    // Process neighbors
    const neighbors = adjacencyList[current] || []
    for (const neighbor of neighbors) {
      tempInDegree[neighbor] = (tempInDegree[neighbor] || 1) - 1
      
      // Update stage to be one more than current
      if (!stageMap.hasOwnProperty(neighbor) || stageMap[neighbor] <= currentStage) {
        stageMap[neighbor] = currentStage + 1
        
        // Ensure the stage array exists
        if (!stages[currentStage + 1]) {
          stages[currentStage + 1] = []
        }
      }
      
      if (tempInDegree[neighbor] === 0) {
        queue.push(neighbor)
      }
    }
  }
  
  // Add stage info to components
  Object.keys(componentMap).forEach(id => {
    componentMap[id].stage = stageMap[id] || 0
  })
  
  // Filter out any undefined or non-array stages
  return stages.filter(s => s && Array.isArray(s) && s.length > 0)
}

// Generic DAG stage computation that works for any node ids
export function computeDAGStagesGeneric(
  adjacency: Record<string, string[]>,
  indeg: Record<string, number>
): string[][] {
  const stages: string[][] = []
  const stageMap: Record<string, number> = {}
  const queue: string[] = []
  const tempIn: Record<string, number> = { ...indeg }
  
  // Initialize queue with all nodes with no incoming edges
  Object.keys(adjacency).forEach(id => {
    if ((tempIn[id] || 0) === 0) {
      queue.push(id)
      stageMap[id] = 0
    }
  })
  
  while (queue.length > 0) {
    const current = queue.shift() as string
    const currentStage = stageMap[current] || 0
    if (!stages[currentStage]) stages[currentStage] = []
    stages[currentStage].push(current)
    
    const neighbors = adjacency[current] || []
    for (const neighbor of neighbors) {
      tempIn[neighbor] = (tempIn[neighbor] || 1) - 1
      if (!stageMap.hasOwnProperty(neighbor) || stageMap[neighbor] <= currentStage) {
        stageMap[neighbor] = currentStage + 1
        if (!stages[currentStage + 1]) stages[currentStage + 1] = []
      }
      if (tempIn[neighbor] === 0) {
        queue.push(neighbor)
      }
    }
  }
  return stages.filter(s => s && s.length > 0)
}

// Create a filtered copy of ProcessedContext limited to the provided component GUIDs.
// Includes:
// - All params belonging to the kept components
// - Standalone params that connect to or from any kept component
// - Only connections where both endpoints are within the kept params set
export function sliceProcessedContextByComponents(
  processedContext: ProcessedContext,
  keptComponentGuids: string[]
): ProcessedContext {
  const kept = new Set(keptComponentGuids)
  const components = processedContext.components.filter(c => kept.has(c.instanceGuid))

  // Collect params belonging to kept components
  const keptParamGuids = new Set<string>()
  components.forEach(c => {
    c.inputs?.forEach(i => keptParamGuids.add(i.instanceGuid))
    c.outputs?.forEach(o => keptParamGuids.add(o.instanceGuid))
  })

  // Identify standalone params that connect to kept components
  const standaloneParams = processedContext.params.filter(p => !p.componentGuid)
  const usedStandalone = new Set<string>()
  for (const conn of processedContext.connections) {
    const fromParam = processedContext.params.find(p => p.instanceGuid === conn.from)
    const toParam = processedContext.params.find(p => p.instanceGuid === conn.to)
    const fromComp = fromParam && fromParam.componentGuid ? fromParam.componentGuid : null
    const toComp = toParam && toParam.componentGuid ? toParam.componentGuid : null
    if (fromParam && !fromComp && toComp && kept.has(toComp)) usedStandalone.add(fromParam.instanceGuid)
    if (toParam && !toComp && fromComp && kept.has(fromComp)) usedStandalone.add(toParam.instanceGuid)
  }

  // Build params list
  const params = processedContext.params.filter(p => keptParamGuids.has(p.instanceGuid) || usedStandalone.has(p.instanceGuid))

  // Build connections list with endpoints in kept param set
  const paramSet = new Set(params.map(p => p.instanceGuid))
  const connections = processedContext.connections.filter(c => paramSet.has(c.from) && paramSet.has(c.to))

  // Recompute maps/stages using existing processor
  const minimal = { components, params, connections }
  const recomputed = processContextData(minimal as any)
  return recomputed || {
    components: [],
    params: [],
    connections: [],
    stages: [],
    stagesWithParams: [],
    componentMap: {},
    paramMap: {},
    adjacencyList: {},
    nodeTypeMap: {}
  }
}


// Helper function to get component display name
export function getComponentDisplayName(component: ContextComponent): string {
  const name = component.name || ''
  const nickName = component.nickName || ''
  
  if (nickName && nickName !== name) {
    return `${name} (${nickName})`
  }
  return name || nickName || 'Unnamed'
}

// Helper to condense data types
function condenseDataTypes(types: string[]): string {
  const counts = new Map<string, number>()
  for (const type of types) {
    counts.set(type, (counts.get(type) || 0) + 1)
  }
  
  const parts: string[] = []
  counts.forEach((count, type) => {
    if (count > 1) {
      parts.push(`${count}x ${type}`)
    } else {
      parts.push(type)
    }
  })
  
  return parts.join(', ')
}

// Helper to build detailed connection map
interface ConnectionDetail {
  sourceParam: { name: string; guid: string }
  targetParam: { name: string; guid: string }
}

interface DetailedConnections {
  // Map from source component GUID to target component GUID to connection details
  byComponent: Map<string, Map<string, ConnectionDetail[]>>
  // Map from component GUID to its input connections
  inputs: Map<string, Array<{ fromComponent: string; fromParam: string; toParam: string }>>
  // Map from component GUID to its output connections  
  outputs: Map<string, Array<{ toComponent: string; fromParam: string; toParam: string }>>
}

export function buildDetailedConnectionMap(processedContext: ProcessedContext): DetailedConnections {
  const byComponent = new Map<string, Map<string, ConnectionDetail[]>>()
  const inputs = new Map<string, Array<{ fromComponent: string; fromParam: string; toParam: string }>>()
  const outputs = new Map<string, Array<{ toComponent: string; fromParam: string; toParam: string }>>()
  
  // Process each connection
  for (const conn of processedContext.connections) {
    // Find source parameter and its parent component
    let sourceCompGuid: string | null = null
    let sourceParamName = ''
    let sourceParamGuid = conn.from
    
    const sourceParam = processedContext.params.find(p => p.instanceGuid === conn.from)
    if (sourceParam) {
      sourceParamName = sourceParam.nickName || sourceParam.name
      if (sourceParam.componentGuid) {
        sourceCompGuid = sourceParam.componentGuid
      } else {
        // Standalone parameter (like a slider)
        sourceCompGuid = conn.from
        const standaloneParam = processedContext.params.find(p => p.instanceGuid === conn.from && !p.componentGuid)
        if (standaloneParam) {
          sourceParamName = standaloneParam.nickName || standaloneParam.name || 'value'
        }
      }
    }
    
    // Find target parameter and its parent component
    let targetCompGuid: string | null = null
    let targetParamName = ''
    let targetParamGuid = conn.to
    
    const targetParam = processedContext.params.find(p => p.instanceGuid === conn.to)
    if (targetParam) {
      targetParamName = targetParam.nickName || targetParam.name
      if (targetParam.componentGuid) {
        targetCompGuid = targetParam.componentGuid
      } else {
        // Standalone parameter
        targetCompGuid = conn.to
        const standaloneParam = processedContext.params.find(p => p.instanceGuid === conn.to && !p.componentGuid)
        if (standaloneParam) {
          targetParamName = standaloneParam.nickName || standaloneParam.name || 'input'
        }
      }
    }
    
    // Skip if we couldn't resolve both ends
    if (!sourceCompGuid || !targetCompGuid || sourceCompGuid === targetCompGuid) continue
    
    // Add to byComponent map
    if (!byComponent.has(sourceCompGuid)) {
      byComponent.set(sourceCompGuid, new Map())
    }
    const targetMap = byComponent.get(sourceCompGuid)!
    if (!targetMap.has(targetCompGuid)) {
      targetMap.set(targetCompGuid, [])
    }
    targetMap.get(targetCompGuid)!.push({
      sourceParam: { name: sourceParamName, guid: sourceParamGuid },
      targetParam: { name: targetParamName, guid: targetParamGuid }
    })
    
    // Add to inputs map (from target component's perspective)
    if (!inputs.has(targetCompGuid)) {
      inputs.set(targetCompGuid, [])
    }
    inputs.get(targetCompGuid)!.push({
      fromComponent: sourceCompGuid,
      fromParam: sourceParamName,
      toParam: targetParamName
    })
    
    // Add to outputs map (from source component's perspective)
    if (!outputs.has(sourceCompGuid)) {
      outputs.set(sourceCompGuid, [])
    }
    outputs.get(sourceCompGuid)!.push({
      toComponent: targetCompGuid,
      fromParam: sourceParamName,
      toParam: targetParamName
    })
  }
  
  return { byComponent, inputs, outputs }
}

export function generateMarkdownTemplate(
  processedContext: ProcessedContext, 
  detailLevel: 'simple' | 'standard' | 'detailed' = 'standard'
): string {
  // Delegate to the new implementation
  return generateMarkdownTemplateNew(processedContext, detailLevel)
}

// The old implementation has been replaced - see generateMarkdownTemplateNew

export function generateJSONTemplate(
  processedContext: ProcessedContext,
  detailLevel: 'simple' | 'standard' | 'detailed' = 'standard'
): string {
  // Delegate to the new implementation
  return generateJSONTemplateNew(processedContext, detailLevel)
}

// The old JSON implementation has been replaced

export function generateXMLTemplate(
  processedContext: ProcessedContext,
  detailLevel: 'simple' | 'standard' | 'detailed' = 'standard'
): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<grasshopper-context>\n'
  xml += `  <summary components="${processedContext.components.length}" `
  xml += `params="${processedContext.params.length}" `
  xml += `connections="${processedContext.connections.length}" `
  xml += `stages="${processedContext.stages.length}" `
  xml += `detailLevel="${detailLevel}"/>\n`
  
  if (detailLevel === 'simple') {
    // Simple XML - just component list
    xml += '  <components>\n'
    processedContext.components.forEach(comp => {
      xml += `    <component guid="${comp.instanceGuid}" `
      xml += `name="${getComponentDisplayName(comp)}" `
      xml += `type="${comp.category || 'unknown'}"/>\n`
    })
    xml += '  </components>\n'
  } else if (detailLevel === 'standard') {
    // Standard XML - organized by stages with moderate detail
    xml += '  <stages>\n'
    processedContext.stages.forEach((stageComponents, index) => {
      xml += `    <stage number="${index}">\n`
      stageComponents.forEach(id => {
        const comp = processedContext.componentMap[id]
        if (comp) {
          xml += `      <component guid="${comp.instanceGuid}" `
          xml += `name="${getComponentDisplayName(comp)}" `
          xml += `type="${comp.category || 'unknown'}" `
          xml += `isScript="${comp.isScript}">\n`
          
          if (comp.runtime?.errors?.length) {
            xml += `        <errors count="${comp.runtime.errors.length}"/>\n`
          }
          if (comp.runtime?.warnings?.length) {
            xml += `        <warnings count="${comp.runtime.warnings.length}"/>\n`
          }
          if (comp.inputs?.length) {
            xml += `        <inputs count="${comp.inputs.length}"/>\n`
          }
          if (comp.outputs?.length) {
            xml += `        <outputs count="${comp.outputs.length}"/>\n`
          }
          
          xml += '      </component>\n'
        }
      })
      xml += '    </stage>\n'
    })
    xml += '  </stages>\n'
  } else {
    // Detailed XML - everything
    xml += '  <components>\n'
    processedContext.components.forEach(comp => {
      xml += `    <component guid="${comp.instanceGuid}">\n`
      xml += `      <name>${comp.name || ''}</name>\n`
      xml += `      <nickName>${comp.nickName || ''}</nickName>\n`
      xml += `      <description>${comp.description || ''}</description>\n`
      xml += `      <category>${comp.category || ''}</category>\n`
      xml += `      <subCategory>${comp.subCategory || ''}</subCategory>\n`
      xml += `      <isScript>${comp.isScript}</isScript>\n`
      xml += `      <stage>${comp.stage || 0}</stage>\n`
      
      if (comp.runtime) {
        xml += '      <runtime>\n'
        if (comp.runtime.errors?.length) {
          xml += '        <errors>\n'
          comp.runtime.errors.forEach(err => {
            xml += `          <error>${err}</error>\n`
          })
          xml += '        </errors>\n'
        }
        if (comp.runtime.warnings?.length) {
          xml += '        <warnings>\n'
          comp.runtime.warnings.forEach(warn => {
            xml += `          <warning>${warn}</warning>\n`
          })
          xml += '        </warnings>\n'
        }
        xml += '      </runtime>\n'
      }
      
      if (comp.inputs?.length) {
        xml += '      <inputs>\n'
        comp.inputs.forEach(input => {
          xml += `        <input guid="${input.instanceGuid}" `
          xml += `name="${input.name || ''}" `
          xml += `type="${input.dataType || ''}"/>\n`
        })
        xml += '      </inputs>\n'
      }
      
      if (comp.outputs?.length) {
        xml += '      <outputs>\n'
        comp.outputs.forEach(output => {
          xml += `        <output guid="${output.instanceGuid}" `
          xml += `name="${output.name || ''}" `
          xml += `type="${output.dataType || ''}"/>\n`
        })
        xml += '      </outputs>\n'
      }
      // Omit bounds/position per request
      xml += '    </component>\n'
    })
    xml += '  </components>\n'
  }
  
  xml += '</grasshopper-context>'
  
  return xml
}