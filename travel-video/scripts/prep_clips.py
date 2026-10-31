#!/usr/bin/env python3
"""Pre-process raw iPhone footage for the Remotion edit.

- iPhone HDR (HLG / BT.2020, 10-bit) -> SDR BT.709 via mobius tone-mapping
- one shared "premium" colour grade (soft contrast, lifted blacks,
  warm highlights / cool shadows, slightly muted saturation)
- trim + speed change (60 fps source -> smooth slow motion at 30 fps)
- photos get the same grade so stills and video match

Usage: python3 scripts/prep_clips.py <raw_dir>
<raw_dir> holds the IMG_68xx / IMG_69xx .mov files plus the photos named in timeline.json
"""
import json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "raw")
TL = json.loads((ROOT / "timeline.json").read_text())
FPS, W, H, BEAT = TL["fps"], TL["width"], TL["height"], TL["beatFrames"]

TONEMAP = (
    "zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=203,"
    "format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=mobius:param=0.3:desat=0,"
    "zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
)
GRADE = (
    "eq=contrast=1.05:saturation=0.86:gamma=0.98,"
    "colorbalance=rs=-0.03:bs=0.045:rm=0.015:bm=-0.01:rh=0.045:gh=0.015:bh=-0.04,"
    "curves=all='0/0.035 0.25/0.225 0.5/0.5 0.75/0.77 1/0.955'"
)


def run(cmd):
    print(" ".join(cmd[:6]), "...")
    subprocess.run(cmd, check=True)


for shot in TL["shots"]:
    if shot["kind"] == "map":  # 路线图在 Remotion 里用矢量绘制
        continue
    src = RAW / shot["raw"]
    if shot["kind"] == "photo":
        out = ROOT / "public/photos" / f"{shot['id']}.jpg"
        run(["ffmpeg", "-v", "error", "-y", "-i", str(src),
             "-vf", f"format=yuv444p,eq=saturation=0.92,{GRADE}", "-q:v", "2", str(out)])
        continue
    frames = shot["beats"] * BEAT + shot["trans"]["frames"] + shot.get("margin", 12)
    src_len = frames / FPS * shot["speed"] + 0.1
    out = ROOT / "public/clips" / f"{shot['id']}.mp4"
    vf = (
        f"{TONEMAP},{GRADE},"
        f"setpts=(PTS-STARTPTS)/{shot['speed']},fps={FPS},"
        f"scale={W}:{H}:flags=lanczos,setsar=1"
    )
    run(["ffmpeg", "-v", "error", "-y", "-ss", str(shot["in"]), "-t", f"{src_len:.3f}",
         "-i", str(src), "-an", "-vf", vf, "-frames:v", str(frames),
         "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p",
         "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
         "-movflags", "+faststart", str(out)])
print("done")
