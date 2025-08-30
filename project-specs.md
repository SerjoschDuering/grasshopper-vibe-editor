# VibeCode Grasshopper Editor - Project Specifications with Code References

## Table of Contents
1. [Document Structure](#1-document-structure)
2. [CSS Styles and Design System](#2-css-styles-and-design-system)
3. [HTML Layout Components](#3-html-layout-components)
4. [JavaScript Architecture](#4-javascript-architecture)
5. [State Management](#5-state-management)
6. [Core Functions](#6-core-functions)
7. [Event Handlers](#7-event-handlers)
8. [API Communication](#8-api-communication)
9. [AI Integration](#9-ai-integration)
10. [Utility Functions](#10-utility-functions)
11. [Data Structures](#11-data-structures)

---

## 1. Document Structure

### 1.1 HTML Document Setup
- **DOCTYPE and Meta Tags**: Lines 1-6
- **Title**: Line 6 - "VibeCode GH Editor v2"
- **External Dependencies**: Lines 8-12
  - Bootstrap CSS: Line 8
  - Font Awesome: Line 9
  - Google Fonts: Lines 10-12
- **Script Imports**: Lines 465-466
  - Ace Editor: Line 465
  - Bootstrap JS: Line 466

---

## 2. CSS Styles and Design System

### 2.1 CSS Variables (Lines 15-33)
```css
Location: Lines 15-33
Purpose: Define color scheme and design tokens
Key Variables:
- --primary-color: #7B68EE (Line 16)
- --primary-hover: #6A5ACD (Line 17)
- --secondary-color: #6C757D (Line 18)
- --accent-color: #FF6B6B (Line 19)
- --bg-color: #F8F9FC (Line 20)
- --card-bg: #FFFFFF (Line 21)
- --border-color: #E4E7ED (Line 22)
- --text-color: #374151 (Line 23)
- --text-muted: #6B7280 (Line 24)
- --success-color: #10B981 (Line 25)
- --warning-color: #FBBF24 (Line 26)
- --danger-color: #EF4444 (Line 27)
- --border-radius: 0.5rem (Line 28)
- Shadow definitions (Lines 29-31)
- --transition: all 0.2s ease (Line 32)
```

### 2.2 Base Styles (Lines 35-46)
```css
Location: Lines 35-46
- Body styling: Lines 35-41
- Heading styles: Lines 43-46
```

### 2.3 Component Styles
- **Button Styles**: Lines 48-74
- **Code Editor**: Lines 75-83
- **Card Components**: Lines 85-90
- **Parameter Cards**: Lines 92-111
- **Remove Button**: Lines 113-121
- **Status Message**: Lines 123-128
- **Section Headers**: Lines 130-144
- **Form Elements**: Lines 146-168
- **Main Container**: Lines 170-177
- **App Header**: Lines 179-189
- **Button Icons**: Lines 191-195
- **Parameter Lists**: Lines 197-230
  - Scrollable containers: Lines 197-206
  - Custom scrollbar: Lines 209-223

### 2.4 Animations (Lines 233-299)
- **AI Loading Animation**: Lines 233-250
  - Keyframe definition: Lines 233-243
  - Class application: Lines 245-250
- **AI Speech Bubble**: Lines 252-299
  - Container: Lines 253-257
  - Bubble styling: Lines 259-278
  - Triangle pointer: Lines 281-291
  - Active state: Lines 295-299

---

## 3. HTML Layout Components

### 3.1 Main Container (Lines 304-463)
```html
Location: Lines 304-463
Structure:
- Main container wrapper: Line 304
- App header: Lines 305-308
```

### 3.2 Top Configuration Row (Lines 310-354)
```html
Location: Lines 310-354
Components:
- Configuration Card: Lines 312-339
  - Target GUID input: Lines 317-324
  - API Key input: Lines 326-332
  - Auto-fetch toggle: Lines 333-336
- Testing Card: Lines 341-353
  - Load test data button: Lines 348-350
```

### 3.3 Three-Column Layout (Lines 356-462)

#### Column 1: Input Parameters (Lines 357-370)
```html
Location: Lines 357-370
- Section header: Lines 360-362
- Inputs list container: Line 363
- Add input button: Lines 366-368
```

#### Column 2: Code Editor & AI (Lines 372-429)
```html
Location: Lines 372-429
Components:
- Code Editor Card: Lines 374-396
  - Header: Lines 375-379
  - Editor div: Lines 381-394
- AI Assistant Card: Lines 398-428
  - Header with speech bubble: Lines 399-408
  - Prompt textarea: Lines 411-414
  - Generate params checkbox: Lines 415-420
  - Action buttons: Lines 421-426
```

#### Column 3: Output Parameters (Lines 431-461)
```html
Location: Lines 431-461
- Section header: Lines 434-436
- Outputs list container: Lines 437-452
  - Default output card: Lines 438-451
- Add output button: Lines 453-455
- Status message area: Lines 457-459
```

---

## 4. JavaScript Architecture

### 4.1 Main Script Block (Lines 468-1367)
```javascript
Location: Lines 468-1367
Entry Point: DOMContentLoaded event listener (Line 469)
```

### 4.2 Ace Editor Setup (Lines 470-486)
```javascript
Location: Lines 470-486
Configuration:
- Editor initialization: Line 471
- Theme setting: Line 472
- Python mode: Line 473
- Options object: Lines 474-486
  - Font size, autocompletion, snippets
  - Tab settings, line numbers
```

### 4.3 DOM Element References (Lines 488-503)
```javascript
Location: Lines 488-503
Elements cached:
- inputsList: Line 489
- outputsList: Line 490
- addInputBtn: Line 491
- addOutputBtn: Line 492
- sendToGhBtn: Line 493
- aiSubmitBtn: Line 494
- apiKeyInput: Line 495
- targetGuidInput: Line 496
- aiPromptInput: Line 497
- aiGenerateParamsCheckbox: Line 498
- statusMessage: Line 499
- loadTestDataBtn: Line 500
- fetchFromGhBtn: Line 501
- autoFetchSwitch: Line 502
- aiSummaryBubble: Line 503
```

### 4.4 Configuration Constants (Lines 505-507)
```javascript
Location: Lines 505-507
- ghServerUrl: Line 505 - 'http://127.0.0.1:9998'
- autoFetchIntervalId: Line 506
- AUTO_FETCH_INTERVAL: Line 507 - 2000ms
```

---

## 5. State Management

### 5.1 Local State Variables
```javascript
Location: Lines 505-507
- autoFetchIntervalId: Line 506 (interval timer ID)
- AUTO_FETCH_INTERVAL: Line 507 (2000ms constant)
```

### 5.2 LocalStorage Usage
```javascript
Location: Lines 750, 1349-1356
- Save auto-fetch preference: Line 750
- Initialize from storage: Lines 1349-1356
```

---

## 6. Core Functions

### 6.1 Parameter Card Creation Functions

#### updateCardTitle (Lines 512-520)
```javascript
Location: Lines 512-520
Purpose: Dynamically update parameter card titles
Parameters: cardElement, paramType, newName
```

#### createInputCard (Lines 522-609)
```javascript
Location: Lines 522-609
Purpose: Create new input parameter card
Key Features:
- Card HTML generation: Lines 530-582
- DOM append: Line 583
- Title update: Line 586
- Name change listener: Lines 589-594
- Scroll into view: Line 597
- Animation: Lines 600-608
```

#### createOutputCard (Lines 611-683)
```javascript
Location: Lines 611-683
Purpose: Create new output parameter card
Key Features:
- Default output check: Lines 613-624
- Card HTML generation: Lines 633-653
- DOM append: Line 655
- Title update: Line 658
- Name change listener: Lines 661-668
- Scroll into view: Line 671
- Animation: Lines 674-682
```

### 6.2 UI Utility Functions

#### showStatus (Lines 754-784)
```javascript
Location: Lines 754-784
Purpose: Display status messages with animations
Parameters: message, isError, duration
Features:
- Icon selection: Line 755
- Alert styling: Line 756
- Fade animation: Lines 760-766
- Auto-hide timeout: Lines 774-783
```

#### clearParameters (Lines 1250-1264)
```javascript
Location: Lines 1250-1264
Purpose: Clear all parameter cards except default output
```

#### loadDataFromPayload (Lines 1266-1320)
```javascript
Location: Lines 1266-1320
Purpose: Load data from server response or test data
Key Operations:
- GUID update: Lines 1275-1278
- Code update: Lines 1281-1283
- Parameter update: Lines 1286-1314
```

---

## 7. Event Handlers

### 7.1 Button Click Handlers

#### Add Input Button (Lines 686-692)
```javascript
Location: Lines 686-692
Action: Creates new input parameter card
```

#### Add Output Button (Lines 694-700)
```javascript
Location: Lines 694-700
Action: Creates new output parameter card
```

#### Remove Button Delegation (Lines 703-717)
```javascript
Location: Lines 703-717
Purpose: Handle dynamic remove buttons
Method: Event delegation pattern
```

#### Send to GH Button (Lines 719-723)
```javascript
Location: Lines 719-723
Action: Triggers sendDataToGrasshopper()
```

#### AI Submit Button (Lines 725-729)
```javascript
Location: Lines 725-729
Action: Triggers handleAISubmit()
```

#### Load Test Data Button (Line 732)
```javascript
Location: Line 732
Action: Triggers loadTestData()
```

#### Fetch from GH Button (Lines 735-739)
```javascript
Location: Lines 735-739
Action: Triggers fetchSelectedComponentData()
```

### 7.2 Toggle Handlers

#### Auto-Fetch Switch (Lines 742-751)
```javascript
Location: Lines 742-751
Actions:
- Enable/disable auto-fetch
- Save preference to localStorage
```

---

## 8. API Communication

### 8.1 Grasshopper Server Communication

#### fetchSelectedComponentData (Lines 786-864)
```javascript
Location: Lines 786-864
Purpose: Fetch selected component from Grasshopper
Key Operations:
- Request preparation: Line 787
- Fetch call: Lines 795-803
- Response parsing: Lines 805-812
- GUID comparison: Lines 824-839
- Error handling: Lines 854-863
```

#### sendDataToGrasshopper (Lines 911-984)
```javascript
Location: Lines 911-984
Purpose: Send code and parameters to Grasshopper
Key Operations:
- Data collection: Line 912
- GUID validation: Lines 914-920
- Payload creation: Lines 922-927
- Fetch call: Lines 933-941
- Response handling: Lines 959-975
- Error handling: Lines 977-979
```

#### getUIData (Lines 866-909)
```javascript
Location: Lines 866-909
Purpose: Collect all UI data for sending
Returns: {code, targetGuid, param_definitions}
Operations:
- Get editor code: Line 867
- Get target GUID: Line 868
- Collect input params: Lines 872-887
- Collect output params: Lines 890-902
```

---

## 9. AI Integration

### 9.1 handleAISubmit Function (Lines 986-1217)
```javascript
Location: Lines 986-1217
Purpose: Generate code using OpenAI API
```

#### Function Sections:
1. **Data Collection** (Lines 987-994)
```javascript
Lines 987-994: Collect prompt, API key, and current state
```

2. **Card Animation** (Lines 996-1006)
```javascript
Lines 996-1006: Add loading animation to editor card
```

3. **Validation** (Lines 1008-1023)
```javascript
Lines 1008-1023: Validate prompt and API key
```

4. **System Prompt** (Lines 1025-1037)
```javascript
Lines 1025-1037: IronPython-specific instructions
Key Requirements:
- No f-strings
- Python 2.7 compatibility
- Import statements
- Comments
```

5. **Response Schema** (Lines 1039-1090)
```javascript
Lines 1039-1090: JSON schema for structured output
- Base schema: Lines 1039-1056
- Parameter schema: Lines 1058-1074
- Dynamic schema building: Lines 1077-1090
```

6. **User Prompt Construction** (Lines 1092-1099)
```javascript
Lines 1092-1099: Build context-aware prompt
```

7. **API Request** (Lines 1101-1117)
```javascript
Lines 1101-1117: Request payload structure
- Model: gpt-4o-2024-08-06
- Temperature: 0.5
- Structured output with JSON schema
```

8. **API Call** (Lines 1124-1131)
```javascript
Lines 1124-1131: Fetch to OpenAI API
```

9. **Response Processing** (Lines 1133-1201)
```javascript
Lines 1133-1156: Parse and validate response
Lines 1160-1174: Load generated code/params
Lines 1176-1201: Show speech bubble notification
```

10. **Error Handling** (Lines 1203-1216)
```javascript
Lines 1203-1207: Error display
Lines 1209-1216: Cleanup (finally block)
```

---

## 10. Utility Functions

### 10.1 Auto-Fetch Functions

#### startAutoFetch (Lines 1327-1336)
```javascript
Location: Lines 1327-1336
Purpose: Start automatic component fetching
Operations:
- Check if already running: Line 1328
- Disable manual fetch: Line 1330
- Initial fetch: Line 1332
- Start interval: Line 1334
```

#### stopAutoFetch (Lines 1338-1345)
```javascript
Location: Lines 1338-1345
Purpose: Stop automatic component fetching
Operations:
- Check if running: Line 1339
- Clear interval: Line 1341
- Re-enable manual fetch: Line 1343
```

#### initializeAutoFetch (Lines 1348-1357)
```javascript
Location: Lines 1348-1357
Purpose: Initialize auto-fetch from saved state
```

### 10.2 Test Data Functions

#### loadTestData (Lines 1322-1324)
```javascript
Location: Lines 1322-1324
Purpose: Load predefined test data
```

---

## 11. Data Structures

### 11.1 Test Data Payload (Lines 1220-1248)
```javascript
Location: Lines 1220-1248
Structure:
- type: "update_script"
- instance_guid: Dummy GUID
- code: Sample Python code
- description: Component description
- message_to_user: Status message
- param_definitions: Array of parameter objects
  - Input examples: Lines 1227-1238
  - Output examples: Lines 1240-1246
```

### 11.2 Parameter Definition Structure
```javascript
Input Parameter:
{
  type: "input",
  name: string,
  description: string,
  typehint: enum ["str", "int", "float", "bool", "guid", "point", "vector", "curve", "surface", "brep", "mesh", "generic"],
  access: enum ["item", "list", "tree"],
  optional: boolean
}

Output Parameter:
{
  type: "output",
  name: string,
  description: string
}
```

### 11.3 API Request/Response Structures

#### Fetch Selected Component Request
```javascript
Location: Referenced in fetchSelectedComponentData (Line 787)
{
  type: "get_selected_script_component"
}
```

#### Update Script Request
```javascript
Location: Referenced in sendDataToGrasshopper (Lines 922-927)
{
  type: "update_script",
  instance_guid: string,
  code: string,
  param_definitions: Array<ParameterDefinition>
}
```

#### AI Request Payload
```javascript
Location: Lines 1101-1117
{
  model: "gpt-4o-2024-08-06",
  messages: Array<{role, content}>,
  response_format: {
    type: "json_schema",
    json_schema: {
      name: string,
      description: string,
      schema: object,
      strict: boolean
    }
  },
  temperature: number
}
```

---

## Initialization Sequence

### Application Bootstrap (Lines 1359-1367)
```javascript
Location: Lines 1359-1367
1. File protocol warning: Lines 1360-1362
2. Initialize auto-fetch: Line 1365
3. DOMContentLoaded closes: Line 1367
```

---

## Critical Integration Points

### 1. Grasshopper Server Integration
- **Endpoint**: `http://127.0.0.1:9998` (Line 505)
- **Fetch Function**: fetchSelectedComponentData (Lines 786-864)
- **Send Function**: sendDataToGrasshopper (Lines 911-984)
- **Auto-fetch Logic**: Lines 1327-1357

### 2. OpenAI API Integration
- **Main Function**: handleAISubmit (Lines 986-1217)
- **API Endpoint**: "https://api.openai.com/v1/chat/completions" (Line 1124)
- **Model**: "gpt-4o-2024-08-06" (Line 1102)

### 3. UI State Synchronization
- **Parameter Cards**: Dynamic creation/removal (Lines 522-683, 703-717)
- **Editor Content**: Ace editor instance (Lines 470-486)
- **Status Updates**: showStatus function (Lines 754-784)

### 4. Data Flow Paths
- **User → GH**: getUIData → sendDataToGrasshopper
- **GH → User**: fetchSelectedComponentData → loadDataFromPayload
- **AI Generation**: handleAISubmit → loadDataFromPayload

---

## Refactoring Considerations

### Key Areas for Modularization
1. **Parameter Management**: Lines 522-683, 866-909, 1250-1264
2. **API Communication**: Lines 786-984
3. **AI Integration**: Lines 986-1217
4. **UI Updates**: Lines 754-784, 1266-1320
5. **Event Handlers**: Lines 686-751


## End of Document

This specification provides complete line-by-line references to the grasshopper_vibeCoder.html file, enabling precise navigation and understanding of the codebase for refactoring purposes.