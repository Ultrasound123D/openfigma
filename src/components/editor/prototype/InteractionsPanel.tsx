'use client'

/**
 * PHASE 2 — InteractionsPanel: the real Prototype tab (replaces the
 * static placeholder — GAP G3). Edits DesignElement.interactions through
 * the store (add/update/remove) so every change is undoable, synced over
 * SSE and persisted like any other element property.
 */

import React from 'react'
import { Plus, Trash2, Play, Zap, Link2 } from 'lucide-react'
import { useEditorStore, generateId } from '@/store/editor-store'
import type { DesignElement } from '@/store/editor-store'
import type {
  Interaction,
  PrototypeTriggerType,
  PrototypeActionType,
  PrototypeAnimationType,
  PrototypeEasing,
  PrototypeDirection,
  OverlayBackgroundType,
} from '@/types/prototype'
import {
  TRIGGER_LABELS,
  ACTION_LABELS,
  ANIMATION_LABELS,
  EASING_LABELS,
  DIRECTION_LABELS,
  defaultAnimation,
} from '@/types/prototype'
import { transitionCss } from '@/lib/prototype/transitions'

const inputCls =
  'w-full h-6 px-1.5 text-[11px] border border-[#383838] rounded bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]'
const labelCls = 'text-[10px] text-[#888] mb-0.5 block'
const selectCls = `${inputCls} appearance-none cursor-pointer`

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  )
}

/** Find the top-level ancestor frame of an element (for the Play button). */
function topLevelFrameOf(elements: DesignElement[], el: DesignElement): DesignElement | null {
  const walk = (candidates: DesignElement[], parent: DesignElement | null): DesignElement | null => {
    for (const c of candidates) {
      if (c.id === el.id) return parent && parent.type === 'frame' ? parent : (c.type === 'frame' ? c : null)
      if (c.children) {
        const found = walk(c.children, c.type === 'frame' || c.type === 'group' ? c : parent)
        if (found) return found
      }
    }
    return null
  }
  return walk(elements, null)
}

