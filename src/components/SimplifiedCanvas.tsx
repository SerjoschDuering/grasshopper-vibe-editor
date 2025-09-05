'use client'

import React from 'react'
import { ProcessedContext } from '@/lib/context-utils'

interface SimplifiedCanvasProps {
  processedContext: ProcessedContext
  selectedGuids?: string[]
  extendedGuids?: string[]
  scale?: number
}

export default function SimplifiedCanvas({ 
  processedContext, 
  selectedGuids = [], 
  extendedGuids = [],
  scale = 0.9 
}: SimplifiedCanvasProps) {
  if (!processedContext || !processedContext.components) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <span className="text-sm">No components to display</span>
      </div>
    )
  }

  const selectedSet = new Set(selectedGuids)
  const extendedSet = new Set(extendedGuids)
  
  // Create component map for quick lookup
  const componentMap = processedContext.componentMap || {}
  
  // Get components array - filter to only those that have bounds
  const componentsWithBounds = processedContext.components.filter((comp: any) => comp.bounds)
  
  // Get standalone parameters with bounds
  const standaloneParams = (processedContext.params || []).filter((p: any) => !p.componentGuid && p.bounds)
  
  if (componentsWithBounds.length === 0 && standaloneParams.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <span className="text-sm">No positioned components to display</span>
      </div>
    )
  }

  // Find actual bounds from component positions
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  
  componentsWithBounds.forEach((comp: any) => {
    if (comp.bounds) {
      minX = Math.min(minX, comp.bounds.x || 0)
      minY = Math.min(minY, comp.bounds.y || 0)
      maxX = Math.max(maxX, (comp.bounds.x || 0) + (comp.bounds.width || 100))
      maxY = Math.max(maxY, (comp.bounds.y || 0) + (comp.bounds.height || 50))
    }
  })
  
  standaloneParams.forEach((param: any) => {
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
    maxX = 800
    maxY = 600
  }
  
  // Ensure minimum size for proper scaling
  const minWidth = 200
  const minHeight = 150
  const contentWidth = maxX - minX
  const contentHeight = maxY - minY
  
  // If content is too small, center it in a larger viewbox
  if (contentWidth < minWidth) {
    const diff = (minWidth - contentWidth) / 2
    minX -= diff
    maxX += diff
  }
  
  if (contentHeight < minHeight) {
    const diff = (minHeight - contentHeight) / 2
    minY -= diff
    maxY += diff
  }
  
  const padding = 20
  const viewBoxWidth = maxX - minX + padding * 2
  const viewBoxHeight = maxY - minY + padding * 2

  // Helper to flip Y coordinate (Grasshopper has Y increasing upward, SVG has Y increasing downward)
  const flipY = (y: number) => maxY - y + minY

  // Create a unique key based on the current selection to force re-render
  const svgKey = `${selectedGuids.join('-')}-${extendedGuids.join('-')}-${componentsWithBounds.length}-${standaloneParams.length}`

  return (
    <div className="relative w-full h-full bg-gray-50/50 rounded">
      <svg 
        key={svgKey}
        width="100%"
        height="100%"
        viewBox={`${minX - padding} ${minY - padding} ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="transition-all"
      >
        {/* Draw connections */}
        {processedContext.connections && processedContext.connections.map((conn: any, i: number) => {
          // Find source and target positions
          let sourceX = 0, sourceY = 0, targetX = 0, targetY = 0
          let hasSource = false, hasTarget = false
          
          // Check if source is a component output or standalone param
          const sourceParam = processedContext.params?.find((p: any) => p.instanceGuid === conn.from)
          if (sourceParam) {
            if (sourceParam.componentGuid) {
              // It's a component parameter
              const sourceComp = componentMap[sourceParam.componentGuid]
              if (sourceComp?.bounds) {
                sourceX = sourceComp.bounds.x + sourceComp.bounds.width
                sourceY = flipY(sourceComp.bounds.y + sourceComp.bounds.height / 2)
                hasSource = true
              }
            } else if (sourceParam.bounds) {
              // It's a standalone parameter
              sourceX = sourceParam.bounds.x + sourceParam.bounds.width
              sourceY = flipY(sourceParam.bounds.y + sourceParam.bounds.height / 2)
              hasSource = true
            }
          }
          
          // Check if target is a component input or standalone param
          const targetParam = processedContext.params?.find((p: any) => p.instanceGuid === conn.to)
          if (targetParam) {
            if (targetParam.componentGuid) {
              // It's a component parameter
              const targetComp = componentMap[targetParam.componentGuid]
              if (targetComp?.bounds) {
                targetX = targetComp.bounds.x
                targetY = flipY(targetComp.bounds.y + targetComp.bounds.height / 2)
                hasTarget = true
              }
            } else if (targetParam.bounds) {
              // It's a standalone parameter
              targetX = targetParam.bounds.x
              targetY = flipY(targetParam.bounds.y + targetParam.bounds.height / 2)
              hasTarget = true
            }
          }
          
          if (!hasSource || !hasTarget) return null
          
          // Draw bezier curve connection
          const controlDist = Math.abs(targetX - sourceX) * 0.4
          
          return (
            <path
              key={`conn-${i}`}
              d={`M ${sourceX} ${sourceY} C ${sourceX + controlDist} ${sourceY}, ${targetX - controlDist} ${targetY}, ${targetX} ${targetY}`}
              stroke="#6B7280"
              strokeWidth="2"
              fill="none"
              opacity="0.7"
            />
          )
        })}
        
        {/* Draw standalone parameters */}
        {standaloneParams.map((param: any) => {
          if (!param.bounds) return null
          
          const isSelected = selectedSet.has(param.instanceGuid)
          const isExtended = extendedSet.has(param.instanceGuid)
          
          let fillColor = '#F3F4F6'
          let strokeColor = '#6B7280'
          let textColor = '#1F2937'
          
          if (isSelected) {
            fillColor = '#E9D5FF'
            strokeColor = '#9333EA'
            textColor = '#6B21A8'
          } else if (isExtended) {
            fillColor = '#F3E8FF'
            strokeColor = '#A855F7'
            textColor = '#7C3AED'
          }
          
          const paramY = flipY(param.bounds.y + (param.bounds.height || 30))
          
          return (
            <g key={param.instanceGuid}>
              <rect
                x={param.bounds.x}
                y={paramY}
                width={param.bounds.width || 80}
                height={param.bounds.height || 30}
                rx="4"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
              <text 
                x={param.bounds.x + (param.bounds.width || 80) / 2}
                y={paramY + (param.bounds.height || 30) / 2}
                fontSize="10"
                fill={textColor}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {param.nickName || param.name || 'Param'}
              </text>
            </g>
          )
        })}
        
        {/* Draw components */}
        {componentsWithBounds.map((comp: any) => {
          if (!comp.bounds) return null
          
          const isSelected = selectedSet.has(comp.instanceGuid)
          const isExtended = extendedSet.has(comp.instanceGuid)
          
          // Determine component color based on type
          let fillColor = '#F9FAFB'
          let strokeColor = '#4B5563'
          let textColor = '#111827'
          
          if (isSelected) {
            fillColor = '#DDD6FE'
            strokeColor = '#7C3AED'
            textColor = '#581C87'
          } else if (isExtended) {
            fillColor = '#EDE9FE'
            strokeColor = '#9333EA'
            textColor = '#6B21A8'
          }
          
          // Component icon based on type
          let icon = '📦'
          if (comp.category === 'Params') {
            icon = '💾'
          } else if (comp.name?.includes('Python')) {
            icon = '🐍'
          } else if (comp.name?.includes('Script')) {
            icon = '📜'
          }
          
          const compWidth = comp.bounds.width || 100
          const compHeight = comp.bounds.height || 50
          const compY = flipY(comp.bounds.y + compHeight)
          
          return (
            <g key={comp.instanceGuid}>
              {/* Component rectangle */}
              <rect
                x={comp.bounds.x}
                y={compY}
                width={compWidth}
                height={compHeight}
                rx="6"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isSelected ? 2.5 : 1.5}
                className="transition-all"
              />
              
              {/* Selection indicator */}
              {isSelected && (
                <circle
                  cx={comp.bounds.x + compWidth - 10}
                  cy={compY + 10}
                  r="4"
                  fill="#A855F7"
                />
              )}
              {isExtended && !isSelected && (
                <circle
                  cx={comp.bounds.x + compWidth - 10}
                  cy={compY + 10}
                  r="4"
                  fill="#D8B4FE"
                />
              )}
              
              {/* Component icon */}
              <text 
                x={comp.bounds.x + 10} 
                y={compY + 20} 
                fontSize="12"
              >
                {icon}
              </text>
              
              {/* Component name */}
              <text 
                x={comp.bounds.x + 30} 
                y={compY + 20} 
                fontSize="11" 
                fill={textColor}
                fontWeight="500"
                className="select-none"
              >
                {comp.name || comp.category || 'Component'}
              </text>
              
              {/* NickName if different */}
              {comp.nickName && comp.nickName !== comp.name && (
                <text 
                  x={comp.bounds.x + 10} 
                  y={compY + 35} 
                  fontSize="9" 
                  fill={textColor}
                  opacity="0.7"
                  className="select-none"
                >
                  {comp.nickName}
                </text>
              )}
              
              {/* Input/Output indicators */}
              {comp.inputs && comp.inputs.length > 0 && (
                <circle 
                  cx={comp.bounds.x + 3} 
                  cy={compY + compHeight / 2} 
                  r="3" 
                  fill="#60A5FA" 
                />
              )}
              {comp.outputs && comp.outputs.length > 0 && (
                <circle 
                  cx={comp.bounds.x + compWidth - 3} 
                  cy={compY + compHeight / 2} 
                  r="3" 
                  fill="#34D399" 
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}