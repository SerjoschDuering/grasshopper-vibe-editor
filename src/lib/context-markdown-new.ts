import { ProcessedContext, ContextComponent, ContextParam, getComponentDisplayName, buildDetailedConnectionMap } from './context-utils'

// Helper to get unique component connections for simple view
function getUniqueComponentConnections(
  connections: Array<{ toComponent: string; fromParam: string; toParam: string }> | undefined,
  componentMap: Record<string, ContextComponent>,
  standaloneParams: ContextParam[]
): Array<{ name: string; guid: string }> {
  if (!connections || connections.length === 0) return []
  
  const uniqueComponents = new Map<string, string>()
  connections.forEach(conn => {
    if (!uniqueComponents.has(conn.toComponent)) {
      const targetComp = componentMap[conn.toComponent]
      const targetParam = standaloneParams.find(p => p.instanceGuid === conn.toComponent)
      const name = targetComp ? getComponentDisplayName(targetComp) :
                   targetParam ? (targetParam.nickName || targetParam.name) : 'Unknown'
      uniqueComponents.set(conn.toComponent, name)
    }
  })
  
  return Array.from(uniqueComponents.entries()).map(([guid, name]) => ({ name, guid }))
}

export function generateMarkdownTemplateNew(
  processedContext: ProcessedContext, 
  detailLevel: 'simple' | 'standard' | 'detailed' = 'standard'
): string {
  let md = '# Grasshopper Context\n\n'
  
  // Summary section
  md += `## Summary\n`
  md += `- Components: ${processedContext.components.length}\n`
  md += `- Parameters: ${processedContext.params.length}\n`
  md += `- Connections: ${processedContext.connections.length}\n`
  md += `- Computation Stages: ${processedContext.stages.length}\n`
  md += `- Detail Level: ${detailLevel}\n\n`
  
  const connections = buildDetailedConnectionMap(processedContext)
  const standaloneParams = processedContext.params.filter(p => !p.componentGuid)
  
  md += '## Computation Graph (DAG Order)\n\n'
  
  const processed = new Set<string>()
  
  // Use unified DAG that includes standalone params
  const stages = processedContext.stagesWithParams && processedContext.stagesWithParams.length > 0
    ? processedContext.stagesWithParams
    : processedContext.stages
  
  // Process nodes in DAG stage order (components + params)
  stages.forEach((stageComponents, stageIndex) => {
    if (stageComponents.length > 0) {
      md += `### Stage ${stageIndex}\n\n`
    }
    
    stageComponents.forEach(compId => {
      const isParamNode = processedContext.nodeTypeMap && processedContext.nodeTypeMap[compId] === 'param'
      if (isParamNode && !processed.has(compId)) {
        const param = standaloneParams.find(p => p.instanceGuid === compId) || processedContext.params.find(p => p.instanceGuid === compId)
        if (!param) return
        const paramName = param.nickName || param.name || 'Parameter'
        const inputs = connections.inputs.get(param.instanceGuid)
        const outputs = connections.outputs.get(param.instanceGuid)
        
        if (detailLevel === 'simple') {
          md += `#### ${paramName}\n`
          md += `- **instanceGuid**: ${param.instanceGuid}\n`
          md += `- **Name**: ${paramName}\n`
          md += `- **Description**: Standalone Parameter\n`
          
          // InputFrom - unique sources
          const uniqueSources = new Map<string, string>()
          inputs?.forEach(conn => {
            if (!uniqueSources.has(conn.fromComponent)) {
              const sourceComp = processedContext.componentMap[conn.fromComponent]
              const sourceParam = standaloneParams.find(p => p.instanceGuid === conn.fromComponent)
              const name = sourceComp ? getComponentDisplayName(sourceComp) :
                           sourceParam ? (sourceParam.nickName || sourceParam.name) : 'Unknown'
              uniqueSources.set(conn.fromComponent, name)
            }
          })
          if (uniqueSources.size > 0) {
            md += `- **InputFrom**:\n`
            uniqueSources.forEach((name, guid) => {
              md += `  - ${name} [${guid}]\n`
            })
          }
          
          // OutputTo - unique targets
          const uniqueTargets = new Map<string, string>()
          outputs?.forEach(conn => {
            if (!uniqueTargets.has(conn.toComponent)) {
              const targetComp = processedContext.componentMap[conn.toComponent]
              const targetParam = standaloneParams.find(p => p.instanceGuid === conn.toComponent)
              const name = targetComp ? getComponentDisplayName(targetComp) :
                           targetParam ? (targetParam.nickName || targetParam.name) : 'Unknown'
              uniqueTargets.set(conn.toComponent, name)
            }
          })
          if (uniqueTargets.size > 0) {
            md += `- **OutputTo**:\n`
            uniqueTargets.forEach((name, guid) => {
              md += `  - ${name} [${guid}]\n`
            })
          }
        } else if (detailLevel === 'standard') {
          md += `#### ${paramName}\n`
          md += `- **instanceGuid**: ${param.instanceGuid}\n`
          md += `- **Name**: ${paramName}\n`
          md += `- **Type**: ${param.dataType || 'Parameter'}\n`
          md += `- **Description**: Standalone Parameter\n`
          if ((param as any).isPanel && (param as any).panelContent) {
            const snippet = String((param as any).panelContent).substring(0, 400)
            md += `- **panelContent**: ${snippet}\n`
          }
          
          // Inputs
          if (inputs && inputs.length > 0) {
            md += `- **Inputs**:\n`
            const first = inputs[0]
            const sourceComp = processedContext.componentMap[first.fromComponent]
            const sourceParam = standaloneParams.find(p => p.instanceGuid === first.fromComponent)
            const sourceName = sourceComp ? getComponentDisplayName(sourceComp) :
                              sourceParam ? (sourceParam.nickName || sourceParam.name) : 'Unknown'
            md += `  - value (${param.dataType || 'Any'}) ← ${sourceName} [${first.fromComponent}]\n`
          }
          
          // Outputs
          if (outputs && outputs.length > 0) {
            md += `- **Outputs**:\n`
            const grouped = new Map<string, Set<string>>()
            outputs.forEach(conn => {
              if (!grouped.has(conn.toComponent)) {
                grouped.set(conn.toComponent, new Set())
              }
              grouped.get(conn.toComponent)!.add(conn.toParam)
            })
            grouped.forEach((_, targetId) => {
              const targetComp = processedContext.componentMap[targetId]
              const targetParam = standaloneParams.find(p => p.instanceGuid === targetId)
              const targetName = targetComp ? getComponentDisplayName(targetComp) :
                                targetParam ? (targetParam.nickName || targetParam.name) : 'Unknown'
              md += `  - value (${param.dataType || 'Any'}) → ${targetName} [${targetId}]\n`
            })
          }
        } else {
          md += `#### ${paramName}\n`
          md += `- **instanceGuid**: ${param.instanceGuid}\n`
          md += `- **Name**: ${paramName}\n`
          md += `- **Type**: ${param.dataType || 'Parameter'}\n`
          md += `- **Kind**: ${param.kind}\n`
          md += `- **Description**: Standalone Parameter\n`
          
          // Inputs detailed
          const sourceGuids: string[] = []
          inputs?.forEach(conn => {
            const fromStandalone = standaloneParams.some(p => p.instanceGuid === conn.fromComponent)
            if (fromStandalone) {
              sourceGuids.push(conn.fromComponent)
            } else {
              const srcComp = processedContext.componentMap[conn.fromComponent]
              const srcOut = srcComp?.outputs?.find(o => (o.nickName || o.name) === conn.fromParam)
              if (srcOut) sourceGuids.push(srcOut.instanceGuid)
            }
          })
          if (sourceGuids.length > 0) {
            md += `- **Inputs**:\n`
            md += `  - value\n`
            md += `    - GUID: ${param.instanceGuid}\n`
            md += `    - Type: ${param.dataType || 'Any'}\n`
            md += `    - Connected from: ${sourceGuids.join(', ')}\n`
          }
          
          // Outputs detailed
          const targetGuids: string[] = []
          outputs?.forEach(conn => {
            const targetIsStandalone = standaloneParams.some(p => p.instanceGuid === conn.toComponent)
            if (targetIsStandalone) {
              targetGuids.push(conn.toComponent)
            } else {
              const targetComp = processedContext.componentMap[conn.toComponent]
              const targetInput = targetComp?.inputs?.find(i => (i.nickName || i.name) === conn.toParam)
              if (targetInput) targetGuids.push(targetInput.instanceGuid)
            }
          })
          if (targetGuids.length > 0) {
            md += `- **Outputs**:\n`
            md += `  - value\n`
            md += `    - GUID: ${param.instanceGuid}\n`
            md += `    - Type: ${param.dataType || 'Any'}\n`
            md += `    - Connected to: ${targetGuids.join(', ')}\n`
          }
          // Panel content (if applicable)
          if ((param as any).isPanel && (param as any).panelContent) {
            const full = String((param as any).panelContent).substring(0, 5000)
            md += `- **panelContent**: ${full}\n`
          }
          // Omit position/bounds per request
        }
        md += '\n'
        processed.add(compId)
        return
      }
      const comp = processedContext.componentMap[compId]
      if (comp && !processed.has(compId)) {
        const displayName = getComponentDisplayName(comp)
        
        if (detailLevel === 'simple') {
          // SIMPLE VIEW - Component
          md += `#### ${displayName}\n`
          md += `- **instanceGuid**: ${comp.instanceGuid}\n`
          md += `- **Name**: ${displayName}\n`
          if (comp.description) md += `- **Description**: ${comp.description}\n`
          
          // Inputs - just names, no types
          const inputNames = comp.inputs?.map(i => i.nickName || i.name).filter(Boolean) || []
          if (inputNames.length > 0) {
            md += `- **Inputs**: ${inputNames.join(', ')}\n`
          }
          
          // Outputs - just names, no types
          const outputNames = comp.outputs?.map(o => o.nickName || o.name).filter(Boolean) || []
          if (outputNames.length > 0) {
            md += `- **Outputs**: ${outputNames.join(', ')}\n`
          }
          
          // InputFrom - unique components only
          const inputs = connections.inputs.get(comp.instanceGuid)
          if (inputs && inputs.length > 0) {
            const uniqueSources = new Map<string, string>()
            inputs.forEach(conn => {
              if (!uniqueSources.has(conn.fromComponent)) {
                const sourceComp = processedContext.componentMap[conn.fromComponent]
                const sourceParam = standaloneParams.find(p => p.instanceGuid === conn.fromComponent)
                const name = sourceComp ? getComponentDisplayName(sourceComp) :
                             sourceParam ? (sourceParam.nickName || sourceParam.name) : 'Unknown'
                uniqueSources.set(conn.fromComponent, name)
              }
            })
            
            if (uniqueSources.size > 0) {
              md += `- **InputFrom**:\n`
              uniqueSources.forEach((name, guid) => {
                md += `  - ${name} [${guid}]\n`
              })
            }
          }
          
          // OutputTo - unique components only
          const outputs = connections.outputs.get(comp.instanceGuid)
          if (outputs && outputs.length > 0) {
            const uniqueTargets = new Map<string, string>()
            outputs.forEach(conn => {
              if (!uniqueTargets.has(conn.toComponent)) {
                const targetComp = processedContext.componentMap[conn.toComponent]
                const targetParam = standaloneParams.find(p => p.instanceGuid === conn.toComponent)
                const name = targetComp ? getComponentDisplayName(targetComp) :
                             targetParam ? (targetParam.nickName || targetParam.name) : 'Unknown'
                uniqueTargets.set(conn.toComponent, name)
              }
            })
            
            if (uniqueTargets.size > 0) {
              md += `- **OutputTo**:\n`
              uniqueTargets.forEach((name, guid) => {
                md += `  - ${name} [${guid}]\n`
              })
            }
          }
          
        } else if (detailLevel === 'standard') {
          // STANDARD VIEW - Component
          md += `#### ${displayName}\n`
          md += `- **instanceGuid**: ${comp.instanceGuid}\n`
          md += `- **Name**: ${displayName}\n`
          md += `- **Type**: ${comp.category}${comp.subCategory ? `/${comp.subCategory}` : ''}\n`
          if (comp.description) md += `- **Description**: ${comp.description}\n`
          if (comp.computationTime !== undefined) {
            md += `- **ComputationTime**: ${comp.computationTime}ms\n`
          }
          
          // Inputs with type and source component
          const inputs = connections.inputs.get(comp.instanceGuid)
          if (comp.inputs && comp.inputs.length > 0) {
            md += `- **Inputs**:\n`
            comp.inputs.forEach(input => {
              const inputName = input.nickName || input.name
              const inputType = input.dataType || 'Any'
              
              // Find connection for this input
              const inputConn = inputs?.find(c => c.toParam === inputName)
              if (inputConn) {
                const sourceComp = processedContext.componentMap[inputConn.fromComponent]
                const sourceParam = standaloneParams.find(p => p.instanceGuid === inputConn.fromComponent)
                const sourceName = sourceComp ? getComponentDisplayName(sourceComp) :
                                  sourceParam ? (sourceParam.nickName || sourceParam.name) : 'Unknown'
                md += `  - ${inputName} (${inputType}) ← ${sourceName} [${inputConn.fromComponent}]\n`
              } else {
                md += `  - ${inputName} (${inputType})\n`
              }
            })
          }
          
          // Outputs with type and target components
          const outputs = connections.outputs.get(comp.instanceGuid)
          if (comp.outputs && comp.outputs.length > 0) {
            md += `- **Outputs**:\n`
            comp.outputs.forEach(output => {
              const outputName = output.nickName || output.name
              const outputType = output.dataType || 'Any'
              
              // Find connections for this output (deduplicated by target component)
              const outputConns = outputs?.filter(c => c.fromParam === outputName)
              if (outputConns && outputConns.length > 0) {
                const uniqueTargets = new Map<string, string>()
                outputConns.forEach(conn => {
                  if (!uniqueTargets.has(conn.toComponent)) {
                    const targetComp = processedContext.componentMap[conn.toComponent]
                    const targetParam = standaloneParams.find(p => p.instanceGuid === conn.toComponent)
                    const targetName = targetComp ? getComponentDisplayName(targetComp) :
                                      targetParam ? (targetParam.nickName || targetParam.name) : 'Unknown'
                    uniqueTargets.set(conn.toComponent, targetName)
                  }
                })
                
                const targetList = Array.from(uniqueTargets.entries())
                  .map(([guid, name]) => `${name} [${guid}]`)
                  .join(', ')
                md += `  - ${outputName} (${outputType}) → ${targetList}\n`
              } else {
                md += `  - ${outputName} (${outputType})\n`
              }
            })
          }
          
          // Errors and Warnings
          if (comp.runtime?.errors?.length) {
            md += `- **Errors**: ${comp.runtime.errors.join('; ')}\n`
          }
          if (comp.runtime?.warnings?.length) {
            md += `- **Warnings**: ${comp.runtime.warnings.join('; ')}\n`
          }
          
          // Script preview (500 chars)
          if (comp.isScript && comp.scriptContent) {
            const preview = comp.scriptContent.substring(0, 500)
            const lang = comp.scriptLanguage === 'Python' ? 'python' : 
                        comp.scriptLanguage === 'C#' ? 'csharp' : ''
            md += `- **ScriptPreview**:\n`
            md += `\`\`\`${lang}\n`
            md += preview
            if (comp.scriptContent.length > 500) {
              md += `\n... (${comp.scriptContent.length - 500} more characters)`
            }
            md += '\n```\n'
          }
          
        } else {
          // DETAILED VIEW - Component
          md += `#### ${displayName}\n`
          md += `- **instanceGuid**: ${comp.instanceGuid}\n`
          md += `- **Name**: ${displayName}\n`
          md += `- **Type**: ${comp.category}${comp.subCategory ? `/${comp.subCategory}` : ''}\n`
          md += `- **Kind**: ${comp.kind}\n`
          if (comp.description) md += `- **Description**: ${comp.description}\n`
          if (comp.computationTime !== undefined) {
            md += `- **ComputationTime**: ${comp.computationTime}ms\n`
          }
          
          // Remarks
          if (comp.runtime?.remarks?.length) {
            md += `- **Remarks**: ${comp.runtime.remarks.join('; ')}\n`
          }
          
          // Inputs with full details
          const inputs = connections.inputs.get(comp.instanceGuid)
          if (comp.inputs && comp.inputs.length > 0) {
            md += `- **Inputs**:\n`
            comp.inputs.forEach(input => {
              const inputName = input.nickName || input.name
              md += `  - ${inputName}\n`
              md += `    - GUID: ${input.instanceGuid}\n`
              md += `    - Type: ${input.dataType || 'Any'}, Access: ${input.access || 'item'}, Optional: ${input.optional ? 'Yes' : 'No'}\n`
              
              // Find source parameter GUID
              const inputConn = inputs?.find(c => c.toParam === inputName)
              if (inputConn) {
                // For standalone params, fromComponent IS the parameter GUID
                // For component params, find the actual parameter
                const sourceIsStandalone = standaloneParams.some(p => p.instanceGuid === inputConn.fromComponent)
                if (sourceIsStandalone) {
                  md += `    - Connected from: ${inputConn.fromComponent}\n`
                } else {
                  // Find the output parameter of the source component
                  const sourceComp = processedContext.componentMap[inputConn.fromComponent]
                  if (sourceComp) {
                    const sourceOutput = sourceComp.outputs?.find(o => 
                      (o.nickName || o.name) === inputConn.fromParam
                    )
                    if (sourceOutput) {
                      md += `    - Connected from: ${sourceOutput.instanceGuid}\n`
                    }
                  }
                }
              }
            })
          }
          
          // Outputs with full details
          const outputs = connections.outputs.get(comp.instanceGuid)
          if (comp.outputs && comp.outputs.length > 0) {
            md += `- **Outputs**:\n`
            comp.outputs.forEach(output => {
              const outputName = output.nickName || output.name
              md += `  - ${outputName}\n`
              md += `    - GUID: ${output.instanceGuid}\n`
              md += `    - Type: ${output.dataType || 'Any'}\n`
              
              // Find target parameter GUIDs
              const outputConns = outputs?.filter(c => c.fromParam === outputName)
              if (outputConns && outputConns.length > 0) {
                const targetGuids: string[] = []
                outputConns.forEach(conn => {
                  // For standalone params, toComponent IS the parameter GUID
                  // For component params, find the actual parameter
                  const targetIsStandalone = standaloneParams.some(p => p.instanceGuid === conn.toComponent)
                  if (targetIsStandalone) {
                    targetGuids.push(conn.toComponent)
                  } else {
                    const targetComp = processedContext.componentMap[conn.toComponent]
                    if (targetComp) {
                      const targetInput = targetComp.inputs?.find(i => 
                        (i.nickName || i.name) === conn.toParam
                      )
                      if (targetInput) {
                        targetGuids.push(targetInput.instanceGuid)
                      }
                    }
                  }
                })
                
                if (targetGuids.length > 0) {
                  md += `    - Connected to: ${targetGuids.join(', ')}\n`
                }
              }
            })
          }
          
          // Omit position/bounds per request
          
          // Full script content
          if (comp.isScript && comp.scriptContent) {
            const lang = comp.scriptLanguage === 'Python' ? 'python' : 
                        comp.scriptLanguage === 'C#' ? 'csharp' : 
                        comp.scriptLanguage === 'VB' ? 'vb' : ''
            md += `- **Script**:\n`
            md += `\`\`\`${lang}\n`
            md += comp.scriptContent
            md += '\n```\n'
          }
        }
        
        md += '\n'
        processed.add(compId)
      }
    })
  })
  
  return md
}