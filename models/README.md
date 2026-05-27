# 图片分类相关文件

本目录存放 **ImageNet 辅助模型**、**CLIP 视觉 ONNX** 及 **预计算文本向量**。

## 精准度预设与依赖

| 预设 ID | 显示名 | 需下载 ONNX | prompts 文件 |
|---------|--------|-------------|--------------|
| `accuracy_light` | 轻量精准 | mobilenetv2 + clip-vit-b32-vision-quant | clip-prompts.json |
| `accuracy_balanced` | 平衡精准 | efficientnet-b4 + clip-vit-b32-vision-quant | clip-prompts.json |
| `accuracy_max` | 最高精准 | efficientnet-b4 + clip-vit-l14-vision-quant | clip-prompts-l14.json |

`clip-prompts.json` / `clip-prompts-l14.json` 应随仓库提供；缺失时运行下方生成脚本。

## 必需

| 文件 | 说明 |
|------|------|
| `imagenet1000.json` | ImageNet 1000 类英文标签，随仓库提供。 |

在应用内选择精准度预设并下载，或手动放置 ONNX 至本目录。

国内网络默认会通过 **hf-mirror.com** 镜像 Hugging Face 链接；也可在终端执行：

```bash
npm run download:models
# 或指定预设：node scripts/download-classification-models.mjs accuracy_light
```

环境变量 `FILEDEAL_HF_ENDPOINT` 可改为其他 Hugging Face 镜像根地址。

## CLIP prompts

| 文件 | 说明 |
|------|------|
| `clip-prompts.json` | ViT-B/32，512 维，含 9 类 + 消歧 prompt 嵌入 |
| `clip-prompts-l14.json` | ViT-L/14，768 维（最高精准档） |

### 生成 prompts

```bash
cd scripts/_clip_text_gen
npm install
node generate-prompts.mjs --model b32
node generate-prompts.mjs --model l14
node generate-prompts.mjs --model all
```

## ONNX 文件名

| 模型 ID | 文件名 |
|---------|--------|
| clip_vit_b32_quant | clip-vit-b32-vision-quant.onnx |
| clip_vit_l14_quant | clip-vit-l14-vision-quant.onnx |
| mobilenetv2 | mobilenetv2-7.onnx |
| efficientnet_b4 | efficientnet-b4.onnx |

## 九大类映射

索引 **0–397** 默认视为 **动物**；植物/珊瑚等标签例外归入 **自然风景**（见 `electron/main/utils/imagenetNine.ts`）。索引 ≥398 按英文标签关键词映射。
