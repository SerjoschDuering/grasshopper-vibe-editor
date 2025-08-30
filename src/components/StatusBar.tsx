'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/app-store'

export default function StatusBar() {
  const status = useAppStore((state) => state.status)
  const clearStatus = useAppStore((state) => state.clearStatus)

  useEffect(() => {
    if (status && status.duration && status.duration > 0) {
      const timer = setTimeout(() => {
        clearStatus()
      }, status.duration)
      return () => clearTimeout(timer)
    }
  }, [status, clearStatus])

  if (!status) return null

  const getStatusClass = () => {
    const baseClass = 'status-message alert mt-3 animate-fadeIn'
    switch (status.type) {
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
    switch (status.type) {
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
  )
}