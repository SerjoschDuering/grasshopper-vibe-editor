# Context Feature Implementation Plan & Documentation

## Current Implementation Status

### Overview
The Context feature provides a way to visualize and export the entire Grasshopper graph structure, including components, parameters, connections, and DAG (Directed Acyclic Graph) execution stages. This feature is integrated into the React/Next.js application as a separate tab alongside the main Coding tab.

## Files Created/Modified

### Backend (Python/IronPython)

#### `/ghserver.py` (Modified)
- **Purpose**: Grasshopper server that runs inside GH Python component
- **Key Additions**:
  - `get_context()` function (lines 484-645): Collects complete graph data
  - `_rect_canvas_to_web()`: Coordinate transformation for canvas bounds
  - `_pt_canvas_to_web()`: Point coordinate transformation
  - `_collect_runtime_messages()`: Gathers component errors/warnings/remarks
  - Extended `GHEncoder` class to handle RectangleF and Point3d serialization
- **Integration**: Responds to POST requests with `type: "get_context"` from the web app

### Frontend (React/TypeScript)

#### `/src/store/app-store.ts` (Modified)
- **Purpose**: Zustand state management store
- **Key Additions**:
  - Context tab state: `activeTab`, `contextData`, `contextLoading`, `contextError`
  - View controls: `contextViewMode`, `contextSearch`, `contextFilterType`, `contextFilterStage`
  - Actions: `fetchContext()`, `setContextViewMode()`, `setContextFilters()`
  - Auto-refresh functionality with `contextAutoRefresh` toggle
- **Integration**: Shares the same store with code editor, parameters, and AI features

#### `/src/components/TabNavigation.tsx` (New)
- **Purpose**: Tab switcher between Coding and Context views
- **Features**: 
  - Space-compact design with icon + text
  - Active tab highlighting
  - Persists selection to localStorage

#### `/src/lib/context-utils.ts` (New)
- **Purpose**: Context data processing utilities
- **Key Functions**:
  - `processContextData()`: Transforms raw server data
  - `computeDAGStages()`: Kahn's algorithm for topological sorting
  - `filterComponents()`: Search and filter functionality
  - `generateMarkdownTemplate()`, `generateJSONTemplate()`, `generateXMLTemplate()`
- **Data Types**: Defines `ContextComponent`, `ContextParam`, `ContextConnection` interfaces

#### `/src/components/ContextPanel.tsx` (New)
- **Purpose**: Main container for Context tab
- **Features**:
  - Fetch context button with loading states
  - Auto-refresh toggle (5-second interval)
  - View mode selector (Compact/Detailed/Stages/JSON)
  - Search and filter controls
  - Statistics display
- **Integration**: Uses app store for state, delegates to view components

#### `/src/components/ContextCompactView.tsx` (New)
- **Purpose**: Grid view of component cards
- **Displays**: Component name, category, stage, error/warning counts, I/O counts

#### `/src/components/ContextDetailedView.tsx` (New)
- **Purpose**: Expanded view with parameter details
- **Displays**: Full component info with input/output parameter badges

#### `/src/components/ContextStagesView.tsx` (New)
- **Purpose**: Components grouped by DAG execution stages
- **Features**: Collapsible stage groups, stage-based organization

#### `/src/components/ContextJSONView.tsx` (New)
- **Purpose**: Raw JSON data viewer
- **Features**:
  - Toggle between raw server data and processed data
  - Collapsible sections for components/params/connections
  - Copy to clipboard functionality
  - Syntax-highlighted JSON display

#### `/src/components/ContextTemplateGenerator.tsx` (New)
- **Purpose**: Generate templates for AI prompts
- **Formats**: Markdown, JSON, XML
- **Features**: Collapsible panel, format selector, clipboard copy

#### `/src/app/page.tsx` (Modified)
- **Changes**: 
  - Added tab navigation at top
  - Conditional rendering based on `activeTab`
  - Imports and renders `ContextPanel` for context tab

#### `/src/app/globals.css` (Modified)
- **Additions**:
  - `.context-component-card` styles
  - `.btn-group` for view mode buttons
  - `.btn-outline` button variant
  - Context-specific hover and transition effects

## Current JSON Structure (From Server)

