'use client'

import React, { useState } from 'react'
import { Component, Copy, Link2, Unlink, Plus, Trash2, Edit3, Check, X, ArrowUpDown, LayoutGrid } from 'lucide-react'
import { useEditorStore, ComponentPropertyDefinition, ComponentPropertyType, ComponentPropertyValue, VariantGroupProperty } from '@/store/editor-store'
import { findElementInList } from '@/lib/element-utils'

export function ComponentPanel() {
  const { elements, createInstance, resetOverrides, detachInstance, addComponent, addComponentSet, selectedElementIds, pushHistory, addComponentPropertyDefinition, editComponentPropertyDefinition, deleteComponentPropertyDefinition, addVariantPropertyDefinition, setVariantPropertyValue, setComponentPropertyValue, swapInstanceComponent, setDefaultVariant, addVariantToSet } = useEditorStore()

  const components = elements.filter(el => el.isComponent || el.isComponentSet)
  const instances = elements.filter(el => el.componentId)
  const componentSets = elements.filter(el => el.isComponentSet)

  const selectedId = selectedElementIds.length === 1 ? selectedElementIds[0] : null
  const selectedElement = selectedId ? findElementInList(elements, selectedId) : null

  const [editingProp, setEditingProp] = useState<string | null>(null)
  const [editPropName, setEditPropName] = useState('')
  const [editPropType, setEditPropType] = useState<ComponentPropertyType>('BOOLEAN')
  const [editPropDefault, setEditPropDefault] = useState('true')
  const [editingVariantProp, setEditingVariantProp] = useState<string | null>(null)
  const [editVariantPropName, setEditVariantPropName] = useState('')
  const [editVariantPropValues, setEditVariantPropValues] = useState('')

  const handleMakeComponent = () => {
    if (selectedId) {
      pushHistory()
      addComponent(selectedId)
    }
  }

  const handleCreateComponentSet = () => {
    if (selectedElementIds.length >= 2) {
      pushHistory()
      addComponentSet(selectedElementIds, `Component Set ${componentSets.length + 1}`)
    }
  }

  const handleCreateInstance = (componentId: string, variantId?: string) => {
    pushHistory()
    createInstance(variantId || componentId)
  }

  const handleResetOverrides = () => {
    if (selectedId) {
      pushHistory()
      resetOverrides(selectedId)
    }
  }

  const handleDetachInstance = () => {
    if (selectedId) {
      pushHistory()
      detachInstance(selectedId)
    }
  }

  const handleAddPropDef = () => {
    if (!selectedId || !editingProp) return
    let def: ComponentPropertyDefinition
    switch (editPropType) {
      case 'BOOLEAN': def = { type: 'BOOLEAN', defaultValue: editPropDefault === 'true' }; break
      case 'TEXT': def = { type: 'TEXT', defaultValue: editPropDefault }; break
      case 'NUMBER': def = { type: 'NUMBER', defaultValue: Number(editPropDefault) || 0 }; break
      case 'VARIANT': def = { type: 'VARIANT', defaultValue: editPropDefault, variantOptions: editPropDefault ? [editPropDefault] : [] }; break
      default: return
    }
    pushHistory()
    addComponentPropertyDefinition(selectedId, editPropName, def)
    setEditingProp(null)
  }

  const handleAddVariantProp = () => {
    if (!selectedId || !editingVariantProp) return
    const values = editVariantPropValues.split(',').map(v => v.trim()).filter(Boolean)
    if (values.length < 1) return
    pushHistory()
    addVariantPropertyDefinition(selectedId, editVariantPropName, values)
    // Auto-assign values to each variant child
    const setEl = findElementInList(elements, selectedId)
    if (setEl?.children) {
      setEl.children.forEach((child, i) => {
        const val = values[i % values.length]
        setVariantPropertyValue(child.id, editVariantPropName, val)
      })
    }
    setEditingVariantProp(null)
  }

  const handlePropValueChange = (instanceId: string, propName: string, value: ComponentPropertyValue) => {
    pushHistory()
    setComponentPropertyValue(instanceId, propName, value)
  }

  const handleSwapInstance = (instanceId: string) => {
    const instance = findElementInList(elements, instanceId)
    if (!instance) return
    // Find the next component/component-set to swap to
    const allMasters = components
    const currentIdx = allMasters.findIndex(m => m.id === instance.componentId)
    const next = allMasters[(currentIdx + 1) % allMasters.length]
    if (next) {
      pushHistory()
      swapInstanceComponent(instanceId, next.id)
    }
  }

  // Find the current component set for the selected element (if it's a child variant)
  const findVariantSet = (elId: string) => {
    for (const cs of componentSets) {
      if (cs.children?.some(c => c.id === elId)) return cs
    }
    return null
  }

  const renderPropDefEditor = () => (
    <div className="space-y-1.5 p-2 bg-[#1E1E1E] rounded border border-[#383838]">
      <input autoFocus value={editPropName} onChange={e => setEditPropName(e.target.value)} placeholder="Property name" className="w-full h-6 px-2 text-[10px] bg-[#2C2C2C] border border-[#555] rounded text-[#CCC] outline-none focus:border-[#0D99FF]" />
      <select value={editPropType} onChange={e => setEditPropType(e.target.value as ComponentPropertyType)} className="w-full h-6 px-1 text-[10px] bg-[#2C2C2C] border border-[#555] rounded text-[#CCC] outline-none">
        <option value="BOOLEAN">Boolean</option>
        <option value="TEXT">Text</option>
        <option value="NUMBER">Number</option>
        <option value="VARIANT">Variant</option>
      </select>
      <input value={editPropDefault} onChange={e => setEditPropDefault(e.target.value)} placeholder={editPropType === 'BOOLEAN' ? 'true/false' : 'Default value'} className="w-full h-6 px-2 text-[10px] bg-[#2C2C2C] border border-[#555] rounded text-[#CCC] outline-none focus:border-[#0D99FF]" />
      <div className="flex gap-1">
        <button onClick={handleAddPropDef} className="flex-1 h-5 rounded bg-[#0D99FF] text-white text-[10px] font-medium hover:bg-[#0B87E0] transition-colors">Add</button>
        <button onClick={() => setEditingProp(null)} className="h-5 w-5 rounded bg-[#3C3C3C] text-[#888] hover:text-white flex items-center justify-center"><X className="w-3 h-3" /></button>
      </div>
    </div>
  )

  const renderVariantPropEditor = () => (
    <div className="space-y-1.5 p-2 bg-[#1E1E1E] rounded border border-[#383838]">
      <input autoFocus value={editVariantPropName} onChange={e => setEditVariantPropName(e.target.value)} placeholder="Property name" className="w-full h-6 px-2 text-[10px] bg-[#2C2C2C] border border-[#555] rounded text-[#CCC] outline-none focus:border-[#0D99FF]" />
      <input value={editVariantPropValues} onChange={e => setEditVariantPropValues(e.target.value)} placeholder="Values (comma-separated)" className="w-full h-6 px-2 text-[10px] bg-[#2C2C2C] border border-[#555] rounded text-[#CCC] outline-none focus:border-[#0D99FF]" />
      <div className="flex gap-1">
        <button onClick={handleAddVariantProp} className="flex-1 h-5 rounded bg-[#A259FF] text-white text-[10px] font-medium hover:bg-[#8B3FE0] transition-colors">Add</button>
        <button onClick={() => setEditingVariantProp(null)} className="h-5 w-5 rounded bg-[#3C3C3C] text-[#888] hover:text-white flex items-center justify-center"><X className="w-3 h-3" /></button>
      </div>
    </div>
  )

  const renderComponentProperties = (componentId: string, currentValues?: Record<string, ComponentPropertyValue>) => {
    const comp = findElementInList(elements, componentId)
    const defs = comp?.componentPropertyDefinitions
    if (!defs || Object.keys(defs).length === 0) return null
    return (
      <div className="space-y-1">
        <h5 className="text-[9px] font-semibold text-[#666] uppercase tracking-wider">Properties</h5>
        {Object.entries(defs).map(([name, def]) => {
          const currentVal = currentValues?.[name] ?? def.defaultValue
          return (
            <div key={name} className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#888] w-16 truncate">{name}</span>
              {def.type === 'BOOLEAN' && (
                <select value={String(currentVal)} onChange={e => selectedId && handlePropValueChange(selectedId, name, e.target.value === 'true')} className="flex-1 h-5 px-1 text-[10px] bg-[#2C2C2C] border border-[#555] rounded text-[#CCC] outline-none">
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              )}
              {def.type === 'TEXT' && (
                <input value={String(currentVal ?? '')} onChange={e => selectedId && handlePropValueChange(selectedId, name, e.target.value)} className="flex-1 h-5 px-1 text-[10px] bg-[#2C2C2C] border border-[#555] rounded text-[#CCC] outline-none focus:border-[#0D99FF]" />
              )}
              {def.type === 'NUMBER' && (
                <input type="number" value={Number(currentVal ?? 0)} onChange={e => selectedId && handlePropValueChange(selectedId, name, Number(e.target.value))} className="flex-1 h-5 px-1 text-[10px] bg-[#2C2C2C] border border-[#555] rounded text-[#CCC] outline-none focus:border-[#0D99FF]" />
              )}
              {def.type === 'VARIANT' && (
                <div className="flex-1 flex gap-0.5">
                  {def.variantOptions?.map(opt => (
                    <button key={opt} onClick={() => selectedId && handlePropValueChange(selectedId, name, opt)} className={`px-1.5 h-5 text-[9px] rounded ${currentVal === opt ? 'bg-[#A259FF] text-white' : 'bg-[#2C2C2C] text-[#888] hover:text-[#CCC]'} transition-colors`}>{opt}</button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const renderVariantSwitcher = (componentSet: any) => {
    const defs = componentSet.componentPropertyDefinitions as Record<string, ComponentPropertyDefinition> | undefined
    if (!defs) return null
    const variantPropDefs = Object.entries(defs).filter(([, d]) => d.type === 'VARIANT') as [string, ComponentPropertyDefinition & { type: 'VARIANT'; variantOptions?: string[] }][]
    if (variantPropDefs.length === 0) return null
    return (
      <div className="space-y-1">
        {variantPropDefs.map(([name, def]) => (
          <div key={name} className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#888] w-16 truncate">{name}</span>
            <div className="flex-1 flex gap-0.5 flex-wrap">
              {def.variantOptions?.map(opt => (
                <button key={opt} onClick={() => {
                  // Find variant child with this property value
                  const variant = componentSet.children?.find((c: any) => c.variantProperties?.[name] === opt)
                  if (variant) handleCreateInstance(variant.id)
                }} className="px-1.5 h-5 text-[9px] rounded bg-[#2C2C2C] text-[#888] hover:text-[#CCC] hover:bg-[#3C3C3C] transition-colors">{opt}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Make component button */}
      {selectedElement && !selectedElement.isComponent && !selectedElement.isComponentSet && !selectedElement.componentId && (
        <button onClick={handleMakeComponent} className="flex items-center gap-1.5 w-full h-7 px-2 rounded bg-[#0D99FF] text-white text-[11px] font-medium hover:bg-[#0B87E0] transition-colors">
          <Component className="w-3.5 h-3.5" />
          Make Component
        </button>
      )}

      {/* Create Component Set button */}
      {selectedElementIds.length >= 2 && !selectedElement?.isComponentSet && (
        <button onClick={handleCreateComponentSet} className="flex items-center gap-1.5 w-full h-7 px-2 rounded bg-[#A259FF] text-white text-[11px] font-medium hover:bg-[#8B3FE0] transition-colors">
          <LayoutGrid className="w-3.5 h-3.5" />
          Create Component Set
        </button>
      )}

      {/* Instance actions */}
      {selectedElement?.componentId && (
        <div className="flex gap-1">
          <button onClick={handleResetOverrides} className="flex items-center gap-1 flex-1 h-6 px-2 rounded bg-[#1E1E1E] text-[10px] text-[#888] hover:bg-[#3C3C3C] hover:text-white transition-colors border border-[#383838]">
            <Link2 className="w-3 h-3" /> Reset
          </button>
          <button onClick={handleDetachInstance} className="flex items-center gap-1 flex-1 h-6 px-2 rounded bg-[#1E1E1E] text-[10px] text-[#888] hover:bg-[#3C3C3C] hover:text-white transition-colors border border-[#383838]">
            <Unlink className="w-3 h-3" /> Detach
          </button>
          <button onClick={() => handleSwapInstance(selectedElement.id)} className="flex items-center gap-1 flex-1 h-6 px-2 rounded bg-[#1E1E1E] text-[10px] text-[#888] hover:bg-[#3C3C3C] hover:text-white transition-colors border border-[#383838]">
            <ArrowUpDown className="w-3 h-3" /> Swap
          </button>
        </div>
      )}

      {/* Selected component properties */}
      {selectedElement?.isComponent && selectedElement.componentPropertyDefinitions && Object.keys(selectedElement.componentPropertyDefinitions).length > 0 && (
        renderComponentProperties(selectedElement.id, selectedElement.componentProperties)
      )}

      {/* Instance overridable properties */}
      {selectedElement?.componentId && (
        renderComponentProperties(selectedElement.componentId, selectedElement.componentProperties)
      )}

      {/* Component Set variant properties */}
      {selectedElement?.isComponentSet && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-semibold text-[#A259FF] uppercase tracking-wider">Variant Properties</h4>
            <button onClick={() => { setEditingVariantProp('new'); setEditVariantPropName(''); setEditVariantPropValues('') }} className="w-4 h-4 rounded hover:bg-[#3C3C3C] flex items-center justify-center">
              <Plus className="w-3 h-3 text-[#888]" />
            </button>
          </div>
          {editingVariantProp && renderVariantPropEditor()}
          {selectedElement.variantGroupProperties && Object.entries(selectedElement.variantGroupProperties).map(([name, prop]: [string, VariantGroupProperty]) => (
            <div key={name} className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#888] w-16 truncate">{name}</span>
              <span className="text-[10px] text-[#CCC]">{prop.values.join(', ')}</span>
              <button onClick={() => { setDefaultVariant(selectedElement.id, prop.values[0]) }} className="ml-auto text-[9px] text-[#666] hover:text-[#CCC]">Default</button>
            </div>
          ))}
        </div>
      )}

      {/* Variant list inside component set */}
      {selectedElement?.isComponentSet && selectedElement.children && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-[10px] font-semibold text-[#A259FF] uppercase tracking-wider">Variants ({selectedElement.children.length})</h4>
            {/* PHASE 23 (F15) — add variant (source: add-variant, figma_app ×16):
                duplicates a component with a fresh value for the first variant
                property (auto-creates "Variant" when the set has none). */}
            <button
              onClick={() => { pushHistory(); addVariantToSet(selectedElement.id) }}
              className="flex items-center gap-1 h-5 px-1.5 rounded text-[9px] text-[#A259FF] hover:bg-[#A259FF]/15 transition-colors"
              title="Add variant"
            >
              <Plus className="w-3 h-3" /> Add variant
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {selectedElement.children.map((variant: any) => (
              <div key={variant.id} className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer ${selectedElement.defaultVariant === variant.id ? 'bg-[#A259FF]/10' : 'hover:bg-[#2A2A2A]'}`} onClick={() => handleCreateInstance(variant.id)}>
                <Component className="w-3 h-3 text-[#A259FF]" />
                <span className="text-[10px] text-[#CCC] flex-1 truncate">{variant.name}</span>
                {variant.variantProperties && Object.entries(variant.variantProperties).map(([k, v]) => (
                  <span key={k} className="text-[8px] text-[#666]">{k}:{String(v)}</span>
                ))}
                {selectedElement.defaultVariant === variant.id && <span className="text-[8px] text-[#A259FF]">Default</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Component property definitions */}
      {selectedElement?.isComponent && !selectedElement.isComponentSet && (
        <div>
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">Properties</h4>
            <button onClick={() => { setEditingProp('new'); setEditPropName(''); setEditPropType('BOOLEAN'); setEditPropDefault('true') }} className="w-4 h-4 rounded hover:bg-[#3C3C3C] flex items-center justify-center">
              <Plus className="w-3 h-3 text-[#888]" />
            </button>
          </div>
          {editingProp && renderPropDefEditor()}
          {selectedElement.componentPropertyDefinitions && Object.entries(selectedElement.componentPropertyDefinitions).map(([name, def]) => (
            <div key={name} className="flex items-center gap-1.5 px-1 py-0.5 group">
              <span className="text-[10px] text-[#888] w-16 truncate">{name}</span>
              <span className="text-[9px] text-[#666]">{def.type}</span>
              <span className="text-[9px] text-[#555] ml-auto">={String(def.defaultValue).slice(0, 12)}</span>
              <button onClick={() => { deleteComponentPropertyDefinition(selectedElement.id, name); pushHistory() }} className="w-3 h-3 opacity-0 group-hover:opacity-100 hover:bg-[#3C3C3C] rounded flex items-center justify-center">
                <Trash2 className="w-2.5 h-2.5 text-[#888]" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Component list */}
      <div>
        <h4 className="text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-1.5">
          Components ({components.length})
        </h4>
        {components.length === 0 ? (
          <div className="text-[11px] text-[#666] px-2 py-1">
            No components yet. Select an element and click "Make Component".
          </div>
        ) : (
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {components.map(comp => (
              <div key={comp.id} className="group">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#2A2A2A] cursor-pointer" onClick={() => handleCreateInstance(comp.id)}>
                  <Component className={`w-3.5 h-3.5 ${comp.isComponentSet ? 'text-[#A259FF]' : 'text-[#A259FF]'}`} />
                  <span className="text-[11px] text-[#CCC] flex-1 truncate">{comp.name}</span>
                  <Copy className="w-3 h-3 text-[#888] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {/* Show variants inline for component sets */}
                {comp.isComponentSet && comp.children && (
                  <div className="ml-4 space-y-0.5">
                    {comp.children.map((variant: any) => (
                      <div key={variant.id} className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[#2A2A2A] cursor-pointer" onClick={() => handleCreateInstance(variant.id)}>
                        <Component className="w-3 h-3 text-[#A259FF] opacity-60" />
                        <span className="text-[10px] text-[#999] flex-1 truncate">{variant.name}</span>
                        {variant.variantProperties && Object.values(variant.variantProperties).filter(Boolean).map((v: any) => (
                          <span key={v} className="text-[8px] text-[#666] bg-[#2A2A2A] px-1 rounded">{v}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Component Set variant switcher */}
      {componentSets.length > 0 && (
        <div className="space-y-2">
          {componentSets.map(cs => renderVariantSwitcher(cs))}
        </div>
      )}

      {/* Instances list */}
      {instances.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-1.5">
            Instances ({instances.length})
          </h4>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {instances.map(inst => (
              <div key={inst.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${selectedId === inst.id ? 'bg-[#0D99FF]/15' : 'hover:bg-[#2A2A2A]'}`}>
                <Component className="w-3.5 h-3.5 text-[#A259FF] opacity-50" />
                <span className="text-[11px] text-[#CCC] flex-1 truncate">{inst.name}</span>
                <Link2 className="w-3 h-3 text-[#A259FF]" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}