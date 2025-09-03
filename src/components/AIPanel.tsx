'use client'

import { useAppStore } from '@/store/app-store'
import { useState, useEffect, useCallback } from 'react'
import { getEnabledContextProviders, setContextProviderEnabled, MODEL_CONFIG, type AIContextProvider, type ModelId } from '@/lib/openai-api'
import { processImageForAI, isValidImageFile, formatFileSize } from '@/lib/image-utils'

export default function AIPanel() {
  const aiPrompt = useAppStore(state => state.aiPrompt)
  const setAiPrompt = useAppStore(state => state.setAiPrompt)
  const aiGenerateParams = useAppStore(state => state.aiGenerateParams)
  const setAiGenerateParams = useAppStore(state => state.setAiGenerateParams)
  const aiModel = useAppStore(state => state.aiModel)
  const setAiModel = useAppStore(state => state.setAiModel)
  const aiImage = useAppStore(state => state.aiImage)
  const setAiImage = useAppStore(state => state.setAiImage)
  const generateWithAI = useAppStore(state => state.generateWithAI)
  const loading = useAppStore(state => state.loading)
  const apiKey = useAppStore(state => state.apiKey)
  const aiExplanation = useAppStore(state => state.aiExplanation)
  
  const [showSettings, setShowSettings] = useState(false)
  const [contextProviders, setContextProviders] = useState<AIContextProvider[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [imageProcessing, setImageProcessing] = useState(false)
  
  // Initialize context providers after mount
  useEffect(() => {
    setContextProviders(getEnabledContextProviders())
  }, [])

  // (Speech bubble handled in page header; none here)

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

    await generateWithAI()
  }

  const toggleProvider = (providerId: string) => {
    const provider = contextProviders.find(p => p.id === providerId)
    if (provider) {
      setContextProviderEnabled(providerId, !provider.enabled)
      setContextProviders(getEnabledContextProviders())
    }
  }

  // Image upload handlers
  const handleImageUpload = useCallback(async (file: File) => {
    if (!isValidImageFile(file)) {
      useAppStore.getState().showStatus({
        message: 'Please select a valid image file (max 10MB)',
        type: 'error',
        duration: 3000
      })
      return
    }

    setImageProcessing(true)
    try {
      const processedImage = await processImageForAI(file)
      setAiImage(processedImage)
      useAppStore.getState().showStatus({
        message: 'Image uploaded successfully',
        type: 'success',
        duration: 2000
      })
    } catch (error) {
      useAppStore.getState().showStatus({
        message: 'Failed to process image: ' + (error as Error).message,
        type: 'error',
        duration: 3000
      })
    } finally {
      setImageProcessing(false)
    }
  }, [setAiImage])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleImageUpload(files[0])
    }
  }, [handleImageUpload])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleImageUpload(files[0])
    }
    // Clear the input so the same file can be selected again
    e.target.value = ''
  }, [handleImageUpload])

  const removeImage = useCallback(() => {
    setAiImage(null)
  }, [setAiImage])

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

      {/* Model selection moved to header pill */}

      {/* Prompt Input with Image Upload */}
      <div className="mb-3">
        <label htmlFor="ai-prompt" className="block text-sm font-medium mb-1">
          Prompt
        </label>
        <div className="flex gap-2">
          {/* Prompt textarea */}
          <textarea
            id="ai-prompt"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g., 'Create a script that takes a list of points and outputs their Z values.'"
            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            rows={4}
          />
          
          {/* Image upload area */}
          <div className="w-12 flex flex-col">
            {aiImage ? (
              // Show uploaded image
              <div className="relative border border-gray-300 rounded bg-gray-50 h-full min-h-[4rem]">
                <img 
                  src={aiImage} 
                  alt="Reference" 
                  className="w-full h-full object-cover rounded"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors flex items-center justify-center"
                  title="Remove image"
                >
                  ×
                </button>
              </div>
            ) : (
              // Show upload area
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  h-full min-h-[4rem] border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer transition-colors
                  ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                  ${imageProcessing ? 'opacity-50 pointer-events-none' : ''}
                `}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="image-upload"
                  disabled={imageProcessing}
                />
                <label htmlFor="image-upload" className="cursor-pointer h-full w-full flex flex-col items-center justify-center p-1">
                  {imageProcessing ? (
                    <i className="fas fa-spinner fa-spin text-gray-500 text-xs"></i>
                  ) : (
                    <div className="text-center">
                      <i className="fas fa-image text-gray-400 text-sm mb-1"></i>
                      <div className="text-xs text-gray-500 leading-tight">Drop or click</div>
                    </div>
                  )}
                </label>
              </div>
            )}
          </div>
        </div>
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

      {/* (Bubble rendered above; no inline version here) */}
    </div>
  )
}