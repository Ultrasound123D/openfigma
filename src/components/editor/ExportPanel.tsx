'use client'

import React from 'react'
import { Plus, Trash2, Download } from 'lucide-react'
import { useEditorStore, DesignElement } from '@/store/editor-store'
import { exportAsPNG, exportAsSVG, exportAsPDF, exportElementAsPNG } from '@/lib/export'

interface ExportPanelProps {
  element: DesignElement
}

export function ExportPanel({ element }: ExportPanelProps) {
  const { addExportSetting, removeExportSetting, updateElement, pushHistory } = useEditorStore()
  const exportSettings = element.exportSettings || []

  const handleAddExport = () => {
    pushHistory()
    addExportSetting(element.id, { format: 'PNG', scale: 1 })
  }

  const handleExport = async (setting: { format: string; scale: number }, index: number) => {
    try {
      switch (setting.format) {
        case 'PNG':
          await exportElementAsPNG(element, setting.scale)
          break
        case 'SVG':
          await exportAsSVG([element])
          break
        case 'PDF':
          await exportAsPDF()
          break
      }
    } catch (e) {
      console.error('Export failed:', e)
    }
  }

  return (
    <div>
      {exportSettings.map((setting, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-1.5 bg-[#1E1E1E] border border-[#383838] rounded p-1.5">
          <select
            value={setting.format}
            onChange={(e) => {
              const newSettings = [...exportSettings]
              newSettings[i] = { ...newSettings[i], format: e.target.value }
              pushHistory()
              updateElement(element.id, { exportSettings: newSettings })
            }}
            className="h-6 px-1 text-[10px] border border-[#555] rounded bg-[#2C2C2C] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
          >
            <option value="PNG">PNG</option>
            <option value="SVG">SVG</option>
            <option value="PDF">PDF</option>
          </select>

          <select
            value={setting.scale}
            onChange={(e) => {
              const newSettings = [...exportSettings]
              newSettings[i] = { ...newSettings[i], scale: Number(e.target.value) }
              pushHistory()
              updateElement(element.id, { exportSettings: newSettings })
            }}
            className="h-6 px-1 text-[10px] border border-[#555] rounded bg-[#2C2C2C] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>

          <button
            onClick={() => handleExport(setting, i)}
            className="flex items-center justify-center h-6 px-2 rounded bg-[#0D99FF] text-white text-[10px] hover:bg-[#0B87E0] transition-colors ml-auto"
          >
            <Download className="w-3 h-3" />
          </button>

          <button
            onClick={() => { pushHistory(); removeExportSetting(element.id, i) }}
            className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#3C3C3C]"
          >
            <Trash2 className="w-3 h-3 text-[#F44336]" />
          </button>
        </div>
      ))}

      <button
        onClick={handleAddExport}
        className="flex items-center gap-1 h-6 px-2 rounded bg-[#1E1E1E] text-[10px] text-[#888] hover:bg-[#3C3C3C] hover:text-white transition-colors border border-[#383838] w-full justify-center"
      >
        <Plus className="w-3 h-3" />
        Add Export
      </button>
    </div>
  )
}