export function InteractionsPanel({ element }: { element: DesignElement }) {
  const { elements, addInteraction, updateInteraction, removeInteraction, pushHistory, startPreview } = useEditorStore()
  const interactions = element.interactions || []
  const frames = elements.filter((el) => el.type === 'frame')
  const containingFrame = topLevelFrameOf(elements, element)

  const handleAdd = () => {
    pushHistory()
    const interaction: Interaction = {
      id: generateId('ix'),
      trigger: { type: 'click' },
      action: { type: 'navigate', destinationId: null },
      animation: defaultAnimation(),
    }
    addInteraction(element.id, interaction)
  }

  const patch = (interactionId: string, updates: Partial<Interaction>) => {
    pushHistory()
    updateInteraction(element.id, interactionId, updates)
  }

  if (!element) return null

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-white uppercase tracking-wider flex items-center gap-1">
          <Zap className="w-3 h-3 text-[#9747FF]" /> Interactions
        </span>
        <div className="flex items-center gap-1">
          {containingFrame && (
            <button
              onClick={() => startPreview(containingFrame.id)}
              className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#3C3C3C] text-[#AAA] hover:text-white transition-colors"
              title={`Preview from "${containingFrame.name}"`}
            >
              <Play className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={handleAdd}
            className="flex items-center justify-center w-5 h-5 rounded bg-[#0D99FF] text-white hover:bg-[#0B87E0] transition-colors"
            title="Add interaction"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {interactions.length === 0 && (
        <div className="rounded border border-dashed border-[#383838] p-3 text-center">
          <p className="text-[10px] text-[#888] mb-0.5">No interactions yet</p>
          <p className="text-[9px] text-[#666]">Wire this element to another frame with +</p>
        </div>
      )}

      {interactions.map((ix) => {
        const anim = ix.animation
        return (
          <div key={ix.id} className="rounded border border-[#383838] bg-[#1E1E1E] p-2 space-y-2">
            {/* Trigger */}
            <div className="flex items-center gap-1.5">
              <select
                value={ix.trigger.type}
                onChange={(e) => {
                  const type = e.target.value as PrototypeTriggerType
                  const trigger: Interaction['trigger'] =
                    type === 'keypress' ? { type, keys: ['enter'] } :
                    type === 'delay' ? { type, timeoutMs: 800 } :
                    { type }
                  patch(ix.id, { trigger })
                }}
                className={selectCls}
              >
                {(Object.keys(TRIGGER_LABELS) as PrototypeTriggerType[]).map((t) => (
                  <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
                ))}
              </select>
              <button
                onClick={() => { pushHistory(); removeInteraction(element.id, ix.id) }}
                className="shrink-0 flex items-center justify-center w-5 h-5 rounded hover:bg-[#3C3C3C]"
                title="Remove interaction"
              >
                <Trash2 className="w-3 h-3 text-[#F24822]" />
              </button>
            </div>

            {/* Trigger params */}
            {ix.trigger.type === 'keypress' && (
              <Field label="Keys (comma separated)">
                <input
                  className={inputCls}
                  defaultValue={(ix.trigger.keys || []).join(',')}
                  placeholder="enter, a, arrowright"
                  onBlur={(e) =>
                    patch(ix.id, {
                      trigger: {
                        type: 'keypress',
                        keys: e.target.value.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean),
                      },
                    })
                  }
                />
              </Field>
            )}
            {ix.trigger.type === 'delay' && (
              <Field label="Timeout (ms)">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  defaultValue={ix.trigger.timeoutMs ?? 800}
                  onChange={(e) =>
                    patch(ix.id, { trigger: { type: 'delay', timeoutMs: Math.max(0, Number(e.target.value) || 0) } })
                  }
                />
              </Field>
            )}

            {/* Action */}
            <Field label="Action">
              <div className="flex items-center gap-1.5 p-1.5 rounded bg-[#252525] border border-[#383838]">
                {ix.action.type === 'url' ? (
                  <Link2 className="w-3 h-3 text-[#0D99FF]" />
                ) : (
                  <span className="text-[#0D99FF] text-xs leading-none">→</span>
                )}
                <select
                  value={ix.action.type}
                  onChange={(e) => {
                    const type = e.target.value as PrototypeActionType
                    const action: Interaction['action'] =
                      type === 'navigate' ? { type, destinationId: ix.action.destinationId ?? null } :
                      type === 'open-overlay' ? { type, destinationId: ix.action.destinationId ?? null, background: { type: 'none' }, closeOnClickOutside: true } :
                      type === 'url' ? { type, url: 'https://', newTab: true } :
                      { type }
                    patch(ix.id, { action })
                  }}
                  className="flex-1 bg-transparent text-[11px] text-[#CCC] focus:outline-none cursor-pointer"
                >
                  {(Object.keys(ACTION_LABELS) as PrototypeActionType[]).map((a) => (
                    <option key={a} value={a} className="bg-[#2C2C2C]">{ACTION_LABELS[a]}</option>
                  ))}
                </select>
              </div>
            </Field>

            {/* Destination */}
            {(ix.action.type === 'navigate' || ix.action.type === 'open-overlay') && (
              <Field label="Target frame">
                <select
                  value={ix.action.destinationId ?? ''}
                  onChange={(e) =>
                    patch(ix.id, {
                      action: { ...ix.action, destinationId: e.target.value || null } as Interaction['action'],
                    })
                  }
                  className={selectCls}
                >
                  <option value="">None (click does nothing)</option>
                  {frames.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </Field>
            )}

            {/* Overlay params */}
            {ix.action.type === 'open-overlay' && (
              <>
                <Field label="Overlay background">
                  <select
                    value={ix.action.background?.type ?? 'none'}
                    onChange={(e) => {
                      const type = e.target.value as OverlayBackgroundType
                      const background =
                        type === 'solid' ? { type, color: 'rgba(0,0,0,0.4)' } :
                        type === 'blur' ? { type, blurRadius: 8 } :
                        { type }
                      patch(ix.id, { action: { ...ix.action, background } as Interaction['action'] })
                    }}
                    className={selectCls}
                  >
                    <option value="none">None</option>
                    <option value="solid">Solid color</option>
                    <option value="blur">Backdrop blur</option>
                  </select>
                </Field>
                {ix.action.background?.type === 'blur' && (
                  <Field label="Blur radius (px)">
                    <input
                      type="number" min={0} max={40}
                      className={inputCls}
                      defaultValue={ix.action.background.blurRadius ?? 8}
                      onChange={(e) =>
                        patch(ix.id, {
                          action: {
                            ...ix.action,
                            background: { type: 'blur', blurRadius: Math.max(0, Number(e.target.value) || 0) },
                          } as Interaction['action'],
                        })
                      }
                    />
                  </Field>
                )}
                <label className="flex items-center gap-1.5 text-[10px] text-[#AAA] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ix.action.closeOnClickOutside ?? true}
                    onChange={(e) =>
                      patch(ix.id, { action: { ...ix.action, closeOnClickOutside: e.target.checked } as Interaction['action'] })
                    }
                  />
                  Close when clicking outside
                </label>
              </>
            )}

            {/* URL params */}
            {ix.action.type === 'url' && (
              <>
                <Field label="URL">
                  <input
                    className={inputCls}
                    defaultValue={ix.action.url ?? ''}
                    placeholder="https://example.com"
                    onBlur={(e) => patch(ix.id, { action: { ...ix.action, url: e.target.value } as Interaction['action'] })}
                  />
                </Field>
                <label className="flex items-center gap-1.5 text-[10px] text-[#AAA] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ix.action.newTab ?? true}
                    onChange={(e) => patch(ix.id, { action: { ...ix.action, newTab: e.target.checked } as Interaction['action'] })}
                  />
                  Open in new tab
                </label>
              </>
            )}

            {/* Animation (hidden for back/close which are instant-ish in Figma) */}
            {ix.action.type !== 'back' && ix.action.type !== 'close-overlay' && (
              <>
                <Field label="Animation">
                  <select
                    value={anim.type}
                    onChange={(e) =>
                      patch(ix.id, {
                        animation: { ...anim, type: e.target.value as PrototypeAnimationType },
                      })
                    }
                    className={selectCls}
                  >
                    {(Object.keys(ANIMATION_LABELS) as PrototypeAnimationType[])
                      .filter((a) => a !== 'move-out' && a !== 'slide-out')
                      .map((a) => (
                        <option key={a} value={a}>{ANIMATION_LABELS[a]}</option>
                      ))}
                  </select>
                </Field>

                {['move-in', 'push', 'slide-in'].includes(anim.type) && (
                  <Field label="Direction">
                    <select
                      value={anim.direction ?? 'right'}
                      onChange={(e) =>
                        patch(ix.id, {
                          animation: { ...anim, direction: e.target.value as PrototypeDirection },
                        })
                      }
                      className={selectCls}
                    >
                      {(Object.keys(DIRECTION_LABELS) as PrototypeDirection[]).map((d) => (
                        <option key={d} value={d}>{DIRECTION_LABELS[d]}</option>
                      ))}
                    </select>
                  </Field>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#888] w-14 shrink-0">Duration</span>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    className="w-14 h-6 px-1 text-[11px] border border-[#383838] rounded bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF] tabular-nums"
                    defaultValue={anim.durationMs}
                    onChange={(e) =>
                      patch(ix.id, {
                        animation: { ...anim, durationMs: Math.max(0, Number(e.target.value) || 0) },
                      })
                    }
                  />
                  <span className="text-[9px] text-[#888]">ms</span>
                  <code
                    className="ml-auto text-[8px] text-[#666] truncate max-w-[70px]"
                    style={{ fontFamily: 'var(--fig-font-family-mono)' }}
                    title={transitionCss(anim)}
                  >
                    {transitionCss(anim)}
                  </code>
                </div>

                <Field label="Easing">
                  <select
                    value={anim.easing}
                    onChange={(e) =>
                      patch(ix.id, {
                        animation: { ...anim, easing: e.target.value as PrototypeEasing },
                      })
                    }
                    className={selectCls}
                  >
                    {(Object.keys(EASING_LABELS) as PrototypeEasing[]).map((ez) => (
                      <option key={ez} value={ez}>{EASING_LABELS[ez]}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
