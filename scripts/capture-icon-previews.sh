#!/usr/bin/env bash
# capture-icon-previews.sh — for each of the 8 icon frames:
# select it in the Layers panel → Present (▶) → fullscreen preview screenshot → Escape.
# Requires: agent-browser session already open on the icon project (2560x1440).
set -u
# Output dir: override with ICON_OUT_DIR or first argument (defaults to cwd)
OUT="${ICON_OUT_DIR:-${1:-$PWD}}"

shot_one() {
  local num="$1" label="$2"
  # 1. find the frame row in layers (exclude caption rows: exact frame rows end with child-count digits)
  local ref
  ref=$(agent-browser snapshot -i 2>/dev/null | grep -E "group \"Icon 0${num} — ${label}" | grep -v Tcaption | head -1 | sed -E 's/.*\[ref=([^]]+)\].*/\1/')
  if [ -z "$ref" ]; then echo "FAIL: no layer row for Icon 0${num}"; return 1; fi
  # 2. select it
  agent-browser click "@${ref}" >/dev/null || { echo "FAIL click layer 0${num}"; return 1; }
  sleep 0.6
  # 3. present fullscreen
  agent-browser find testid present-button click >/dev/null 2>&1 || \
  agent-browser find text "Present prototype (▶)" click >/dev/null 2>&1 || { echo "FAIL present 0${num}"; return 1; }
  sleep 1.4
  # 4. screenshot
  agent-browser screenshot "${OUT}/icon-0${num}-preview.png" >/dev/null || { echo "FAIL shot 0${num}"; return 1; }
  # 5. exit preview
  agent-browser press Escape >/dev/null
  sleep 0.5
  echo "OK icon-0${num}-preview.png"
}

shot_one 1 "Sparkle & Pen"
shot_one 2 "Chat to Design"
shot_one 3 "Canvas Sparkle"
shot_one 4 "OD Monogram"
shot_one 5 "Terminal Spark"
shot_one 6 "AI Layers"
shot_one 7 "Generative Orb"
shot_one 8 "Agent Cursor"
