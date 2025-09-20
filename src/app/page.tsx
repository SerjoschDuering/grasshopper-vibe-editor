'use client'

import CodeEditor from '@/components/CodeEditor'
import InputParameters from '@/components/InputParameters'
import OutputParameters from '@/components/OutputParameters'
import ConfigPanel from '@/components/ConfigPanel'
import AIPanel from '@/components/AIPanel'
import ModelSelector from '@/components/ModelSelector'
import ContextPanel from '@/components/ContextPanel'
import DocsPanel from '@/components/DocsPanel'
import StatusBar from '@/components/StatusBar'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useAppStore } from '@/store/app-store'
import { useClientInit } from '@/lib/use-client-init'
import { useState, useEffect } from 'react'

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
  const loading = useAppStore((state) => state.loading)
  const aiExplanation = useAppStore((state) => state.aiExplanation)
  const aiPhase = useAppStore((state) => state.aiPhase)
  const runtimeIssues = useAppStore((state) => state.runtimeIssues)
  const setAiPrompt = useAppStore((state) => state.setAiPrompt)
  const generateWithAI = useAppStore((state) => state.generateWithAI)
  const selectedComponentId = useAppStore((state) => state.selectedComponentId)
  const chatHistory = useAppStore((state) => 
    selectedComponentId ? state.getChatHistory(selectedComponentId) : []
  )
  const selectedRec = useAppStore((s) => s.selectedComponentId ? s.componentsById[s.selectedComponentId] : undefined)
  const [showErrorPanel, setShowErrorPanel] = useState(false)
  const hasIssues = !!runtimeIssues && (((runtimeIssues.errors || []).length + (runtimeIssues.warnings || []).length + (runtimeIssues.remarks || []).length) > 0)

  // Show bubble while thinking and for 20s after completion
  const [showAIBubble, setShowAIBubble] = useState(false)
  useEffect(() => {
    if (loading.ai) {
      setShowAIBubble(true)
      return
    }
    if (aiExplanation) {
      setShowAIBubble(true)
      const t = setTimeout(() => setShowAIBubble(false), 20000)
      return () => clearTimeout(t)
    }
    setShowAIBubble(false)
  }, [loading.ai, aiExplanation])

  return (
    <div className="space-y-4">
      {/* Status Bar - Disabled to prevent UI jumping */}
      {/* <StatusBar /> */}
      
      {/* Tab Content */}
      {activeTab === 'coding' ? (
        <>
          {/* Top Configuration Row */}
          <div className="card p-3 mb-4" style={{ backgroundColor: '#f8f9fa' }}>
            <ErrorBoundary>
              <ConfigPanel />
            </ErrorBoundary>
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
              <ErrorBoundary>
                <InputParameters />
              </ErrorBoundary>
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
                <div className="flex items-center gap-2">
                  {hasIssues && (
                    <button
                      className={`px-3 py-1.5 rounded-full text-white text-xs font-semibold shadow-sm ${ (runtimeIssues?.errors?.length || 0) > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'}`}
                      onClick={() => setShowErrorPanel((v) => !v)}
                      title={(runtimeIssues?.errors?.length || 0) > 0 ? 'Show component errors' : 'Show component warnings/remarks'}
                    >
                      {(runtimeIssues?.errors?.length || 0) > 0 ? 'Error' : 'Issues'}
                    </button>
                  )}
                  <EditorStatusActions />
                </div>
              </div>
            </div>
            <div className={`p-0 editor-aurora ${loading.ai ? 'generating' : aiPhase === 'done' ? 'success' : aiPhase === 'error' ? 'error' : ''}`}>
              <div className="editor-surface relative">
                <ErrorBoundary>
                  <CodeEditor
                    value={code}
                    onChange={setCode}
                    height="50vh"
                  />
                </ErrorBoundary>

                {/* Runtime error panel (expanded on demand) */}
                {hasIssues && showErrorPanel && (
                  <div className="absolute right-6 top-6 z-10 w-[420px] max-w-full">
                    <div className="rounded-xl shadow-2xl border border-gray-300 bg-white overflow-hidden">
                      <div className={`px-4 py-2 text-white flex items-center justify-between ${(runtimeIssues?.errors?.length || 0) > 0 ? 'bg-red-500' : 'bg-yellow-500'}`}>
                        <div className="font-semibold">{(runtimeIssues?.errors?.length || 0) > 0 ? 'Component Error' : 'Component Issues'}</div>
                        <button className="opacity-80 hover:opacity-100" onClick={() => setShowErrorPanel(false)} aria-label="Close">
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                      <div className="p-3">
                        <div className="text-xs text-gray-600 mb-2">Details</div>
                        <div className="border rounded bg-gray-50 p-2" style={{ maxHeight: 260, overflowY: 'auto' }}>
                          <pre className="whitespace-pre-wrap text-sm text-gray-900">
{[...(runtimeIssues.errors || []), ...(runtimeIssues.warnings || []), ...(runtimeIssues.remarks || [])].join('\n')}
                          </pre>
                        </div>
                      </div>
                      <div className="px-3 pb-3 flex items-center gap-2">
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={async () => {
                            const msgs = [
                              ...(runtimeIssues.errors || []),
                              ...(runtimeIssues.warnings || []),
                              ...(runtimeIssues.remarks || [])
                            ]
                            const prompt = [
                              'Fix the following runtime errors in the Grasshopper component:',
                              '',
                              msgs.slice(0, 20).map((m, i) => `${i + 1}. ${m}`).join('\n')
                            ].join('\n')
                            setAiPrompt(prompt)
                            await generateWithAI()
                          }}
                        >
                          Fix with AI
                        </button>
                        <button className="btn btn-sm" onClick={() => setShowErrorPanel(false)}>Close</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header bg-white p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center text-lg font-semibold mb-0">
                  <span className="relative inline-flex items-center">
                    <i className="fas fa-robot text-blue-600 mr-2"></i>
                    {showAIBubble && (
                      <div className="absolute left-0 -top-2" style={{ transform: 'translateY(-100%)' }}>
                        <div className="relative">
                          <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-300 rounded text-xs text-indigo-800 shadow whitespace-normal break-words inline-block" style={{ width: '200px' }}>
                            {(loading.ai ? 'Thinking...' : (aiExplanation || 'Code generated successfully!')).replace(/\s+/g, ' ').trim()}
                          </div>
                          <div className="absolute left-4 -bottom-1 w-3 h-3 bg-indigo-50 border-l border-b border-indigo-300 rotate-45"></div>
                        </div>
                      </div>
                    )}
                  </span>
                  AI Assistant
                  <ModelSelector />
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
              <ErrorBoundary>
                <AIPanel />
              </ErrorBoundary>
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
              <ErrorBoundary>
                <OutputParameters />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </div>
        </>
      ) : activeTab === 'context' ? (
        /* Context Tab */
        <ErrorBoundary>
          <ContextPanel />
        </ErrorBoundary>
      ) : (
        /* Docs Tab */
        <ErrorBoundary>
          <DocsPanel />
        </ErrorBoundary>
      )}
    </div>
  )
}