'use client'

import CodeEditor from '@/components/CodeEditor'
import InputParameters from '@/components/InputParameters'
import OutputParameters from '@/components/OutputParameters'
import ConfigPanel from '@/components/ConfigPanel'
import AIPanel from '@/components/AIPanel'
import TabNavigation from '@/components/TabNavigation'
import ContextPanel from '@/components/ContextPanel'
import { useAppStore } from '@/store/app-store'
import { useClientInit } from '@/lib/use-client-init'

function EditorStatusActions() {
  const selectedId = useAppStore(s => s.selectedComponentId)
  const rec = useAppStore(s => selectedId ? s.componentsById[selectedId] : undefined)
  const loading = useAppStore(s => s.loading)
  const discard = useAppStore(s => s.discardDraft)
  const send = useAppStore(s => s.sendToGrasshopper)
  const revert = useAppStore(s => s.revertToGrasshopperVersion)

  const dirty = !!rec?.draft?.dirty
  const outdated = !!rec?.draft?.isBaseOutdated
  const conflict = dirty && outdated
  const onlyDirty = dirty && !outdated
  const onlyOutdated = !dirty && outdated

  return (
    <div className="flex items-center gap-2">
      {conflict ? (
        <>
          <span
            className="text-xs px-2 py-1 rounded bg-red-100 text-red-800 border border-red-300"
            title="Both changed: your web edits and the GH component changed. Choose which version to keep."
          >
            Conflict: both changed
          </span>
          <button
            onClick={revert}
            className="btn btn-warning btn-sm"
            title="Fetch latest Grasshopper component and discard local edits"
          >
            Keep GH version
          </button>
          <button
            onClick={send}
            disabled={loading.send}
            className="btn btn-success btn-sm"
            title="Overwrite Grasshopper with your current web editor version"
          >
            {loading.send ? 'Overwriting…' : 'Overwrite with web version'}
          </button>
        </>
      ) : onlyOutdated ? (
        <>
          <span
            className="text-xs px-2 py-1 rounded bg-red-100 text-red-800 border border-red-300"
            title="The Grasshopper component changed since you started editing."
          >
            Out of sync
          </span>
          <button
            onClick={revert}
            className="btn btn-warning btn-sm"
            title="Fetch latest Grasshopper component and discard local edits"
          >
            Keep GH version
          </button>
          <button
            onClick={send}
            disabled={loading.send}
            className="btn btn-success btn-sm"
            title="Overwrite Grasshopper with your current web editor version"
          >
            {loading.send ? 'Overwriting…' : 'Overwrite with web version'}
          </button>
        </>
      ) : onlyDirty ? (
        <>
          <span
            className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800 border border-yellow-300"
            title="You have uncommitted changes in the web editor"
          >
            Uncommitted changes
          </span>
          <button
            onClick={send}
            disabled={loading.send}
            className="btn btn-success btn-sm"
            title="Send your current changes to Grasshopper"
          >
            {loading.send ? 'Updating…' : 'Update component'}
          </button>
          <button
            onClick={() => selectedId && discard(selectedId)}
            className="btn btn-sm"
            title="Discard local changes and revert to Grasshopper version"
          >
            Discard
          </button>
        </>
      ) : null}
    </div>
  )
}

export default function Home() {
  // Initialize client-side state from localStorage
  useClientInit()
  
  // Store state
  const code = useAppStore((state) => state.code)
  const setCode = useAppStore((state) => state.setCode)
  const apiKey = useAppStore((state) => state.apiKey)
  const setApiKey = useAppStore((state) => state.setApiKey)
  const activeTab = useAppStore((state) => state.activeTab)

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <TabNavigation />
      
      {/* Tab Content */}
      {activeTab === 'coding' ? (
        <>
          {/* Top Configuration Row */}
          <div className="card p-3 mb-4" style={{ backgroundColor: '#f8f9fa' }}>
            <ConfigPanel />
          </div>

          {/* Three-Column Layout */}
          <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Column 1: Inputs */}
        <div className="lg:col-span-3">
          <div className="card flex flex-col" style={{ height: 'calc(50vh + 400px)', maxHeight: '80vh' }}>
            <div className="card-header bg-white p-4 border-b flex-shrink-0">
              <h3 className="flex items-center text-lg font-semibold mb-0">
                <i className="fas fa-arrow-right text-blue-600 mr-2"></i>
                Input Parameters
                {useAppStore.getState().inputs.length > 0 && (
                  <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                    {useAppStore.getState().inputs.length}
                  </span>
                )}
              </h3>
            </div>
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              <InputParameters />
            </div>
          </div>
        </div>

        {/* Column 2: Code Editor & AI */}
        <div className="lg:col-span-6">
          <div className="card mb-6">
            <div className="card-header bg-white p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center text-lg font-semibold mb-0">
                  <i className="fas fa-code text-blue-600 mr-2"></i>
                  Code Editor
                </h3>
                <EditorStatusActions />
              </div>
            </div>
            <div className="p-0">
              <CodeEditor
                value={code}
                onChange={setCode}
                height="50vh"
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header bg-white p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center text-lg font-semibold mb-0">
                  <i className="fas fa-robot text-blue-600 mr-2"></i>
                  AI Assistant
                </h3>
                <div className="flex items-center gap-2">
                  <label htmlFor="api-key-header" className="text-xs text-gray-600">
                    API Key:
                  </label>
                  <input
                    id="api-key-header"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-32 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-4">
              <AIPanel />
            </div>
          </div>
        </div>

        {/* Column 3: Outputs */}
        <div className="lg:col-span-3">
          <div className="card flex flex-col" style={{ height: 'calc(50vh + 400px)', maxHeight: '80vh' }}>
            <div className="card-header bg-white p-4 border-b flex-shrink-0">
              <h3 className="flex items-center text-lg font-semibold mb-0">
                <i className="fas fa-arrow-left text-blue-600 mr-2"></i>
                Output Parameters
                {useAppStore.getState().outputs.length > 0 && (
                  <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                    {useAppStore.getState().outputs.length}
                  </span>
                )}
              </h3>
            </div>
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              <OutputParameters />
            </div>
          </div>
        </div>
      </div>
        </>
      ) : (
        /* Context Tab */
        <ContextPanel />
      )}
    </div>
  )
}