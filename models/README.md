# 图片分类相关文件

本目录存放 **ImageNet 辅助模型**、**CLIP 视觉 ONNX**（可选）及 **预计算文本向量**。

## 必需

| 文件 | 说明 |
|------|------|
| `imagenet1000.json` | ImageNet 1000 类英文标签（与 `mobilenetv2-7.onnx` 等输出顺序一致），随仓库提供。 |
| `mobilenetv2-7.onnx` | 轻量分类模型；选择「CLIP ViT-B/32」方案时，主进程仍用其做 ImageNet 聚合并与 CLIP 融合。 |

在应用内选择模型并下载，或从 [ONNX Model Zoo](https://github.com/onnx/models/tree/main/validated/vision/classification/mobilenet) 手动放置上述 ONNX。

## 可选（完整 CLIP 零样本）

| 文件 | 说明 |
|------|------|
| `clip-vit-b32-vision-quant.onnx` | Xenova / Hugging Face 上的 CLIP ViT-B/32 **视觉**量化模型。 |
| `clip-prompts.json` | 每类多条文本 prompt 的 **512 维 L2 归一化向量**（与 ViT-B/32 文本塔一致）。 |

若缺少 `clip-prompts.json` 或视觉 ONNX，应用会自动退化为 **仅 ImageNet → 9 大类** 聚合。

### 生成 `clip-prompts.json`

在可联网环境执行（需 Node，首次会拉取 `@xenova/transformers` 与模型权重）：

```bash
cd scripts/_clip_text_gen
npm install
node generate-prompts.mjs
```

生成结果写入仓库根目录 `models/clip-prompts.json`。

## 其他 ImageNet 模型

- `efficientnet-b0.onnx`、`efficientnet-b4.onnx`：可在应用内切换；输入尺寸分别为 224 / 380，同样依赖 `imagenet1000.json`。

## CogniVision（TensorFlow.js MobileNet）

应用内选项 **CogniVision（TensorFlow MobileNet）** 使用 `@tensorflow/tfjs` + `@tensorflow-models/mobilenet`（与 npm 包 `cognivision` 相同的推理栈），**不需要**向 `models/` 放置 ONNX；仅需上述 `imagenet1000.json`。首次分类时会自动下载 TensorFlow.js MobileNet 权重（需联网）。

## 九大类映射说明

索引 **0–397** 视为生物类，聚合为 **动物**；其余类别按英文标签关键词归入人物、食物、交通工具、截图、自然风景、城市建筑、室内等（见 `electron/main/utils/imagenetNine.ts`）。
