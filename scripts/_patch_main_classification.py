# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
main_path = ROOT / "electron" / "main" / "main.ts"
lines = main_path.read_text(encoding="utf-8").splitlines(keepends=True)

out = []
i = 0
while i < len(lines):
    if lines[i].startswith("const IMAGENET_CLASSES"):
        i += 1
        while i < len(lines) and not lines[i].strip().startswith("let imagenetClasses"):
            i += 1
        if i < len(lines):
            i += 1
        continue
    out.append(lines[i])
    i += 1

text = "".join(out)
lines = text.splitlines(keepends=True)

start = end = None
for i, line in enumerate(lines):
    if "图片内容分类功能" in line:
        start = i
    if start is not None and "ipcHandle('image:classify'" in line:
        end = i
        break
if start is None or end is None:
    raise SystemExit(f"markers not found start={start} end={end}")

new_block = '''// ==================== 图片内容分类（CLIP + ImageNet 九大类）====================

function clearModelCache(modelId?: ClassificationModelId): void {
  clearImagenetSessionCache(modelId)
  clearClipModelCache()
}

async function classifyImage(
  imagePath: string,
  modelId: ClassificationModelId = 'clip_vit_b32_quant'
): Promise<ImageClassificationResult> {
  return runClassifyImage(imagePath, process.cwd(), modelId)
}

'''

lines = lines[:start] + [new_block] + lines[end:]
main_path.write_text("".join(lines), encoding="utf-8")
print("OK")
