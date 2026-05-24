#!/usr/bin/env python3
"""Build Demo Video — overlay text on images with Pillow, then ffmpeg concat."""
import subprocess, os
from PIL import Image, ImageDraw, ImageFont

IN_DIR = "demo-video"
OUT = os.path.join(IN_DIR, "DocTransAgent-Demo.mp4")
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"
W, H = 1440, 810

# Slides: (filename, duration, [(text, y, size, color), ...])
slides = [
    ("01-dashboard.png", 10, [
        ("DocTransAgent", 60, 48, (255, 255, 255)),
        ("多语言文档智能平台", 120, 28, (200, 220, 255)),
    ]),
    ("02-dashboard-en.png", 7, [
        ("中英双语界面一键切换", 60, 40, (255, 255, 255)),
        ("Bilingual UI — Chinese/English Toggle", 110, 22, (180, 200, 240)),
    ]),
    ("03-upload.png", 12, [
        ("智能文档管理", 60, 44, (255, 255, 255)),
        ("PDF / DOCX / Markdown 多格式上传", 120, 24, (220, 220, 240)),
        ("选择目标语言，一键批量AI翻译", 152, 24, (220, 220, 240)),
        ("翻译完成自动跳转双语对比页", 184, 24, (220, 220, 240)),
    ]),
    ("04-graph.png", 12, [
        ("Obsidian 风格知识图谱", 60, 44, (255, 255, 255)),
        ("解析双链、标签、Frontmatter元数据", 120, 24, (220, 220, 240)),
        ("D3力导向图,节点可拖拽缩放", 152, 24, (220, 220, 240)),
        ("每个节点支持单独翻译", 184, 24, (220, 220, 240)),
    ]),
    ("05-qa.png", 10, [
        ("RAG 智能问答", 60, 44, (255, 255, 255)),
        ("跨语言语义检索,中文提问查英文文档", 120, 24, (220, 220, 240)),
        ("回答带文档来源引用,可追溯原文", 152, 24, (220, 220, 240)),
    ]),
    ("06-glossary.png", 5, [
        ("术语表管理", 60, 44, (255, 255, 255)),
        ("确保企业品牌翻译一致性", 120, 24, (220, 220, 240)),
    ]),
]

# ── Step 1: Overlay text on images ──
TMP_DIR = os.path.join(IN_DIR, "_tmp")
os.makedirs(TMP_DIR, exist_ok=True)
fonts = {}

def get_font(size):
    if size not in fonts:
        fonts[size] = ImageFont.truetype(FONT_PATH, size)
    return fonts[size]

tmp_files = []
for filename, dur, texts in slides:
    src = os.path.join(IN_DIR, filename)
    dst = os.path.join(TMP_DIR, filename)
    
    img = Image.open(src).convert("RGBA")
    img = img.resize((W, H), Image.LANCZOS)
    
    # Semi-transparent overlay bar at top for better text readability
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    # Background bar
    max_y = max(t[1] for t in texts) + 40
    draw.rectangle([(0, 0), (W, max_y)], fill=(0, 0, 0, 120))
    
    # Title bar gradient effect
    for t in texts:
        text, y, size, color = t
        font = get_font(size)
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        x = (W - tw) // 2
        draw.text((x + 1, y + 1), text, font=font, fill=(0, 0, 0, 80))
        draw.text((x, y), text, font=font, fill=color + (255,))
    
    img = Image.alpha_composite(img, overlay)
    img.convert("RGB").save(dst, "PNG")
    tmp_files.append(dst)
    print(f"✅ {filename} — text overlay done")

# ── Step 2: ffmpeg concat ──
print(f"\n📹 Building video — {len(slides)} slides...")
inputs = []
filter_parts = []
concat_labels = []

for idx, (_, dur, _) in enumerate(slides):
    inputs.extend(["-loop", "1", "-t", str(dur), "-i", tmp_files[idx]])
    v = f"[{idx}:v]"
    chain = f"{v}setpts=PTS-STARTPTS,scale={W}:-2,fade=t=in:d=0.5,fade=t=out:d=0.5:st={dur-0.5}[v{idx}]"
    filter_parts.append(chain)
    concat_labels.append(f"[v{idx}]")

concat_inputs = "".join(concat_labels)
filter_complex = "; ".join(filter_parts) + f"; {concat_inputs}concat=n={len(slides)}:v=1:a=0,format=yuv420p[v]"

cmd = [
    "ffmpeg", "-y", *inputs,
    "-filter_complex", filter_complex,
    "-map", "[v]", "-r", "25",
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-pix_fmt", "yuv420p", OUT,
]

r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode == 0:
    total_dur = sum(d for _, d, _ in slides)
    size_mb = os.path.getsize(OUT) / 1024 / 1024
    print(f"\n✅ Done: {OUT} ({size_mb:.1f} MB, {total_dur}s)")
    
    # Clean up temp files
    import shutil
    shutil.rmtree(TMP_DIR, ignore_errors=True)
else:
    print("\n❌ Failed:")
    for line in r.stderr.split("\n"):
        if "error" in line.lower() or "No such" in line:
            print(f"   {line.strip()}")