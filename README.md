
# VibeCode Grasshopper Editor

A simple web-app-like code editor for Grasshopper Python components that streamlines your workflow and enhances productivity with AI-assisted code generation.

![VibeCode Editor Overview](docs/overview_1.jpg)

## What is VibeCode?

VibeCode is a .. vibe coded .. interface for editing GHPython components that eliminates the frustration of working with Grasshopper's limited code editor. It provides a real-time connection between a web-based code editor and your Grasshopper canvas, making "vibe coding" easier with a more seamless AI integration -> less copy&paste.

-> its promptet to generate ironpython / python 2.7 code <-

## Key Features

- **Real-time synchronization** between the web editor and Grasshopper
- **AI-powered code generation** with GPT-5 models (nano, mini, full)
- **Context-aware AI** that understands your canvas connections and component relationships
- **Add, modify, or remove** input and output parameters visually
- **Auto-fetch** selected components from your Grasshopper canvas
- **Canvas Context System** provides AI with information about connected components
- **Syntax highlighting** and modern code editing features
- **Instant deployment** of changes back to Grasshopper

![Detailed Interface](docs/overview.jpg)

## Getting Started

1. **Open the Grasshopper file** with the server component (or paste the server code into a new GHPython component)
2. **Ensure the server is running** (toggle should be set to "True")
3. **Double-click** the `grasshopper_vibeCoder.html` file to open the web interface
4. **Select a script component** in Grasshopper to edit it in the web interface

## Using AI Code Generation

1. Enter your OpenAI API key in the configuration section
2. Select your preferred model:
   - **GPT-5 Nano**: Fastest and most cost-effective ($0.05/$0.40 per 1M tokens)
   - **GPT-5 Mini**: Balanced performance ($0.25/$2.00 per 1M tokens)
   - **GPT-5**: Most capable with full context support ($1.25/$10.00 per 1M tokens)
3. Type a prompt describing what you want to create
4. Toggle "Generate/Update Input/Output Parameters" if you want the AI to handle parameter creation
5. Enable "Canvas State" context provider for AI to understand connected components
6. Click "Generate Code with AI"
7. Review and send changes back to Grasshopper with "Send to GH"

### Context System

The Canvas Context feature provides AI with intelligent information about your Grasshopper definition:
- **Automatic Detection**: Identifies components connected to your selected component (±1 level)
- **Medium Detail**: Component names, types, parameters, and connections
- **Full Detail (GPT-5)**: Includes script contents from connected components
- **Smart Filtering**: Only relevant components are included to optimize token usage
- This context helps AI generate code that properly integrates with your existing data flow

## Requirements

- Rhino 7+ with Grasshopper
- Modern web browser
- Internet connection for AI features (OpenAI API key required)
- The GHPython server must be running in your Grasshopper file

## How It Works

VibeCode establishes a local connection between your browser and Grasshopper using a custom server component. When you select a GHPython component in Grasshopper, the editor automatically fetches its code and parameters, allowing you to make changes in a modern editor interface before sending them back to Grasshopper with a single click.
