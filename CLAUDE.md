# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VibeCode Grasshopper Editor is a web-based code editor for Grasshopper Python components that provides real-time synchronization between a browser interface and Grasshopper. It enables AI-assisted code generation for IronPython/Python 2.7 scripts.

## Architecture

The project consists of:
- **grasshopper_vibeCoder.html**: Single-file web application that serves as the editor interface
- **gh_client_snippet.gh**: Grasshopper file containing the Python server component
- **Server**: Runs on `http://127.0.0.1:9998` inside Grasshopper to handle communication

## Key Technical Details

### Editor
- Uses **Ace Editor** for code editing (integrated via CDN)
- Bootstrap 5.3.3 for UI components
- Font Awesome for icons
- No build process or package.json - pure HTML/CSS/JavaScript

### Python Environment
- **IMPORTANT**: All generated Python code must be **IronPython/Python 2.7 compatible**
- **Never use f-strings** - use `.format()` or older string formatting
- Runs inside Rhino/Grasshopper environment with access to `rhinoscriptsyntax` and Grasshopper APIs

### API Communication
- RESTful API between web editor and Grasshopper server
- CORS headers configured in server for file:// protocol access
- Endpoints handle code synchronization and parameter management

## Development Workflow

1. Open the Grasshopper file with the server component
2. Ensure server toggle is set to "True" 
3. Open `grasshopper_vibeCoder.html` directly in a browser (no local server needed)
4. Select GHPython components in Grasshopper to edit them

## Testing

No automated tests are present. Manual testing involves:
- Opening the HTML file in a browser
- Verifying connection to the Grasshopper server
- Testing code synchronization between editor and Grasshopper