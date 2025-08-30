'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/app-store'
import ParameterCard from './ParameterCard'
import { isFeatureEnabled } from '@/lib/features'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { OutputParameter, Parameter } from '@/lib/types'

// Sortable wrapper component for drag & drop
function SortableOutputCard({ 
  parameter, 
  onChange, 
  onRemove,
  disableRemove,
  isDefaultOutput 
}: {
  parameter: OutputParameter
  onChange: (p: Parameter) => void
  onRemove: (id: string) => void
  disableRemove?: boolean
  isDefaultOutput?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: parameter.id,
    disabled: isDefaultOutput // Disable dragging for default output
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div className="relative group">
        {isFeatureEnabled('ENABLE_DRAG_DROP_REORDER') && !isDefaultOutput && (
          <div
            {...attributes}
            {...listeners}
            className="absolute left-0 top-1/2 -translate-y-1/2 -ml-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-move"
          >
            <i className="fas fa-grip-vertical text-gray-400"></i>
          </div>
        )}
        <ParameterCard
          parameter={parameter}
          onChange={onChange}
          onRemove={onRemove}
          disableRemove={disableRemove}
          isDefaultOutput={isDefaultOutput}
        />
      </div>
    </div>
  )
}

export default function OutputParameters() {
  const outputs = useAppStore((state) => state.outputs)
  const addOutput = useAppStore((state) => state.addOutput)
  const updateParameter = useAppStore((state) => state.updateParameter)
  const removeParameter = useAppStore((state) => state.removeParameter)
  const reorderOutputs = useAppStore((state) => state.reorderOutputs)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastLengthRef = useRef(outputs.length)

  // Check if a parameter is the default output
  const isDefaultOutput = (name: string) => name.toLowerCase() === 'output'

  // Set up drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      reorderOutputs(active.id as string, over.id as string)
    }
  }

  // Scroll to bottom when new parameter is added
  useEffect(() => {
    if (outputs.length > lastLengthRef.current && containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }, 100)
    }
    lastLengthRef.current = outputs.length
  }, [outputs.length])

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        className="flex-1 custom-scrollbar border border-gray-200 rounded-md p-4 mb-3 overflow-y-auto"
        style={{ 
          backgroundColor: '#f8f9fa',
          minHeight: '200px'
        }}
      >
        {outputs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <i className="fas fa-inbox text-3xl mb-3 block"></i>
            <p className="text-sm">No output parameters</p>
            <p className="text-xs mt-2">Click &quot;Add Output&quot; to create one</p>
          </div>
        ) : isFeatureEnabled('ENABLE_DRAG_DROP_REORDER') ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={outputs.map(o => o.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {outputs.map((output) => {
                  const isDefault = isDefaultOutput(output.name)
                  return (
                    <SortableOutputCard
                      key={output.id}
                      parameter={output}
                      onChange={updateParameter}
                      onRemove={removeParameter}
                      disableRemove={isDefault}
                      isDefaultOutput={isDefault}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="space-y-2">
            {outputs.map((output) => {
              const isDefault = isDefaultOutput(output.name)
              return (
                <ParameterCard
                  key={output.id}
                  parameter={output}
                  onChange={updateParameter}
                  onRemove={removeParameter}
                  disableRemove={isDefault}
                  isDefaultOutput={isDefault}
                />
              )
            })}
          </div>
        )}
      </div>
      <div className="mt-auto">
        <button 
          onClick={addOutput}
          className="btn btn-success btn-sm btn-icon w-full"
        >
          <i className="fas fa-plus"></i> Add Output
        </button>
      </div>
    </div>
  )
}