# Context Feature Implementation Plan

## Overview
Step-by-step implementation plan for enhanced context features including selection-based context, three-level detail system, and visual graph view.

## Phase 1: Selection System & Store Updates (Priority: HIGH)

### Step 1: Update Zustand Store (app-store.ts)
```typescript
// Add to AppState interface:
interface AppState {
  // ... existing state ...
  
  // Selection state
  selectedComponentGuids: string[]
  selectedParamGuids: string[]
  
  // Traversal settings
  contextUpstreamLevels: number     // 0-10, default 0
  contextDownstreamLevels: number   // 0-10, default 0
  contextDetailLevel: 'simple' | 'standard' | 'detailed'  // default 'simple'
  
  // Computed context
  contextComponents: string[]  // All component GUIDs in current context
  contextSize: {
    componentCount: number
    estimatedChars: number
    estimatedTokens: number
  }
  
  // New actions
  fetchSelection: () => Promise<void>
  setUpstreamLevels: (levels: number) => void
  setDownstreamLevels: (levels: number) => void
  setContextDetailLevel: (level: 'simple' | 'standard' | 'detailed') => void
  clearSelection: () => void
  addToSelection: (guid: string) => void
  removeFromSelection: (guid: string) => void
  computeContextSize: () => void
}
```

### Step 2: Server Endpoint for Selection (ghserver.py)
```python
# Add to request handler
elif request_data.get('type') == 'get_selection':
    return get_selected_components()
    
def get_selected_components():
    """Returns GUIDs of currently selected components in GH canvas"""
    doc = ghenv.Component.OnPingDocument()
    selected_guids = []
    
    for obj in doc.SelectedObjects():
        if isinstance(obj, gh.Kernel.IGH_Component):
            selected_guids.append(str(obj.InstanceGuid))
            
    return {
        "status": "success",
        "selectedGuids": selected_guids,
        "count": len(selected_guids)
    }
```

### Step 3: Context Utils - Traversal Functions (context-utils.ts)
```typescript
// Add upstream/downstream traversal
export function getUpstreamComponents(
  componentGuid: string,
  levels: number,
  processedContext: ProcessedContext,
  visited: Set<string> = new Set()
): string[] {
  if (levels <= 0 || visited.has(componentGuid)) return []
  
  visited.add(componentGuid)
  const result = [componentGuid]
  
  // Find all components that output to this one
  const component = processedContext.componentMap[componentGuid]
  if (component?.inputs) {
    for (const input of component.inputs) {
      if (input.from) {
        const upstream = getUpstreamComponents(
          input.from,
          levels - 1,
          processedContext,
          visited
        )
        result.push(...upstream)
      }
    }
  }
  
  return [...new Set(result)]
}

export function getDownstreamComponents(
  componentGuid: string,
  levels: number,
  processedContext: ProcessedContext,
  visited: Set<string> = new Set()
): string[] {
  // Similar logic but following outputs
}
```

### Step 4: Selection Controls Component
```typescript
// src/components/ContextSelectionControls.tsx
export function ContextSelectionControls() {
  const {
    selectedComponentGuids,
    contextUpstreamLevels,
    contextDownstreamLevels,
    contextSize,
    fetchSelection,
    setUpstreamLevels,
    setDownstreamLevels
  } = useAppStore()
  
  return (
    <div className="context-selection-controls">
      <button onClick={fetchSelection}>
        Fetch GH Selection ({selectedComponentGuids.length})
      </button>
      
      <div className="level-controls">
        <label>
          Upstream: {contextUpstreamLevels}
          <input
            type="range"
            min="0"
            max="10"
            value={contextUpstreamLevels}
            onChange={(e) => setUpstreamLevels(Number(e.target.value))}
          />
        </label>
        
        <label>
          Downstream: {contextDownstreamLevels}
          <input
            type="range"
            min="0"
            max="10"
            value={contextDownstreamLevels}
            onChange={(e) => setDownstreamLevels(Number(e.target.value))}
          />
        </label>
      </div>
      
      <div className="context-size">
        Components: {contextSize.componentCount}
        Est. Chars: {contextSize.estimatedChars}
        Est. Tokens: {contextSize.estimatedTokens}
      </div>
    </div>
  )
}
```

