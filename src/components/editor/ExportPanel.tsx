'use client'

/**
 * PHASE 3 — ExportPanel: per-element export settings UI (GAP G4).
 * Each row: format (PNG/JPG/SVG/PDF/WEBP) + scale (1x/2x/4x) +
 * quality (JPG/WEBP only) + download. Settings persist on the element
 * (exportSettings) so they round-trip through save/sync.
 */

import React from 'react'
import { Plus, Trash2, Download } from 'lucide-react'
import { useEditorStore, DesignElement } from '@/store/editor-store'
import { exportElement, EXPORT_FORMATS, ExportFormat } from '@/lib/export'

interface ExportPanelProps {
  element: DesignElement
}

const selectCls =
  'h-6 px-1 text-[10px] border border-[#555] rounded bg-[#2C2C2C] text-[#DDD] focus:outline-none focus:border-[#0D99FF]'

/** Formats that support lossy quality control. */
function supportsQuality(format: string): boolean {
  return format === 'JPG' || format === 'WEBP'
}

export function ExportPanel({ element }: ExportPanelProps) {
  const { addExportSetting, removeExportSetting, updateElement, pushHistory } = useEditorStore()
  const exportSettings = element.exportSettings || []
  const [busyIndex, setBusyIndex] = React.useState<number | null>(null)

  const setSetting = (i: number, patch: Partial<{ format: string; scale: number; quality: number }>) => {
    const newSettings = exportSettings.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    pushHistory()
    updateElement(element.id, { exportSettings: newSettings })
  }

  const handleAddExport = () => {
    pushHistory()
    addExportSetting(element.id, { format: 'PNG', scale: 2, quality: 0.92 })
  }

  const handleExport = async (
    setting: { format: string; scale: number; quality?: number },
    index: number
  ) => {
    setBusyIndex(index)
    try {
      await exportElement(element, {
        format: setting.format as ExportFormat,
        scale: setting.scale,
        quality: setting.quality ?? 0.92,
        fileName: element.name,
      })
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setBusyIndex(null)
    }
  }

  return (
    <div>
      {exportSettings.map((setting, i) => (
        <div key={i} className="mb-1.5 bg-[#1E1E1E] border border-[#383838] rounded p-1.5 space-y-1">
          <div className="flex items-center gap-1.5">
            <select
              value={setting.format}
              onChange={(e) => setSetting(i, { format: e.target.value })}
              className={selectCls}
              title="Export format"
            >
              {EXPORT_FORMATS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            {setting.format !== 'SVG' && setting.format !== 'PDF' && (
              <select
                value={setting.scale}
                onChange={(e) => setSetting(i, { scale: Number(e.target.value) })}
                className={selectCls}
                title="Export scale"
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            )}

            <button
              onClick={() => handleExport(setting, i)}
              disabled={busyIndex === i}
              className="flex items-center justify-center h-6 px-2 rounded bg-[#0D99FF] text-white text-[10px] hover:bg-[#0B87E0] disabled:opacity-50 transition-colors ml-auto"
              title={`Export as ${setting.format}`}
            >
              <Download className="w-3 h-3" />
            </button>

            <button
              onClick={() => { pushHistory(); removeExportSetting(element.id, i) }}
              className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#3C3C3C]"
              title="Remove export setting"
            >
              <Trash2 className="w-3 h-3 text-[#F24822]" />
            </button>
          </div>

          {supportsQuality(setting.format) && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-[#888] w-12 shrink-0">Quality</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.02}
                value={setting.quality ?? 0.92}
                onChange={(e) => setSetting(i, { quality: Number(e.target.value) })}
                className="flex-1 h-1 accent-[#0D99FF]"
              />
              <span
                className="text-[9px] text-[#AAA] w-7 text-right tabular-nums"
                style={{ fontFamily: 'var(--fig-font-family-mono)' }}
              >
                {Math.round((setting.quality ?? 0.92) * 100)}%
              </span>
            </div>
          )}

          <div
            className="text-[8px] text-[#666] tabular-nums"
            style={{ fontFamily: 'var(--fig-font-family-mono)' }}
          >
            {element.name}
            {setting.scale && setting.format !== 'SVG' && setting.format !== 'PDF' ? `@${setting.scale}x` : ''}
            .{setting.format.toLowerCase()}
          </div>
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
