'use client'

import { 
  Parameter, 
  InputParameter, 
  OutputParameter,
  ParameterTypeHint,
  ParameterAccess 
} from '@/lib/types'
import { useAppStore } from '@/store/app-store'

interface ParameterCardProps {
  parameter: Parameter
  onChange: (parameter: Parameter) => void
  onRemove: (id: string) => void
  disableRemove?: boolean
  isDefaultOutput?: boolean
}

const typeHintOptions: { value: ParameterTypeHint; label: string }[] = [
  { value: 'generic', label: 'Generic' },
  { value: 'str', label: 'String' },
  { value: 'int', label: 'Integer' },
  { value: 'float', label: 'Float' },
  { value: 'bool', label: 'Boolean' },
  { value: 'guid', label: 'GUID' },
  { value: 'point', label: 'Point3d' },
  { value: 'vector', label: 'Vector3d' },
  { value: 'curve', label: 'Curve' },
  { value: 'surface', label: 'Surface' },
  { value: 'brep', label: 'Brep' },
  { value: 'mesh', label: 'Mesh' }
]

const accessOptions: { value: ParameterAccess; label: string }[] = [
  { value: 'item', label: 'Item' },
  { value: 'list', label: 'List' },
  { value: 'tree', label: 'Tree' }
]

export default function ParameterCard({ 
  parameter, 
  onChange, 
  onRemove, 
  disableRemove = false,
  isDefaultOutput = false 
}: ParameterCardProps) {
  const isInput = parameter.kind === 'input'
  const isReadOnlyName = isDefaultOutput && parameter.kind === 'output'
  
  const collapsedCards = useAppStore((state) => state.collapsedCards)
  const toggleCardCollapsed = useAppStore((state) => state.toggleCardCollapsed)
  const isCollapsed = collapsedCards.has(parameter.id)
  
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnlyName) return
    onChange({ ...parameter, name: e.target.value })
  }
  
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...parameter, description: e.target.value })
  }
  
  const handleTypeHintChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isInput) {
      onChange({ 
        ...parameter, 
        typehint: e.target.value as ParameterTypeHint 
      } as InputParameter)
    }
  }
  
  const handleAccessChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isInput) {
      onChange({ 
        ...parameter, 
        access: e.target.value as ParameterAccess 
      } as InputParameter)
    }
  }
  
  const handleOptionalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isInput) {
      onChange({ 
        ...parameter, 
        optional: e.target.checked 
      } as InputParameter)
    }
  }

  const cardTitle = isDefaultOutput 
    ? "Default Output: 'output'" 
    : `${parameter.kind === 'input' ? 'Input' : 'Output'}: ${parameter.name || 'unnamed'}`

  return (
    <div className={`param-card card mb-3 animate-fadeIn ${isInput ? 'border-l-4' : 'border-l-4'}`} style={{ borderLeftColor: isInput ? 'var(--inputs-accent)' : 'var(--outputs-accent)' }}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-1">
            <button
              onClick={() => toggleCardCollapsed(parameter.id)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              aria-label={isCollapsed ? "Expand" : "Collapse"}
            >
              <i className={`fas fa-chevron-${isCollapsed ? 'right' : 'down'} text-xs`}></i>
            </button>
            <h5 className="text-base font-semibold flex-1">{cardTitle}</h5>
            {parameter.kind === 'input' ? (
              <span className="chip chip-info" title="Input parameter">Input</span>
            ) : (
              <span className="chip chip-purple" title="Output parameter">Output</span>
            )}
          </div>
          {!disableRemove && !isDefaultOutput && (
            <button
              onClick={() => onRemove(parameter.id)}
              className="text-red-500 hover:text-red-700 transition-colors ml-2"
              aria-label="Remove parameter"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>

        <div 
          className={`space-y-3 transition-all duration-300 ${
            isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[500px] opacity-100'
          }`}
          style={{
            transition: 'max-height 0.3s ease, opacity 0.3s ease'
          }}
        >
          <div>
            <label className="form-label text-xs">Name</label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={parameter.name}
              onChange={handleNameChange}
              readOnly={isReadOnlyName}
              placeholder="Parameter name"
            />
            {isDefaultOutput && (
              <div className="text-xs text-gray-600 mt-1">
                The default &apos;output&apos; param is required. Edit its description below.
              </div>
            )}
          </div>

          <div>
            <label className="form-label text-xs">Description</label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={parameter.description}
              onChange={handleDescriptionChange}
              placeholder={`Description for ${parameter.name || 'parameter'}`}
            />
          </div>

          {isInput && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="form-label text-xs">Type Hint</label>
                  <select
                    className="form-control form-control-sm"
                    value={(parameter as InputParameter).typehint}
                    onChange={handleTypeHintChange}
                  >
                    {typeHintOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label text-xs">Access</label>
                  <select
                    className="form-control form-control-sm"
                    value={(parameter as InputParameter).access}
                    onChange={handleAccessChange}
                  >
                    {accessOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2"
                  id={`optional-${parameter.id}`}
                  checked={(parameter as InputParameter).optional}
                  onChange={handleOptionalChange}
                />
                <label className="text-xs cursor-pointer select-none" htmlFor={`optional-${parameter.id}`}>
                  Optional parameter
                </label>
                <span className={`ml-2 chip ${(parameter as InputParameter).optional ? 'chip-optional' : 'chip-required'}`}>
                  {(parameter as InputParameter).optional ? 'Optional' : 'Required'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}