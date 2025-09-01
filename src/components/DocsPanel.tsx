'use client'

export default function DocsPanel() {
  return (
    <div className="card">
      <div className="card-header bg-white p-4 border-b">
        <h3 className="flex items-center text-lg font-semibold mb-0">
          <i className="fas fa-book text-blue-600 mr-2"></i>
          Documentation & Setup Guide
        </h3>
      </div>
      <div className="card-body p-0" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <div className="p-6 prose prose-sm max-w-none">
          
          {/* Header */}
          <div className="text-center mb-8">
            <img 
              src="/docs/overview_1.jpg" 
              alt="VibeCode Editor Overview" 
              className="w-full max-w-4xl mx-auto rounded-lg shadow-lg mb-4"
            />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">VibeCode Grasshopper Editor</h1>
            <p className="text-lg text-gray-600">
              A modern web-based code editor for Grasshopper Python components that streamlines your workflow with AI-assisted code generation and intelligent context analysis.
            </p>
          </div>

          {/* Download Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <i className="fas fa-download text-blue-600 mr-2"></i>
              Required Download
            </h2>
            <p className="mb-4">
              <strong>Before using VibeCode, you must download and open the Grasshopper server component:</strong>
            </p>
            <div className="bg-white border rounded p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <strong>gh_client_snippet.gh</strong>
                  <p className="text-sm text-gray-600 mt-1">Grasshopper server component (required)</p>
                </div>
                <a 
                  href="https://github.com/SerjoschDuering/grasshopper-vibe-editor/releases/latest/download/gh_client_snippet.gh" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  <i className="fas fa-external-link-alt mr-1"></i>
                  Download from GitHub
                </a>
              </div>
            </div>
            <div className="text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded p-3">
              <strong>Setup:</strong> Open this file in Grasshopper and set the server toggle to &quot;True&quot; before using VibeCode.
            </div>
          </div>

          {/* What is VibeCode */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">What is VibeCode?</h2>
            <p className="mb-4">
              VibeCode is a dual-mode interface for working with GHPython components that eliminates the frustration of Grasshopper&apos;s limited code editor. It provides real-time synchronization between a web-based editor and your Grasshopper canvas, making &quot;vibe coding&quot; more efficient with seamless AI integration and intelligent context understanding.
            </p>
            <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
              <strong>→ Generates IronPython / Python 2.7 compatible code ←</strong>
            </div>
          </section>

          {/* Two Modes */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-6">Two Powerful Modes</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                🔧 <span className="ml-2">Coding Mode - AI-Assisted Script Development</span>
              </h3>
              <p className="mb-4">Real-time code editing with intelligent AI assistance that understands your Grasshopper definition context.</p>
              <img 
                src="/docs/coding_ui.jpg" 
                alt="Coding Interface" 
                className="w-full max-w-3xl rounded-lg shadow-md mb-4"
              />
              <div className="relative">
                <img 
                  src="/docs/code_ani.gif" 
                  alt="Coding Animation" 
                  className="w-full max-w-3xl rounded-lg shadow-md"
                />
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                📋 <span className="ml-2">Context Mode - LLM-Ready Documentation Export</span>
              </h3>
              <p className="mb-4">
                Translates your entire Grasshopper definition into LLM-friendly formats (Markdown, JSON, XML) with selectable detail levels and component filtering. Perfect for copying into external LLM tools! The output is sorted by computation order for logical flow understanding.
              </p>
              <p className="mb-4 text-sm text-gray-600">
                <strong>Note:</strong> Cluster content is not parsed or scanned.
              </p>
              <img 
                src="/docs/context_ui.jpg" 
                alt="Context Interface" 
                className="w-full max-w-3xl rounded-lg shadow-md mb-4"
              />
              <div className="relative">
                <img 
                  src="/docs/context_ani.gif" 
                  alt="Context Animation" 
                  className="w-full max-w-3xl rounded-lg shadow-md"
                />
              </div>
            </div>
          </section>

          {/* Key Features */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Key Features</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Real-time synchronization</strong> between the web editor and Grasshopper</li>
              <li><strong>AI-powered code generation</strong> with GPT-5 models (nano, mini, full)</li>
              <li><strong>Context-aware AI</strong> that understands your canvas connections and component relationships</li>
              <li><strong>Add, modify, or remove</strong> input and output parameters visually</li>
              <li><strong>Auto-fetch</strong> selected components from your Grasshopper canvas</li>
              <li><strong>Canvas Context System</strong> provides AI with information about connected components</li>
              <li><strong>Syntax highlighting</strong> and modern code editing features</li>
              <li><strong>Instant deployment</strong> of changes back to Grasshopper</li>
            </ul>
          </section>

          {/* Getting Started */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Getting Started</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Desktop App Setup</h3>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Download and install VibeCode for your OS</li>
                <li>Download <code className="bg-gray-100 px-1 rounded">gh_client_snippet.gh</code> (link above) and open it in Grasshopper</li>
                <li>In Grasshopper, set the server toggle to &quot;True&quot;</li>
                <li>In VibeCode → Config, ensure the Grasshopper server URL is <code className="bg-gray-100 px-1 rounded">http://localhost:9998</code></li>
                <li>Select a single GHPython component in Grasshopper to start editing</li>
              </ol>
            </div>
          </section>

          {/* AI Usage */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Using AI Code Generation</h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Enter your OpenAI API key in the configuration section</li>
              <li>Select your preferred model:
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li><strong>GPT-5 Nano</strong>: Fastest and most cost-effective ($0.05/$0.40 per 1M tokens)</li>
                  <li><strong>GPT-5 Mini</strong>: Balanced performance ($0.25/$2.00 per 1M tokens)</li>
                  <li><strong>GPT-5</strong>: Most capable with full context support ($1.25/$10.00 per 1M tokens)</li>
                </ul>
              </li>
              <li>Type a prompt describing what you want to create</li>
              <li>Toggle "Generate/Update Input/Output Parameters" if you want the AI to handle parameter creation</li>
              <li>Enable "Canvas State" context provider for AI to understand connected components</li>
              <li>Click "Generate Code with AI"</li>
              <li>Review and send changes back to Grasshopper with "Send to GH"</li>
            </ol>
          </section>

          {/* Context System */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Context System</h2>
            <p className="mb-4">The Canvas Context feature provides AI with intelligent information about your Grasshopper definition:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Automatic Detection</strong>: Identifies components connected to your selected component (±1 level)</li>
              <li><strong>Medium Detail</strong>: Component names, types, parameters, and connections</li>
              <li><strong>Full Detail (GPT-5)</strong>: Includes script contents from connected components</li>
              <li><strong>Smart Filtering</strong>: Only relevant components are included to optimize token usage</li>
              <li>This context helps AI generate code that properly integrates with your existing data flow</li>
            </ul>
          </section>

          {/* Requirements */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Requirements</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Rhino 7+ with Grasshopper</li>
              <li>macOS 12+ or Windows 10+</li>
              <li>Internet connection for AI features (OpenAI API key required)</li>
              <li>The GHPython server must be running in your Grasshopper file</li>
            </ul>
          </section>

          {/* Troubleshooting */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Troubleshooting</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Common Issues</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>"Failed to connect"</strong>: Ensure <code className="bg-gray-100 px-1 rounded">gh_client_snippet.gh</code> is running and the toggle is "True"</li>
                  <li><strong>"No component selected"</strong>: Select a single GHPython component in Grasshopper</li>
                  <li><strong>Desktop app shows blank window</strong>: Quit and relaunch</li>
                  <li><strong>macOS "app is damaged/cannot be opened"</strong>: Open System Settings → Privacy & Security → Allow Anyway</li>
                  <li><strong>Windows SmartScreen</strong>: Click "More info" → "Run anyway" to proceed</li>
                  <li><strong>AI not generating</strong>: Verify your OpenAI API key starts with <code className="bg-gray-100 px-1 rounded">sk-</code> in Config</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Security Notes */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Security Notes</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>API keys are stored locally in your browser (localStorage)</li>
              <li>The Grasshopper server only runs locally on your machine</li>
              <li>No code or data is stored on remote servers (only in your browser session)</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  )
}