## Phase 2: Three-Level Detail System (Priority: HIGH)

### Step 5: Update Context Utils - Name Concatenation
```typescript
// Add to context-utils.ts
export function getComponentDisplayName(component: ContextComponent): string {
  const name = component.name || ''
  const nickName = component.nickName || ''
  
  if (nickName && nickName !== name) {
    return `${name} (${nickName})`
  }
  return name || nickName
}

// Update processContextData to use concatenated names
export function processContextData(data: any): ProcessedContext {
  // ... existing processing ...
  
  // Add name concatenation
  components = components.map(comp => ({
    ...comp,
    displayName: getComponentDisplayName(comp)
  }))
  
  // ... rest of processing ...
}
```

### Step 6: Three-Level Markdown Generators
```typescript
// Simple level - GUIDs and connections only
export function generateSimpleMarkdown(
  components: ContextComponent[],
  processedContext: ProcessedContext
): string {
  let markdown = '## Component Graph\n\n'
  
  for (const comp of components) {
    const displayName = getComponentDisplayName(comp)
    markdown += `${displayName} [${comp.instanceGuid}]\n`
    markdown += `Description: ${comp.description || 'No description'}\n`
    
    // Condensed inputs
    if (comp.inputs?.length) {
      markdown += 'Inputs from:\n'
      const inputsBySource = new Map<string, string[]>()
      
      for (const input of comp.inputs) {
        if (input.from) {
          const source = processedContext.componentMap[input.from]
          if (source) {
            const types = inputsBySource.get(input.from) || []
            types.push(input.dataType || 'data')
            inputsBySource.set(input.from, types)
          }
        }
      }
      
      for (const [sourceGuid, types] of inputsBySource) {
        const source = processedContext.componentMap[sourceGuid]
        const sourceDisplay = getComponentDisplayName(source)
        const typeDesc = condenseDataTypes(types)
        markdown += `  - ${sourceDisplay} [${sourceGuid}] (${typeDesc})\n`
      }
    }
    
    // Similar for outputs
    markdown += '\n'
  }
  
  return markdown
}

// Standard level - includes ports and stages
export function generateStandardMarkdown(
  components: ContextComponent[],
  processedContext: ProcessedContext
): string {
  // Group by stages
  const byStage = new Map<number, ContextComponent[]>()
  
  for (const comp of components) {
    const stage = comp.stage || 0
    const stageComps = byStage.get(stage) || []
    stageComps.push(comp)
    byStage.set(stage, stageComps)
  }
  
  let markdown = '## Component Graph by Stage\n\n'
  
  for (const [stage, stageComps] of Array.from(byStage).sort((a, b) => a[0] - b[0])) {
    markdown += `### Stage ${stage}\n\n`
    
    for (const comp of stageComps) {
      const displayName = getComponentDisplayName(comp)
      markdown += `${displayName} [${comp.instanceGuid}] [${comp.category}/${comp.subCategory}]\n`
      markdown += `Description: ${comp.description || 'No description'}\n`
      
      // Include warnings/errors
      if (comp.runtime?.errors?.length) {
        markdown += `Errors: ${comp.runtime.errors.length}\n`
      }
      if (comp.runtime?.warnings?.length) {
        markdown += `Warnings: ${comp.runtime.warnings.join(', ')}\n`
      }
      
      // Port-level details
      if (comp.inputs?.length) {
        markdown += 'Inputs:\n'
        for (const input of comp.inputs) {
          const source = input.from ? processedContext.componentMap[input.from] : null
          const sourceDisplay = source ? getComponentDisplayName(source) : 'unconnected'
          markdown += `  - Port ${input.name} from ${sourceDisplay}`
          if (input.from) markdown += ` [${input.from}]`
          markdown += ` (${input.paramCount || 1}x ${input.dataType})\n`
        }
      }
      
      // Similar for outputs
      markdown += '\n'
    }
  }
  
  return markdown
}

// Detailed level - everything including script content
export function generateDetailedMarkdown(
  components: ContextComponent[],
  processedContext: ProcessedContext
): string {
  // Include all fields from standard plus:
  // - Parameter GUIDs
  // - Script content for code components
  // - Bounds and positions
  // - Computation time
  // - Full runtime messages
}

