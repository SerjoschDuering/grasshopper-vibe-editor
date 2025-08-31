'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { MODEL_CONFIG, type ModelId } from '@/lib/openai-api'

export default function ModelSelector() {
  const aiModel = useAppStore(s => s.aiModel)
  const setAiModel = useAppStore(s => s.setAiModel)

  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const current = MODEL_CONFIG[aiModel]

  return (
    <div ref={containerRef} className="relative ml-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-indigo-600 text-white hover:bg-indigo-700"
        title="Select AI model"
      >
        <span>{current.name}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
          <ul className="py-1 text-sm">
            {Object.entries(MODEL_CONFIG).map(([id, cfg]) => (
              <li key={id}>
                <button
                  onClick={() => {
                    setAiModel(id as ModelId)
                    setOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                    aiModel === (id as ModelId) ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'
                  }`}
                >
                  <span>{cfg.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}


