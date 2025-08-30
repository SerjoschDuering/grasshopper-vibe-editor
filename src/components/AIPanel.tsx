'use client'

import { useAppStore } from '@/store/app-store'
import { useState, useEffect } from 'react'
import { getEnabledContextProviders, setContextProviderEnabled } from '@/lib/openai-api'

export default function AIPanel() {
  const aiPrompt = useAppStore(state => state.aiPrompt)
  const setAiPrompt = useAppStore(state => state.setAiPrompt)
  const aiGenerateParams = useAppStore(state => state.aiGenerateParams)
  const setAiGenerateParams = useAppStore(state => state.setAiGenerateParams)
  const generateWithAI = useAppStore(state => state.generateWithAI)
  const loading = useAppStore(state => state.loading)
  const apiKey = useAppStore(state => state.apiKey)
  
  const [showSettings, setShowSettings] = useState(false)
  const [contextProviders, setContextProviders] = useState(() => [])
  const [aiSummary, setAiSummary] = useState('')
  const [showSpeechBubble, setShowSpeechBubble] = useState(false)
  
  // Initialize context providers after mount
  useEffect(() => {
    setContextProviders(getEnabledContextProviders())
  }, [])

  // Show speech bubble when AI completes
  useEffect(() => {
    if (aiSummary && !loading.ai) {
      setShowSpeechBubble(true)
      const timer = setTimeout(() => {
        setShowSpeechBubble(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [aiSummary, loading.ai])

  const handleGenerateAI = async () => {
    if (!apiKey) {
      useAppStore.getState().showStatus({
        message: 'Please enter an OpenAI API key',
        type: 'error',
        duration: 3000
      })
      return
    }

    if (!aiPrompt || aiPrompt.trim().length < 10) {
      useAppStore.getState().showStatus({
        message: 'Please enter a prompt (at least 10 characters)',
        type: 'error',
        duration: 3000
      })
      return
    }

    setAiSummary('Thinking...')
    await generateWithAI()
    setAiSummary('Code generated successfully!')
  }

  const toggleProvider = (providerId: string) => {
    const provider = contextProviders.find(p => p.id === providerId)
    if (provider) {
      setContextProviderEnabled(providerId, !provider.enabled)
      setContextProviders(getEnabledContextProviders())
    }
  }

  return (
    <div className="ai-panel">

      {/* Context Settings (collapsible) */}
      {showSettings && (
        <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200">
          <h4 className="text-xs font-medium mb-2 text-gray-700">Context Providers</h4>
          <div className="space-y-1">
            {contextProviders.map(provider => (
              <label key={provider.id} className="flex items-center text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={provider.enabled}
                  onChange={() => toggleProvider(provider.id)}
                  className="mr-1.5"
                />
                <span className="text-gray-600">{provider.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Input */}
      <div className="mb-3">
        <label htmlFor="ai-prompt" className="block text-sm font-medium mb-1">
          Prompt
        </label>
        <textarea
          id="ai-prompt"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="e.g., 'Create a script that takes a list of points and outputs their Z values.'"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          rows={4}
        />
      </div>

      {/* Generate Parameters Option */}
      <div className="mb-3 flex items-center justify-between">
        <label className="flex items-center text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={aiGenerateParams}
            onChange={(e) => setAiGenerateParams(e.target.checked)}
            className="mr-2"
          />
          <span className="text-gray-700">Generate/Update Input/Output Parameters</span>
        </label>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
          title="AI Context Settings"
        >
          <i className="fas fa-cog text-xs"></i>
        </button>
      </div>

      {/* Action Button */}
      <button
        onClick={handleGenerateAI}
        disabled={loading.ai || !apiKey || !aiPrompt}
        className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm font-medium"
      >
        {loading.ai ? (
          <>
            <i className="fas fa-spinner fa-spin text-sm"></i>
            <span>Generating...</span>
          </>
        ) : (
          <>
            <i className="fas fa-magic text-sm"></i>
            <span>Generate with AI</span>
          </>
        )}
      </button>

      {/* AI Speech Bubble */}
      {showSpeechBubble && (
        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
          <i className="fas fa-robot mr-1 text-xs"></i>
          {aiSummary}
        </div>
      )}
    </div>
  )
}