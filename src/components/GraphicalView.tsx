'use client'

import { useEffect, useRef, useState } from 'react'
import { ProcessedContext, ContextComponent, ContextParam } from '@/lib/context-utils'

interface GraphicalViewProps {
  processedContext: ProcessedContext | null
  selectedComponentGuids: string[]
  extendedSelectedGuids?: string[]
}

export default function GraphicalView({ processedContext, selectedComponentGuids, extendedSelectedGuids = [] }: GraphicalViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  
  // Update canvas dimensions when container resizes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: rect.width,
          height: rect.height
        })
      }
    }
    
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])
  
  // Draw the graph
  useEffect(() => {
    if (!canvasRef.current || !processedContext) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height)
    
    // Get all components and standalone parameters
    const components = processedContext.components
    const standaloneParams = processedContext.params.filter(p => !p.componentGuid)
    
    // Calculate bounds for auto-scaling
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    
    // Find bounds from components
    components.forEach(comp => {
      if (comp.bounds) {
        minX = Math.min(minX, comp.bounds.x || 0)
        minY = Math.min(minY, comp.bounds.y || 0)
        maxX = Math.max(maxX, (comp.bounds.x || 0) + (comp.bounds.width || 100))
        maxY = Math.max(maxY, (comp.bounds.y || 0) + (comp.bounds.height || 50))
      }
    })
    
    // Find bounds from standalone parameters
    standaloneParams.forEach(param => {
      if (param.bounds) {
        minX = Math.min(minX, param.bounds.x || 0)
        minY = Math.min(minY, param.bounds.y || 0)
        maxX = Math.max(maxX, (param.bounds.x || 0) + (param.bounds.width || 80))
        maxY = Math.max(maxY, (param.bounds.y || 0) + (param.bounds.height || 30))
      }
    })
    
    // If no bounds found, use defaults
    if (minX === Infinity) {
      minX = 0
      minY = 0
      maxX = 1000
      maxY = 800
    }
    
    // Calculate scale and offset to fit everything in view with padding
    const padding = 40
    const graphWidth = maxX - minX
    const graphHeight = maxY - minY
    const scaleX = (dimensions.width - 2 * padding) / graphWidth
    const scaleY = (dimensions.height - 2 * padding) / graphHeight
    const scale = Math.min(scaleX, scaleY, 2) // Cap at 2x zoom
    
    const offsetX = padding + (dimensions.width - 2 * padding - graphWidth * scale) / 2
    const offsetY = padding + (dimensions.height - 2 * padding - graphHeight * scale) / 2
    
    // Helper function to transform coordinates
    const transform = (x: number, y: number) => {
      return {
        x: (x - minX) * scale + offsetX,
        // Flip Y so origin matches expected canvas orientation
        y: (maxY - y) * scale + offsetY
      }
    }
    
    // Draw connections first (so they appear behind components)
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])
    
    // Helper to compute a canvas-space rect from GH bounds with flipped Y
    const getCanvasRect = (b: any, defaultW: number, defaultH: number) => {
      const x = b?.x || 0
      const y = b?.y || 0
      const w = b?.width || defaultW
      const h = b?.height || defaultH
      const p1 = transform(x, y)
      const p2 = transform(x + w, y + h)
      const left = Math.min(p1.x, p2.x)
      const right = Math.max(p1.x, p2.x)
      const top = Math.min(p1.y, p2.y)
      const bottom = Math.max(p1.y, p2.y)
      return { x: left, y: top, width: right - left, height: bottom - top }
    }

    processedContext.connections.forEach(conn => {
      // Find source position
      let sourcePos = null
      let targetPos = null
      
      // Check if source is a component output or standalone param
      const sourceParam = processedContext.params.find(p => p.instanceGuid === conn.from)
      if (sourceParam) {
        if (sourceParam.componentGuid) {
          // It's a component parameter
          const sourceComp = processedContext.componentMap[sourceParam.componentGuid]
          if (sourceComp?.bounds) {
            const r = getCanvasRect(sourceComp.bounds, 100, 50)
            sourcePos = { x: r.x + r.width, y: r.y + r.height / 2 }
          }
        } else {
          // It's a standalone parameter
          if (sourceParam.bounds) {
            const r = getCanvasRect(sourceParam.bounds, 80, 30)
            sourcePos = { x: r.x + r.width, y: r.y + r.height / 2 }
          }
        }
      }
      
      // Check if target is a component input or standalone param
      const targetParam = processedContext.params.find(p => p.instanceGuid === conn.to)
      if (targetParam) {
        if (targetParam.componentGuid) {
          // It's a component parameter
          const targetComp = processedContext.componentMap[targetParam.componentGuid]
          if (targetComp?.bounds) {
            const r = getCanvasRect(targetComp.bounds, 100, 50)
            targetPos = { x: r.x, y: r.y + r.height / 2 }
          }
        } else {
          // It's a standalone parameter
          if (targetParam.bounds) {
            const r = getCanvasRect(targetParam.bounds, 80, 30)
            targetPos = { x: r.x, y: r.y + r.height / 2 }
          }
        }
      }
      
      // Draw connection line
      if (sourcePos && targetPos) {
        ctx.beginPath()
        ctx.moveTo(sourcePos.x, sourcePos.y)
        
        // Draw a curved line
        const controlPoint1X = sourcePos.x + (targetPos.x - sourcePos.x) * 0.3
        const controlPoint2X = targetPos.x - (targetPos.x - sourcePos.x) * 0.3
        ctx.bezierCurveTo(
          controlPoint1X, sourcePos.y,
          controlPoint2X, targetPos.y,
          targetPos.x, targetPos.y
        )
        ctx.stroke()
      }
    })
    
    ctx.setLineDash([]) // Reset line dash
    
    // Draw standalone parameters
    standaloneParams.forEach(param => {
      if (!param.bounds) return
      const r = getCanvasRect(param.bounds, 80, 30)
      
      // Check if selected
      const isCoreSelected = selectedComponentGuids.includes(param.instanceGuid)
      const isExtended = !isCoreSelected && extendedSelectedGuids.includes(param.instanceGuid)
      
      // Draw selection halo for clarity
      if (isCoreSelected || isExtended) {
        ctx.save()
        ctx.strokeStyle = isCoreSelected ? 'rgba(37,99,235,0.7)' : 'rgba(59,130,246,0.5)'
        ctx.lineWidth = isCoreSelected ? 6 : 4
        ctx.beginPath()
        const rr = 8
        ctx.moveTo(r.x + rr, r.y)
        ctx.arcTo(r.x + r.width, r.y, r.x + r.width, r.y + r.height, rr)
        ctx.arcTo(r.x + r.width, r.y + r.height, r.x, r.y + r.height, rr)
        ctx.arcTo(r.x, r.y + r.height, r.x, r.y, rr)
        ctx.arcTo(r.x, r.y, r.x + r.width, r.y, rr)
        ctx.closePath()
        ctx.globalAlpha = 0.3
        ctx.stroke()
        ctx.restore()
      }
      
      // Draw parameter box
      ctx.fillStyle = isCoreSelected ? '#fff7ed' : isExtended ? '#fefce8' : '#f3f4f6'
      ctx.strokeStyle = isCoreSelected ? '#ea580c' : isExtended ? '#f59e0b' : '#9ca3af'
      ctx.lineWidth = isCoreSelected ? 2.5 : isExtended ? 2 : 1
      
      // Rounded rectangle
      const radius = 4
      ctx.beginPath()
      ctx.moveTo(r.x + radius, r.y)
      ctx.arcTo(r.x + r.width, r.y, r.x + r.width, r.y + r.height, radius)
      ctx.arcTo(r.x + r.width, r.y + r.height, r.x, r.y + r.height, radius)
      ctx.arcTo(r.x, r.y + r.height, r.x, r.y, radius)
      ctx.arcTo(r.x, r.y, r.x + r.width, r.y, radius)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      
      // Draw text
      ctx.fillStyle = '#374151'
      ctx.font = `${Math.max(10, 12 * scale)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const name = param.nickName || param.name || 'Param'
      
      // Truncate text if too long
      const maxWidth = r.width - 10
      let displayName = name
      if (ctx.measureText(displayName).width > maxWidth) {
        while (ctx.measureText(displayName + '...').width > maxWidth && displayName.length > 0) {
          displayName = displayName.slice(0, -1)
        }
        displayName += '...'
      }
      
      ctx.fillText(displayName, r.x + r.width / 2, r.y + r.height / 2)
    })
    
    // Draw components
    components.forEach(comp => {
      if (!comp.bounds) return
      const r = getCanvasRect(comp.bounds, 100, 50)
      
      // Check if selected
      const isCoreSelected = selectedComponentGuids.includes(comp.instanceGuid)
      const isExtended = !isCoreSelected && extendedSelectedGuids.includes(comp.instanceGuid)
      
      // Determine component color based on type
      let fillColor = '#ffffff'
      let strokeColor = '#6b7280'
      
      if (comp.isScript) {
        fillColor = isCoreSelected ? '#dce7fc' : isExtended ? '#eaf2ff' : '#e8f0fe'
        strokeColor = isCoreSelected ? '#2563eb' : isExtended ? '#60a5fa' : '#3b82f6'
      } else if (comp.category?.toLowerCase().includes('params')) {
        fillColor = isCoreSelected ? '#f0fdf4' : isExtended ? '#f4fce8' : '#f7fee7'
        strokeColor = isCoreSelected ? '#16a34a' : isExtended ? '#84cc16' : '#a3e635'
      } else if (comp.category?.toLowerCase().includes('maths')) {
        fillColor = isCoreSelected ? '#fef3c7' : isExtended ? '#fff3cd' : '#fef9c3'
        strokeColor = isCoreSelected ? '#f59e0b' : isExtended ? '#fbbf24' : '#facc15'
      } else {
        fillColor = isCoreSelected ? '#e0e7ff' : isExtended ? '#e8ecff' : '#ede9fe'
        strokeColor = isCoreSelected ? '#6366f1' : isExtended ? '#93c5fd' : '#8b5cf6'
      }
      
      // Draw selection halo for clarity
      if (isCoreSelected || isExtended) {
        ctx.save()
        ctx.strokeStyle = isCoreSelected ? 'rgba(37,99,235,0.7)' : 'rgba(59,130,246,0.5)'
        ctx.lineWidth = isCoreSelected ? 8 : 5
        ctx.beginPath()
        const rr = 10
        ctx.moveTo(r.x + rr, r.y)
        ctx.arcTo(r.x + r.width, r.y, r.x + r.width, r.y + r.height, rr)
        ctx.arcTo(r.x + r.width, r.y + r.height, r.x, r.y + r.height, rr)
        ctx.arcTo(r.x, r.y + r.height, r.x, r.y, rr)
        ctx.arcTo(r.x, r.y, r.x + r.width, r.y, rr)
        ctx.closePath()
        ctx.globalAlpha = 0.25
        ctx.stroke()
        ctx.restore()
      }

      // Draw component box
      ctx.fillStyle = fillColor
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = isCoreSelected ? 3 : isExtended ? 2 : 1.5
      
      // Rounded rectangle
      const radius = 6
      ctx.beginPath()
      ctx.moveTo(r.x + radius, r.y)
      ctx.arcTo(r.x + r.width, r.y, r.x + r.width, r.y + r.height, radius)
      ctx.arcTo(r.x + r.width, r.y + r.height, r.x, r.y + r.height, radius)
      ctx.arcTo(r.x, r.y + r.height, r.x, r.y, radius)
      ctx.arcTo(r.x, r.y, r.x + r.width, r.y, radius)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      
      // Draw component name
      ctx.fillStyle = '#111827'
      ctx.font = `bold ${Math.max(11, 13 * scale)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const name = comp.nickName || comp.name || 'Component'
      
      // Truncate text if too long
      const maxWidth = r.width - 10
      let displayName = name
      if (ctx.measureText(displayName).width > maxWidth) {
        while (ctx.measureText(displayName + '...').width > maxWidth && displayName.length > 0) {
          displayName = displayName.slice(0, -1)
        }
        displayName += '...'
      }
      
      ctx.fillText(displayName, r.x + r.width / 2, r.y + r.height / 2)
      
      // Draw error/warning indicators
      if (comp.runtime?.errors?.length) {
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(r.x + r.width - 8, r.y + 8, 4, 0, Math.PI * 2)
        ctx.fill()
      } else if (comp.runtime?.warnings?.length) {
        ctx.fillStyle = '#f59e0b'
        ctx.beginPath()
        ctx.arc(r.x + r.width - 8, r.y + 8, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    })
    
    // Draw legend
    ctx.fillStyle = '#6b7280'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    
    const legendY = dimensions.height - 30
    ctx.fillText(`Components: ${components.length}`, 10, legendY)
    ctx.fillText(`Parameters: ${standaloneParams.length}`, 120, legendY)
    ctx.fillText(`Selected: ${selectedComponentGuids.length}`, 230, legendY)
    if (extendedSelectedGuids.length > 0) {
      ctx.fillText(`Extended: ${extendedSelectedGuids.length}`, 330, legendY)
    }
    
    // Scale indicator
    ctx.textAlign = 'right'
    ctx.fillText(`Scale: ${(scale * 100).toFixed(0)}%`, dimensions.width - 10, legendY)
    
  }, [processedContext, selectedComponentGuids, extendedSelectedGuids, dimensions])
  
  return (
    <div ref={containerRef} className="h-full w-full bg-gray-50 rounded-lg border border-gray-200 relative">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
      />
      {!processedContext && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            <p>No context data available</p>
            <p className="text-sm mt-1">Get context to see the graph</p>
          </div>
        </div>
      )}
    </div>
  )
}