```json
{
  "status": "success",
  "components": [
    {
      "instanceGuid": "abc-123-def-456",
      "name": "Number Slider",
      "nickName": "Slider",
      "description": "Numeric slider for single values",
      "category": "Params",
      "subCategory": "Input",
      "kind": "component",
      "isScript": false,
      "scriptContent": null,  // Populated for GHPython, C#, VB components
      "locked": false,
      "hidden": false,
      "runtime": {
        "errors": [],
        "warnings": [],
        "remarks": []
      },
      "inputs": [
        {
          "instanceGuid": "param-guid-1",
          "componentGuid": "abc-123-def-456",
          "name": "input",
          "nickName": "I",
          "kind": "input",
          "dataType": "Number",
          "access": "item",
          "optional": true,
          "hasData": false
        }
      ],
      "outputs": [
        {
          "instanceGuid": "param-guid-2",
          "componentGuid": "abc-123-def-456",
          "name": "output",
          "nickName": "O",
          "kind": "output",
          "dataType": "Number"
        }
      ],
      "bounds": {
        "x": 100,
        "y": -200,
        "width": 150,
        "height": 50
      },
      "pivot": {
        "x": 175,
        "y": -175,
        "z": 0
      },
      "computationTime": 0.5
    }
  ],
  "params": [
    // Flat list of all parameters for connection tracking
    // Includes both component params and standalone params
  ],
  "connections": [
    {
      "from": "param-guid-output",
      "to": "param-guid-input",
      "type": "wire"
    }
  ],
  "meta": {
    "componentCount": 25,
    "paramCount": 87,
    "connectionCount": 42
  }
}
```

## Processed Context Structure (Client-side)

```typescript
interface ProcessedContext {
  components: ContextComponent[]      // Original components with stage numbers added
  params: ContextParam[]              // Flat param list
  connections: ContextConnection[]    // Wire connections
  stages: string[][]                  // Component GUIDs grouped by execution stage
  componentMap: Record<string, ContextComponent>  // GUID lookup map
  adjacencyList: Record<string, string[]>        // Component-level edges for DAG
}
```

## Integration Points

### With Existing Features

1. **Shared State Store**: Uses the same Zustand store as the code editor, maintaining consistency
2. **UI Components**: Reuses existing button styles, card components, form controls
3. **Status System**: Integrates with app-wide status messaging
4. **Local Storage**: Follows existing patterns for persistence (tab selection)
5. **API Patterns**: Uses same fetch patterns as other Grasshopper API calls
6. **Styling System**: Leverages existing CSS variables and Tailwind classes

### With AI Features

1. **Template Generation**: Creates context templates that can be copied into AI prompts
2. **Context Provider System**: Ready to integrate with existing AI context providers in `openai-api.ts`
3. **Future**: Can provide component context to AI for better code generation

## Proposed Improvements (Not Yet Implemented)

### Three-Level Detail System

#### 1. Simple View (Component Graph with GUIDs)
- **Purpose**: Show component connections with GUIDs for traversal
- **JSON**: Component GUIDs, name+nickname, description, and condensed connections
- **Markdown**: Clean graph with embedded connections
- **Key Features**:
  - GUIDs always included for reference
  - Name and nickname concatenated (e.g., "Multiply (AxB)")
  - Description field for LLM understanding
  - Connections embedded in components (not separate)
  - Multiple param connections condensed to single entry
  - Data type descriptions (e.g., "points and numbers")

Example JSON:
```json
{
  "guid": "ghi-789-jkl-012",
  "name": "Multiply (AxB)",
  "description": "Perform multiplication of two numbers",
  "inputs": [
    {"from": "abc-123-def-456", "description": "numbers"},
    {"from": "mno-345-pqr-678", "description": "numbers"}
  ],
  "outputs": [
    {"to": "stu-901-vwx-234", "description": "numbers"},
    {"to": "yza-567-bcd-890", "description": "numbers"}
  ]
}
```

Example Markdown:
```markdown
Multiply (AxB) [ghi-789-jkl-012]
Description: Perform multiplication of two numbers
Inputs from:
  - Number Slider (Slider A) [abc-123-def-456] (numbers)
  - Number Slider (Slider B) [mno-345-pqr-678] (numbers)
Outputs to:
  - Panel (Result) [stu-901-vwx-234] (numbers)
  - Point (Pt) [yza-567-bcd-890] (numbers)
```

#### 2. Standard View (Key Attributes with Connections)
- **Purpose**: Working view with port details and stages
- **JSON**: GUIDs, name+nickname, description, categories, port names, param counts, data types
- **Markdown**: Structured by stages with connection details
- **Key Features**:
  - Name and nickname concatenated
  - Description field included
  - Port-level connection details
  - Execution stages
  - Error/warning indicators
  - Parameter counts and types

