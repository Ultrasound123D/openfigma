#!/usr/bin/env python3
"""crop_icon_previews.py — crop the centered square icon out of each fullscreen
PrototypePlayer screenshot (2560x1440).

Math (verified from PrototypePlayer source):
  fitScale = 0.85 * min(2560/512, 1440/512) = 2.390625
  icon px  = 512 * 2.390625 = 1224
  box      = ((2560-1224)//2, (1440-1224)//2) = (668, 108)
"""
import os
import sys

from PIL import Image

# Input/output dir: override with first argument or ICON_OUT_DIR (defaults to cwd)
DIR = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("ICON_OUT_DIR", os.getcwd())

SIZE = round(512 * 0.85 * min(2560 / 512, 1440 / 512))  # 1224
X = (2560 - SIZE) // 2
Y = (1440 - SIZE) // 2

for i in range(1, 9):
    src = os.path.join(DIR, f"icon-{i:02d}-preview.png")
    dst = os.path.join(DIR, f"icon-{i:02d}.png")
    im = Image.open(src)
    assert im.size == (2560, 1440), f"{src}: unexpected size {im.size}"
    icon = im.crop((X, Y, X + SIZE, Y + SIZE))
    icon.save(dst)
    # quick sanity: sample the 4 corners of the crop — they must all be the icon
    # frame's rounded-corner background (#141414 player bg shows through corners)
    px = icon.convert("RGB")
    corners = [px.getpixel((2, 2)), px.getpixel((SIZE - 3, 2)), px.getpixel((2, SIZE - 3)), px.getpixel((SIZE - 3, SIZE - 3))]
    print(f"icon-{i:02d}.png {SIZE}x{SIZE} corners={corners}")
print("done")
