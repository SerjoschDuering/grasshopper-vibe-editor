'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { ProcessedContext, generateMarkdownTemplate, generateJSONTemplate, generateXMLTemplate } from '@/lib/context-utils'
import GraphicalView from './GraphicalView'

interface Props {
  processedContext: ProcessedContext | null
  filteredComponents: any[]
  selectedComponentGuids?: string[]
  extendedSelectedGuids?: string[]
}

export default function ContextViewer({ processedContext, filteredComponents, selectedComponentGuids: selectedGuidsProp, extendedSelectedGuids = [] }: Props) {
  const [format, setFormat] = useState<'markdown' | 'json' | 'xml'>('markdown')
  const contextDetailLevel = useAppStore(state => state.contextDetailLevel)
  const showStatus = useAppStore(state => state.showStatus)
  const selectedComponentGuidsFromStore = useAppStore(state => state.selectedComponentGuids)
  const setContextDetailLevel = useAppStore(state => state.setContextDetailLevel)
  const selectedComponentGuids = selectedGuidsProp || selectedComponentGuidsFromStore
  
  // Generate the content based on selected format
  const generateContent = () => {
    if (!processedContext) return 'No context data available. Click "Get Context" to load.'
    
    // Filter the processed context to only include filtered components
    const filteredContext = {
      ...processedContext,
      components: filteredComponents
    }
    
    switch (format) {
      case 'markdown':
        return generateMarkdownTemplate(filteredContext, contextDetailLevel)
      case 'json':
        return generateJSONTemplate(filteredContext, contextDetailLevel)
      case 'xml':
        return generateXMLTemplate(filteredContext, contextDetailLevel)
      default:
        return ''
    }
  }
  
  const content = generateContent()
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content)
      showStatus({ message: 'Copied to clipboard!', type: 'success', duration: 2000 })
    } catch (err) {
      showStatus({ message: 'Failed to copy to clipboard', type: 'error', duration: 3000 })
    }
  }
  
  const handlePromptTemplate = () => {
    // Copy content to clipboard with a message about using it as a prompt
    navigator.clipboard.writeText(content).then(() => {
      showStatus({ message: 'Context copied! You can now paste it into your AI prompt.', type: 'success', duration: 3000 })
    }).catch(() => {
      showStatus({ message: 'Failed to copy context', type: 'error', duration: 3000 })
    })
  }
  
  return (
    <div className="card">
      {/* Header with controls */}
      <div className="card-header bg-white p-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Format group */}
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 bg-white shadow-sm">
              <span className="text-sm font-medium text-gray-700">Format</span>
              <div className="btn-group">
                <button onClick={() => setFormat('markdown')} className={`btn btn-sm ${format === 'markdown' ? 'btn-primary' : 'btn-secondary'}`}>Markdown</button>
                <button onClick={() => setFormat('json')} className={`btn btn-sm ${format === 'json' ? 'btn-primary' : 'btn-secondary'}`}>JSON</button>
                <button onClick={() => setFormat('xml')} className={`btn btn-sm ${format === 'xml' ? 'btn-primary' : 'btn-secondary'}`}>XML</button>
              </div>
            </div>
            {/* Detail group */}
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 bg-white shadow-sm">
              <span className="text-sm font-medium text-gray-700">Detail</span>
              <div className="btn-group">
                <button onClick={() => setContextDetailLevel('simple')} className={`btn btn-sm ${contextDetailLevel === 'simple' ? 'btn-primary' : 'btn-secondary'}`}>Simple</button>
                <button onClick={() => setContextDetailLevel('standard')} className={`btn btn-sm ${contextDetailLevel === 'standard' ? 'btn-primary' : 'btn-secondary'}`}>Standard</button>
                <button onClick={() => setContextDetailLevel('detailed')} className={`btn btn-sm ${contextDetailLevel === 'detailed' ? 'btn-primary' : 'btn-secondary'}`}>Detailed</button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="btn btn-sm"
              disabled={!processedContext}
            >
              <i className="fas fa-copy mr-1"></i>
              Copy
            </button>
            <button
              onClick={handlePromptTemplate}
              className="btn btn-sm"
              disabled={!processedContext}
            >
              <i className="fas fa-file-alt mr-1"></i>
              Prompt Template
            </button>
          </div>
        </div>
      </div>
      
      {/* Content + Graphical View Split */}
      <div className="p-4">
        <div className="flex gap-4">
          {/* Text content (1/3) */}
          <div className="w-1/3">
            <div 
              className="bg-gray-50 border rounded p-4 font-mono text-xs overflow-auto"
              style={{ 
                maxHeight: '1000px',
                minHeight: '1000px',
                height: '1000px'
              }}
            >
              <pre className="whitespace-pre-wrap">{content}</pre>
            </div>
          </div>
          {/* Graphical view (2/3) */}
          <div className="w-2/3">
            <div className="border rounded bg-white" style={{ height: '1000px' }}>
              <GraphicalView 
                processedContext={processedContext}
                selectedComponentGuids={selectedComponentGuids}
                extendedSelectedGuids={extendedSelectedGuids}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}