Example JSON:
```json
{
  "guid": "ghi-789-jkl-012",
  "name": "Multiply (AxB)",
  "description": "Perform multiplication of two numbers",
  "category": "Maths/Operators",
  "stage": 1,
  "inputs": [
    {
      "from": "abc-123-def-456",
      "fromPort": "output",
      "port": "A",
      "paramCount": 1,
      "dataTypes": ["Number"]
    },
    {
      "from": "mno-345-pqr-678",
      "fromPort": "output",
      "port": "B",
      "paramCount": 1,
      "dataTypes": ["Number"]
    }
  ],
  "outputs": [
    {
      "to": "stu-901-vwx-234",
      "toPort": "input",
      "paramCount": 1,
      "dataTypes": ["Number"]
    }
  ],
  "status": {
    "errors": 0,
    "warnings": 1,
    "warningMsg": "Input B has null values"
  }
}
```

Example Markdown:
```markdown
Stage 1

Multiply (AxB) [ghi-789-jkl-012] [Maths/Operators]
Description: Perform multiplication of two numbers
Warning: Input B has null values
Inputs:
  - Port A from Number Slider (Slider A) [abc-123-def-456] (1x Number)
  - Port B from Number Slider (Slider B) [mno-345-pqr-678] (1x Number)
Outputs:
  - To Panel (Result) [stu-901-vwx-234] port:input (1x Number)
```

