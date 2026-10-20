# scripts/ — Programmatic icon-design workflow

A worked example of driving OpenFigma **entirely through its HTTP API** (no UI):
these scripts designed the [opendesign](https://github.com/Ultrasound123D/opendesign)
app icon — an 8-concept sheet, reviewed and refined, winner exported at 1224px.

## Workflow

| Step | Script | What it does |
|------|--------|--------------|
| 1 | `icon-sheet.mjs` | Creates one project with eight 512×512 icon frames (gradients, 4-point stars, pointer-path, text) laid out in a 4×2 grid with captions |
| 2 | `add-icon-backgrounds.mjs` | Inserts a background rectangle as the first child of each frame (workaround: Present mode renders frame children, not the frame's own fill) |
| 3 | `refine-pen.mjs` | Refines the winning concept — shorter pen body + geometrically computed pointed tip on the −45° axis |
| 4 | `capture-icon-previews.sh` | For each frame: select layer → Present (▶) → fullscreen screenshot → Escape (needs `agent-browser` at 2560×1440) |
| 5 | `crop_icon_previews.py` | Crops the centered 1224px square out of each PrototypePlayer screenshot (math verified against the player's `fitScale`) |

## Run

```bash
# OpenFigma running on :3111 first
node scripts/icon-sheet.mjs        # then open the project via File → Load from Server
node scripts/add-icon-backgrounds.mjs
node scripts/refine-pen.mjs
ICON_OUT_DIR=. ./scripts/capture-icon-previews.sh
python3 scripts/crop_icon_previews.py .
```

Scripts talk to `http://localhost:3111/api/editor` (override via `BASE` in each file).
Output dir for steps 4–5 defaults to the current directory (`ICON_OUT_DIR` or `$1`).
