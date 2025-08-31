import { ProcessedContext, ContextComponent, ContextParam, getComponentDisplayName, buildDetailedConnectionMap } from './context-utils'

export function generateJSONTemplateNew(
  processedContext: ProcessedContext,
  detailLevel: 'simple' | 'standard' | 'detailed' = 'standard'
): string {
  const connections = buildDetailedConnectionMap(processedContext)
  const standaloneParams = processedContext.params.filter(p => !p.componentGuid)
  
  const result: any = {
    summary: {
      components: processedContext.components.length,
      parameters: processedContext.params.length,
      connections: processedContext.connections.length,
      computationStages: processedContext.stages.length,
      detailLevel: detailLevel
    },
    computationGraph: []
  }
  
  const processed = new Set<string>()
  
  // Iterate unified DAG (components + standalone params) in stage order
  const stages = processedContext.stagesWithParams && processedContext.stagesWithParams.length > 0
    ? processedContext.stagesWithParams
    : processedContext.stages
  
  stages.forEach(stageNodes => {
    stageNodes.forEach(nodeId => {
      const isParamNode = processedContext.nodeTypeMap && processedContext.nodeTypeMap[nodeId] === 'param'
      if (isParamNode) {
        const param = processedContext.paramMap ? processedContext.paramMap[nodeId] : standaloneParams.find(p => p.instanceGuid === nodeId)
        if (!param) return
        const paramName = param.nickName || param.name || 'Parameter'
        const inputs = connections.inputs.get(param.instanceGuid)
        const outputs = connections.outputs.get(param.instanceGuid)
        
        if (detailLevel === 'simple') {
          // SIMPLE VIEW - Param node
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
          const inputFrom = Array.from(uniqueSources.entries()).map(([guid, name]) => `${name} [${guid}]`)
          
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
          const outputTo = Array.from(uniqueTargets.entries()).map(([guid, name]) => `${name} [${guid}]`)
          
          result.computationGraph.push({
            instanceGuid: param.instanceGuid,
            Name: paramName,
            Description: 'Standalone Parameter',
            Inputs: inputs && inputs.length > 0 ? 'value' : '',
            Outputs: outputs && outputs.length > 0 ? 'value' : '',
            InputFrom: inputFrom,
            OutputTo: outputTo
          })
        } else if (detailLevel === 'standard') {
          // STANDARD VIEW - Param node with Inputs and Outputs
          const formattedInputs: any[] = []
          if (inputs && inputs.length > 0) {
            // Param nodes typically have a single input name, use 'value'
            const first = inputs[0]
            const fromName = (() => {
              const sourceComp = processedContext.componentMap[first.fromComponent]
              const sourceParam = standaloneParams.find(p => p.instanceGuid === first.fromComponent)
              return sourceComp ? getComponentDisplayName(sourceComp) :
                     sourceParam ? (sourceParam.nickName || sourceParam.name) : 'Unknown'
            })()
            formattedInputs.push({ name: 'value', type: param.dataType || 'Any', connectedFrom: { fromComponent: fromName, fromGuid: first.fromComponent } })
          }
          const outputConnections: any[] = []
          if (outputs && outputs.length > 0) {
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
              if (targetComp || targetParam) {
                outputConnections.push({
                  component: targetComp ? getComponentDisplayName(targetComp) : (targetParam!.nickName || targetParam!.name || 'Parameter'),
                  guid: targetId
                })
              }
            })
          }
          const entry: any = {
            instanceGuid: param.instanceGuid,
            Name: paramName,
            Type: param.dataType || 'Parameter',
            Description: 'Standalone Parameter'
          }
          if (formattedInputs.length > 0) entry.Inputs = formattedInputs
          entry.Outputs = [ { name: 'value', type: param.dataType || 'Any', connectsTo: outputConnections } ]
          if (param.isPanel && param.panelContent) {
            entry.panelContent = (param.panelContent || '').substring(0, 400)
          }
          result.computationGraph.push(entry)
        } else {
          // DETAILED VIEW - Param node
          const sourceGuids: string[] = []
          inputs?.forEach(conn => {
            // For standalone params, fromComponent is either standalone param guid or component guid; map to param guid if component by matching output name
            const fromStandalone = standaloneParams.some(p => p.instanceGuid === conn.fromComponent)
            if (fromStandalone) {
              sourceGuids.push(conn.fromComponent)
            } else {
              const srcComp = processedContext.componentMap[conn.fromComponent]
              const srcOut = srcComp?.outputs?.find(o => (o.nickName || o.name) === conn.fromParam)
              if (srcOut) sourceGuids.push(srcOut.instanceGuid)
            }
          })
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
          const entry: any = {
            instanceGuid: param.instanceGuid,
            Name: paramName,
            Type: param.dataType || 'Parameter',
            Kind: param.kind,
            Description: 'Standalone Parameter',
            Inputs: sourceGuids.length > 0 ? [ { name: 'value', GUID: param.instanceGuid, Type: param.dataType || 'Any', ConnectedFrom: sourceGuids } ] : undefined,
            Outputs: [ { name: 'value', GUID: param.instanceGuid, Type: param.dataType || 'Any', ConnectedTo: targetGuids } ]
          }
          if (param.isPanel && param.panelContent) {
            entry.panelContent = (param.panelContent || '').substring(0, 5000)
          }
          result.computationGraph.push(entry)
        }
        processed.add(nodeId)
        return
      }
      // Component node
      const comp = processedContext.componentMap[nodeId]
      if (comp && !processed.has(nodeId)) {
        const displayName = getComponentDisplayName(comp)
        
        if (detailLevel === 'simple') {
          // SIMPLE VIEW - Component
          const inputs = connections.inputs.get(comp.instanceGuid)
          const outputs = connections.outputs.get(comp.instanceGuid)
          
          // InputFrom - unique components only
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
          
          const inputFrom = Array.from(uniqueSources.entries()).map(([guid, name]) => 
            `${name} [${guid}]`
          )
          
          // OutputTo - unique components only
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
          
          const outputTo = Array.from(uniqueTargets.entries()).map(([guid, name]) => 
            `${name} [${guid}]`
          )
          
          // Input and output names (no types in simple view)
          const inputNames = comp.inputs?.map(i => i.nickName || i.name).filter(Boolean).join(', ') || ''
          const outputNames = comp.outputs?.map(o => o.nickName || o.name).filter(Boolean).join(', ') || ''
          
          result.computationGraph.push({
            instanceGuid: comp.instanceGuid,
            Name: displayName,
            Description: comp.description || '',
            Inputs: inputNames,
            Outputs: outputNames,
            InputFrom: inputFrom,
            OutputTo: outputTo
          })
          
        } else if (detailLevel === 'standard') {
          // STANDARD VIEW - Component
          const inputs = connections.inputs.get(comp.instanceGuid)
          const outputs = connections.outputs.get(comp.instanceGuid)
          
          // Format inputs with type and source
          const formattedInputs: any[] = []
          comp.inputs?.forEach(input => {
            const inputName = input.nickName || input.name
            const inputType = input.dataType || 'Any'
            
            const inputConn = inputs?.find(c => c.toParam === inputName)
            const connectionInfo = inputConn ? {
              fromComponent: (() => {
                const sourceComp = processedContext.componentMap[inputConn.fromComponent]
                const sourceParam = standaloneParams.find(p => p.instanceGuid === inputConn.fromComponent)
                return sourceComp ? getComponentDisplayName(sourceComp) :
                       sourceParam ? (sourceParam.nickName || sourceParam.name) : 'Unknown'
              })(),
              fromGuid: inputConn.fromComponent
            } : null
            
            formattedInputs.push({
              name: inputName,
              type: inputType,
              connectedFrom: connectionInfo
            })
          })
          
          // Format outputs with type and targets
          const formattedOutputs: any[] = []
          comp.outputs?.forEach(output => {
            const outputName = output.nickName || output.name
            const outputType = output.dataType || 'Any'
            
            const outputConns = outputs?.filter(c => c.fromParam === outputName)
            const uniqueTargets = new Map<string, string>()
            
            outputConns?.forEach(conn => {
              if (!uniqueTargets.has(conn.toComponent)) {
                const targetComp = processedContext.componentMap[conn.toComponent]
                const targetParam = standaloneParams.find(p => p.instanceGuid === conn.toComponent)
                const targetName = targetComp ? getComponentDisplayName(targetComp) :
                                  targetParam ? (targetParam.nickName || targetParam.name) : 'Unknown'
                uniqueTargets.set(conn.toComponent, targetName)
              }
            })
            
            const connectsTo = Array.from(uniqueTargets.entries()).map(([guid, name]) => ({
              component: name,
              guid: guid
            }))
            
            formattedOutputs.push({
              name: outputName,
              type: outputType,
              connectsTo: connectsTo
            })
          })
          
          const entry: any = {
            instanceGuid: comp.instanceGuid,
            Name: displayName,
            Type: `${comp.category}${comp.subCategory ? `/${comp.subCategory}` : ''}`,
            Description: comp.description || '',
            ComputationTime: comp.computationTime,
            Inputs: formattedInputs,
            Outputs: formattedOutputs
          }
          
          if (comp.runtime?.errors?.length) {
            entry.Errors = comp.runtime.errors
          }
          if (comp.runtime?.warnings?.length) {
            entry.Warnings = comp.runtime.warnings
          }
          
          if (comp.isScript && comp.scriptContent) {
            entry.ScriptPreview = comp.scriptContent.substring(0, 500) + 
              (comp.scriptContent.length > 500 ? '...' : '')
          }
          
          result.computationGraph.push(entry)
          
        } else {
          // DETAILED VIEW - Component
          const inputs = connections.inputs.get(comp.instanceGuid)
          const outputs = connections.outputs.get(comp.instanceGuid)
          
          // Format inputs with full details
          const formattedInputs: any[] = []
          comp.inputs?.forEach(input => {
            const inputName = input.nickName || input.name
            const inputConn = inputs?.find(c => c.toParam === inputName)
            
            let connectedFrom: string | undefined
            if (inputConn) {
              // Check if source is standalone param
              const sourceIsStandalone = standaloneParams.some(p => p.instanceGuid === inputConn.fromComponent)
              if (sourceIsStandalone) {
                connectedFrom = inputConn.fromComponent
              } else {
                // Find the output parameter of the source component
                const sourceComp = processedContext.componentMap[inputConn.fromComponent]
                if (sourceComp) {
                  const sourceOutput = sourceComp.outputs?.find(o => 
                    (o.nickName || o.name) === inputConn.fromParam
                  )
                  if (sourceOutput) {
                    connectedFrom = sourceOutput.instanceGuid
                  }
                }
              }
            }
            
            formattedInputs.push({
              name: inputName,
              GUID: input.instanceGuid,
              Type: input.dataType || 'Any',
              Access: input.access || 'item',
              Optional: input.optional || false,
              ConnectedFrom: connectedFrom
            })
          })
          
          // Format outputs with full details
          const formattedOutputs: any[] = []
          comp.outputs?.forEach(output => {
            const outputName = output.nickName || output.name
            const outputConns = outputs?.filter(c => c.fromParam === outputName)
            
            const targetGuids: string[] = []
            outputConns?.forEach(conn => {
              // Check if target is standalone param
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
            
            formattedOutputs.push({
              name: outputName,
              GUID: output.instanceGuid,
              Type: output.dataType || 'Any',
              ConnectedTo: targetGuids
            })
          })
          
          const entry: any = {
            instanceGuid: comp.instanceGuid,
            Name: displayName,
            Type: `${comp.category}${comp.subCategory ? `/${comp.subCategory}` : ''}`,
            Kind: comp.kind,
            Description: comp.description || '',
            ComputationTime: comp.computationTime
          }
          
          if (comp.runtime?.remarks?.length) {
            entry.Remarks = comp.runtime.remarks
          }
          
          entry.Inputs = formattedInputs
          entry.Outputs = formattedOutputs
          
          // Omit bounds/position in JSON per request
          
          if (comp.isScript && comp.scriptContent) {
            entry.Script = comp.scriptContent
          }
          
          result.computationGraph.push(entry)
        }
        
        processed.add(nodeId)
      }
    })
  })
  
  return JSON.stringify(result, null, 2)
}