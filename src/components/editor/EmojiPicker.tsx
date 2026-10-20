'use client'

/**
 * EmojiPicker.tsx — PHASE 19 (T8).
 * Source evidence: comments.emojiPicker + insertEmoji (5101-a9dd…) and text
 * marker type "EMOJI" (1517-f945…). Local dataset only — no external API.
 * Used by: the text properties panel (content insert) and the comments
 * composer (insert into the reply input).
 */

import { useState, useRef, useEffect } from 'react'
import { EMOJI_CATEGORIES, ALL_EMOJIS } from '@/lib/emoji'

export function EmojiPickerButton({ onPick, label = '🙂' }: { onPick: (emoji: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const [cat, setCat] = useState(0)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const list = q.trim() ? ALL_EMOJIS : EMOJI_CATEGORIES[cat].emojis.filter((e) => !e.includes(' '))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setQ('') }}
        className="w-6 h-6 rounded border border-[#383838] bg-[#1E1E1E] text-[13px] leading-none hover:border-[#0D99FF] shrink-0"
        title="Insert emoji"
      >{label}</button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-56 rounded border border-[#3C3C3C] bg-[#2C2C2C] p-1.5 shadow-xl">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="mb-1 w-full h-5 px-1 text-[10px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
          />
          {!q.trim() && (
            <div className="flex gap-0.5 mb-1 flex-wrap">
              {EMOJI_CATEGORIES.map((c, i) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setCat(i)}
                  className={`h-4 px-1.5 text-[9px] rounded-sm ${i === cat ? 'bg-[#0D99FF] text-white' : 'bg-[#1E1E1E] text-[#999] hover:text-[#DDD]'}`}
                >{c.name}</button>
              ))}
            </div>
          )}
          <div className="max-h-28 overflow-y-auto grid grid-cols-8 gap-0.5">
            {list.map((em, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { onPick(em); setOpen(false) }}
                className="h-6 w-6 text-[15px] leading-none rounded hover:bg-[#3C3C3C]"
              >{em}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