// Helper to condense data types
function condenseDataTypes(types: string[]): string {
  const counts = new Map<string, number>()
  for (const type of types) {
    counts.set(type, (counts.get(type) || 0) + 1)
  }
  
  const parts = []
  for (const [type, count] of counts) {
    if (count > 1) {
      parts.push(`${count}x ${type}`)
    } else {
      parts.push(type)
    }
  }
  
  return parts.join(', ')
}
```

### Step 7: Script Content Extraction (ghserver.py)
```python
# Add to get_context function
def get_context():
    # ... existing code ...
    
    for obj in doc.Objects:
        if isinstance(obj, gh.Kernel.IGH_Component):
            comp_data = {
                # ... existing fields ...
                "isScript": False,
                "scriptContent": None,
                "scriptLanguage": None
            }
            
            # Check if it's a script component
            if hasattr(obj, 'ScriptSource'):
                comp_data["isScript"] = True
                comp_data["scriptContent"] = obj.ScriptSource.ScriptCode
                
                # Detect language
                if "GhPython" in str(type(obj)):
                    comp_data["scriptLanguage"] = "Python"
                elif "C#" in str(type(obj)):
                    comp_data["scriptLanguage"] = "C#"
                elif "VB" in str(type(obj)):
                    comp_data["scriptLanguage"] = "VB"
            
            components.append(comp_data)
```

## Phase 3: Visual Graph View (Priority: MEDIUM)

### Step 8: Install Graph Visualization Library
```bash
npm install react-flow-renderer
# OR
npm install d3 @types/d3
```

### Step 9: Create Visual Graph Component
```typescript
// src/components/ContextGraphView.tsx
import ReactFlow, { Node, Edge } from 'react-flow-renderer'

export function ContextGraphView() {
  const { contextData, selectedComponentGuids } = useAppStore()
  
  // Convert context data to react-flow format
  const nodes: Node[] = contextData.components.map(comp => ({
    id: comp.instanceGuid,
    data: { 
      label: getComponentDisplayName(comp),
      hasErrors: comp.runtime?.errors?.length > 0,
      isSelected: selectedComponentGuids.includes(comp.instanceGuid)
    },
    position: { 
      x: comp.bounds?.x || 0, 
      y: -comp.bounds?.y || 0  // Flip Y for web coordinates
    },
    style: {
      background: comp.runtime?.errors?.length ? '#ff6b6b' : '#e9ecef',
      border: selectedComponentGuids.includes(comp.instanceGuid) ? '2px solid #007bff' : '1px solid #dee2e6'
    }
  }))
  
  const edges: Edge[] = contextData.connections.map((conn, idx) => ({
    id: `e${idx}`,
    source: conn.from,
    target: conn.to,
    animated: selectedComponentGuids.includes(conn.from) || selectedComponentGuids.includes(conn.to)
  }))
  
  return (
    <div style={{ height: '600px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
      />
    </div>
  )
}
```

## Phase 4: Integration & Testing

### Step 10: Integrate All Components
1. Add ContextSelectionControls to ContextPanel
2. Update view components to respect selection
3. Add detail level toggle
4. Test with various graph sizes

### Step 11: Performance Optimization
1. Memoize context calculations
2. Virtualize large component lists
3. Debounce upstream/downstream level changes
4. Cache processed context data

### Step 12: Testing Checklist
- [ ] Selection fetching from GH works
- [ ] Upstream/downstream traversal correct
- [ ] Context size calculation accurate
- [ ] Three detail levels generate correctly
- [ ] Name concatenation throughout
- [ ] Script content extracted for code components
- [ ] Visual graph renders correctly
- [ ] Selection highlighting works
- [ ] Performance acceptable with 100+ components

## Estimated Timeline
- **Week 1**: Phase 1 & 2 (Core functionality)
- **Week 2**: Phase 3 & 4 (Visual view and polish)

## Risk Mitigation
1. **IronPython limitations**: Keep graph algorithms simple
2. **Performance**: Add loading states and progress indicators
3. **Large graphs**: Implement pagination or virtualization
4. **Memory usage**: Clear old context data when switching views