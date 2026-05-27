# 图片分类相关文件

本目录存放 **CLIP 视觉 ONNX**、**ImageNet 辅助 ONNX（可选）**、**预计算文本向量** 与 **校准参数**。

## 精准度预设与依赖

| 预设 ID | 显示名 | 需下载 ONNX | prompts 文件 |
|---------|--------|-------------|--------------|
| `accuracy_fast` | 快速预览 | clip-vit-b32-vision-quant | clip-prompts.json |
| `accuracy_max` | 最高精准（默认） | efficientnet-b4 + clip-vit-l14-vision-quant | clip-prompts-l14.json |

旧版 ID：`accuracy_light` → `accuracy_fast`，`accuracy_balanced` → `accuracy_max`。

`clip-prompts.json` / `clip-prompts-l14.json` 应随仓库提供；缺失时运行下方生成脚本。

## 校准配置

| 文件 | 说明 |
|------|------|
| `classification-calibration.json` | CLIP 打分、条件 ImageNet 融合、置信度门控等可调参数 |
| `EVAL_BASELINE.md` | 评估基线记录模板 |

## 必需

| 文件 | 说明 |
|------|------|
| `imagenet1000.json` | ImageNet 1000 类英文标签（`accuracy_max` 条件辅助需要） |

在应用内选择精准度预设并下载，或：

```bash
npm run download:models
node scripts/download-classification-models.mjs accuracy_fast
```

环境变量 `FILEDEAL_HF_ENDPOINT` 可改为其他 Hugging Face 镜像根地址。

## CLIP prompts

```bash
cd scripts/_clip_text_gen
npm install
node generate-prompts.mjs --model all
# 或占位：npm run bootstrap:clip-prompts
```

## ONNX 文件名

| 模型 ID | 文件名 |
|---------|--------|
| clip_vit_b32_quant | clip-vit-b32-vision-quant.onnx |
| clip_vit_l14_quant | clip-vit-l14-vision-quant.onnx |
| efficientnet_b4 | efficientnet-b4.onnx |

## 评估

```bash
npm run bootstrap:fixtures
npm run eval:classify
npm run eval:classify-run
```