#### 3. Detailed View (Full Data)
- **Purpose**: Complete debugging information
- **JSON**: All attributes including param GUIDs, bounds, runtime messages, and script content
- **Markdown**: Comprehensive documentation with all metadata
- **Key Features**:
  - All fields from Standard view
  - Parameter GUIDs
  - Canvas bounds and positions
  - Runtime messages (errors, warnings, remarks)
  - **Script content for code components (GHPython, C#, VB)**
  - Computation time

Example for code component:
```json
{
  "guid": "xyz-456-abc-789",
  "name": "GHPython Script (CustomLogic)",
  "description": "Custom Python script for data processing",
  "category": "Maths/Script",
  "isScript": true,
  "scriptContent": "import rhinoscriptsyntax as rs\nimport math\n\ndef process_data(x, y):\n    # Custom logic here\n    result = x * math.sin(y)\n    return result\n\na = process_data(x, y)",
  "inputs": [...],
  "outputs": [...],
  "bounds": {"x": 100, "y": -200, "width": 150, "height": 100},
  "runtime": {
    "errors": [],
    "warnings": [],
    "remarks": ["Script executed successfully"]
  },
  "computationTime": 0.023
}
```

### LLM-Optimized Templates with GUID-based Traversal

Each detail level should have corresponding generators optimized for LLM consumption and graph traversal:

```typescript
// Level of detail enum
export enum DetailLevel {
  Simple = 'simple',    // Graph with GUIDs and condensed connections
  Standard = 'standard', // Port details, stages, warnings
  Detailed = 'detailed'  // Everything including param GUIDs
}

// Connection condensing for simple view
interface CondensedConnection {
  from?: string  // Component GUID
  to?: string    // Component GUID  
  description: string  // e.g., "points and numbers" or "3x numbers, 2x points"
}

// Markdown generators for each level
export function generateSimpleMarkdown(context): string
export function generateStandardMarkdown(context): string  
export function generateDetailedMarkdown(context): string

// JSON structure for simple view
interface SimpleComponent {
  guid: string
  name: string  // Concatenated "Name (NickName)"
  description: string  // Component description for LLM understanding
  inputs: CondensedConnection[]
  outputs: CondensedConnection[]
}

// Additional fields for code components in detailed view
interface DetailedCodeComponent extends DetailedComponent {
  isScript: boolean
  scriptContent?: string  // Python, C#, or VB script content
  scriptLanguage?: string  // "Python", "C#", "VB"
}
```

### Visual Graph View (Proposed)

#### Overview
- **Purpose**: Visual representation of component graph using canvas coordinates
- **Technology**: Canvas API or SVG for rendering
- **Features**:
  - Component boxes with bounds from server data
  - Connection wires between components
  - Zoom/pan navigation
  - Selection highlighting
  - Upstream/downstream visualization
  - Color coding by stage, errors, or component type

#### Visual Representation Structure
```typescript
interface VisualComponent {
  guid: string
  name: string  // "Name (NickName)"
  bounds: { x: number, y: number, width: number, height: number }
  isSelected: boolean
  isUpstream: boolean
  isDownstream: boolean
  stage: number
  hasErrors: boolean
  hasWarnings: boolean
}

interface VisualConnection {
  fromGuid: string
  toGuid: string
  fromPoint: { x: number, y: number }
  toPoint: { x: number, y: number }
  isHighlighted: boolean  // true if part of selected path
}
```

### Selection-Based Context System (Proposed)

#### Zustand Store Updates
```typescript
interface ContextSelectionState {
  // Selection tracking
  selectedComponentGuids: string[]
  selectedParamGuids: string[]
  
  // Traversal settings
  upstreamLevels: number  // 0-10, default 0
  downstreamLevels: number  // 0-10, default 0
  
  // Computed context
  contextComponents: string[]  // All component GUIDs in context
  contextSize: {
    componentCount: number
    estimatedChars: number  // Approximate text size
    estimatedTokens: number  // For LLM context awareness
  }
  
  // Actions
  fetchSelection: () => Promise<void>
  setUpstreamLevels: (levels: number) => void
  setDownstreamLevels: (levels: number) => void
  clearSelection: () => void
  addToSelection: (guid: string) => void
  removeFromSelection: (guid: string) => void
}
```

#### UI Components
```typescript
// Selection controls panel
interface SelectionControlsProps {
  onFetchSelection: () => void
  upstreamLevels: number
  downstreamLevels: number
  onUpstreamChange: (levels: number) => void
  onDownstreamChange: (levels: number) => void
  contextSize: ContextSize
  detailLevel: DetailLevel
}

// Live context size indicator
interface ContextSizeIndicator {
  componentCount: number
  estimatedChars: number
  estimatedTokens: number
  detailLevel: DetailLevel
}
```

#### Server Endpoint Extension
```python
# New endpoint for fetching selected components
def get_selected_components():
    """Returns GUIDs of currently selected components in GH canvas"""
    doc = ghenv.Component.OnPingDocument()
    selected_guids = []
    for obj in doc.SelectedObjects():
        if isinstance(obj, gh.Kernel.IGH_Component):
            selected_guids.append(str(obj.InstanceGuid))
    return {"selectedGuids": selected_guids}
```

### GUID-Based Component Context Traversal (Enhanced)

Structure to support focused context extraction using GUIDs:

```typescript
interface ContextTraversalOptions {
  mode: 'all' | 'selected' | 'radius'
  selectedGuids: string[]  // Component GUIDs to focus on
  upstreamLevels?: number   // How many levels upstream to include
  downstreamLevels?: number // How many levels downstream to include
  detailLevel: DetailLevel  // Which detail level to return
}

// Example usage by LLM:
// 1. LLM reviews simple markdown, identifies component of interest
// 2. LLM requests: "Show me component ghi-789-jkl-012 with 2 levels upstream/downstream at standard detail"
// 3. System returns focused context for analysis
```

This enables:
- "Show me component `ghi-789-jkl-012` + 2 levels upstream/downstream"
- "Show detailed view of components `[guid1, guid2, guid3]`"
- "Show critical path between `guid-start` and `guid-end`"

### UI Improvements

1. **Clearer View Labels**: Replace current buttons with descriptive options
2. **Format Toggle**: Separate JSON/Markdown format from detail level
3. **Progressive Disclosure**: Start simple, allow drilling into details
4. **Better Visual Hierarchy**: Use typography and spacing to show relationships

## Benefits of Current Implementation

1. **Complete Graph Visibility**: See entire Grasshopper definition structure
2. **DAG Analysis**: Understand execution order through topological stages
3. **Error Detection**: Quickly spot components with errors/warnings
4. **Search & Filter**: Find specific components easily
5. **Export Ready**: Generate templates for documentation or AI prompts
6. **Performance**: Client-side processing keeps server lightweight
7. **Extensible**: Structure supports future enhancements

## Implementation Priority

### Phase 1: Selection System & Store Updates
1. Update Zustand store with selection state
2. Add server endpoint for fetching GH canvas selection
3. Implement upstream/downstream traversal logic
4. Add context size calculation (chars/tokens)

### Phase 2: Three-Level Detail System
1. Refactor markdown generators for Simple/Standard/Detailed
2. Update JSON generators with name concatenation
3. Add description field throughout
4. Implement script content extraction for code components

### Phase 3: Visual Graph View
1. Create Canvas/SVG component for graph rendering
2. Implement zoom/pan controls
3. Add selection highlighting
4. Color coding for stages/errors
5. Connection path rendering

### Phase 4: UI Integration
1. Selection controls panel with sliders
2. Live context size indicator
3. Detail level selector integration with selection
4. Export selected context functionality

### Phase 5: Advanced Features
1. Multi-selection support
2. Path finding between components
3. Context caching for performance
4. Integration with AI code generation

## Testing Checklist

- [ ] Server endpoint returns complete graph data
- [ ] Tab navigation switches smoothly
- [ ] All view modes display correctly
- [ ] Search and filters work across all views
- [ ] Template generation produces valid Markdown/JSON/XML
- [ ] Auto-refresh updates data without losing view state
- [ ] Error states handled gracefully
- [ ] Performance acceptable with large graphs (100+ components)