'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/app-store'

export default function StatusBar() {
  const status = useAppStore((state) => state.status)
  const runtimeIssues = useAppStore((state) => state.runtimeIssues)
  const clearStatus = useAppStore((state) => state.clearStatus)

  useEffect(() => {
    if (status && status.duration && status.duration > 0) {
      const timer = setTimeout(() => {
        clearStatus()
      }, status.duration)
      return () => clearTimeout(timer)
    }
  }, [status, clearStatus])

  if (!status && (!runtimeIssues || ((runtimeIssues.errors?.length || 0) === 0 && (runtimeIssues.warnings?.length || 0) === 0))) return null

  const getStatusClass = () => {
    const baseClass = 'status-message alert mt-3 animate-fadeIn'
    switch (status?.type) {
      case 'success':
        return `${baseClass} alert-success`
      case 'error':
        return `${baseClass} alert-danger`
      case 'warning':
        return `${baseClass} alert-warning`
      case 'info':
      default:
        return `${baseClass} alert-info`
    }
  }

  const getIcon = () => {
    switch (status?.type) {
      case 'success':
        return 'fa-check-circle'
      case 'error':
        return 'fa-exclamation-circle'
      case 'warning':
        return 'fa-exclamation-triangle'
      case 'info':
      default:
        return 'fa-info-circle'
    }
  }

  return (
    <div className="space-y-2">
      {status && (
        <div className={getStatusClass()} role="alert">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <i className={`fas ${getIcon()} mr-2`}></i>
              <span>{status.message}</span>
            </div>
            <button
              onClick={clearStatus}
              className="ml-4 text-current opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Close"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {runtimeIssues && (runtimeIssues.errors?.length > 0 || runtimeIssues.warnings?.length > 0 || (runtimeIssues.remarks?.length || 0) > 0) && (
        <div className="alert alert-danger">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold mb-1">Component runtime issues</div>
              {runtimeIssues.errors?.length > 0 && (
                <div className="text-sm text-red-700">
                  <div className="font-medium">Errors</div>
                  <ul className="list-disc pl-5">
                    {runtimeIssues.errors.slice(0, 3).map((e, idx) => (
                      <li key={idx} className="truncate" title={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {runtimeIssues.warnings?.length > 0 && (
                <div className="text-sm text-yellow-800 mt-2">
                  <div className="font-medium">Warnings</div>
                  <ul className="list-disc pl-5">
                    {runtimeIssues.warnings.slice(0, 3).map((w, idx) => (
                      <li key={idx} className="truncate" title={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(runtimeIssues.remarks?.length || 0) > 0 && (
                <div className="text-sm text-gray-700 mt-2">
                  <div className="font-medium">Remarks</div>
                  <ul className="list-disc pl-5">
                    {runtimeIssues.remarks?.slice(0, 3).map((r, idx) => (
                      <li key={idx} className="truncate" title={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="ml-4 flex flex-col gap-2">
              <button
                className="btn btn-sm btn-secondary"
                onClick={async () => {
                  // Trigger an AI fix flow using current prompt + error context
                  const s = useAppStore.getState()
                  const prompt = `Fix the runtime errors for the selected component. Errors:\n` + (s.runtimeIssues?.errors || []).join('\n')
                  s.setAiPrompt(prompt)
                }}
              >
                Ask AI to fix
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}