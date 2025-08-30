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
import { InputParameter, Parameter } from '@/lib/types'

// Sortable wrapper component for drag & drop
function SortableParameterCard({ 
  parameter, 
  onChange, 
  onRemove 
}: {
  parameter: InputParameter
  onChange: (p: Parameter) => void
  onRemove: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: parameter.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div className="relative group">
        {isFeatureEnabled('ENABLE_DRAG_DROP_REORDER') && (
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
        />
      </div>
    </div>
  )
}

export default function InputParameters() {
  const inputs = useAppStore((state) => state.inputs)
  const addInput = useAppStore((state) => state.addInput)
  const updateParameter = useAppStore((state) => state.updateParameter)
  const removeParameter = useAppStore((state) => state.removeParameter)
  const reorderInputs = useAppStore((state) => state.reorderInputs)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastLengthRef = useRef(inputs.length)

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
      reorderInputs(active.id as string, over.id as string)
    }
  }

  // Scroll to bottom when new parameter is added
  useEffect(() => {
    if (inputs.length > lastLengthRef.current && containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }, 100)
    }
    lastLengthRef.current = inputs.length
  }, [inputs.length])

  const renderContent = () => {
    if (inputs.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          <i className="fas fa-inbox text-3xl mb-3 block"></i>
          <p className="text-sm">No input parameters yet</p>
          <p className="text-xs mt-2">Click &quot;Add Input&quot; to create one</p>
        </div>
      )
    }

    if (isFeatureEnabled('ENABLE_DRAG_DROP_REORDER')) {
      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={inputs.map(i => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {inputs.map((input) => (
                <SortableParameterCard
                  key={input.id}
                  parameter={input}
                  onChange={updateParameter}
                  onRemove={removeParameter}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )
    }

    return (
      <div className="space-y-2">
        {inputs.map((input) => (
          <ParameterCard
            key={input.id}
            parameter={input}
            onChange={updateParameter}
            onRemove={removeParameter}
          />
        ))}
      </div>
    )
  }

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
        {renderContent()}
      </div>
      <div className="mt-auto">
        <button 
          onClick={addInput}
          className="btn btn-success btn-sm btn-icon w-full"
        >
          <i className="fas fa-plus"></i> Add Input
        </button>
      </div>
    </div>
  )
}