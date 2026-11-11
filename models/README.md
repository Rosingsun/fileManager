# 图片分类相关文件

本目录存放 **CLIP 视觉 ONNX**、**真实 CLIP 文本嵌入**、**标定参数** 与评估记录。
ONNX 模型体积较大，已被 `.gitignore` 忽略，需在应用内下载或手动放置。

## 预设与依赖

| 预设 ID | 显示名 | 必需 ONNX | prompts 文件 | 评估 Top-1 |
|---------|--------|-----------|--------------|-----------|
| `accuracy_fast` | 快速预览 | `clip-vit-b32-vision-quant.onnx` | `clip-prompts.json` | 88.2% |
| `accuracy_max` | 最高精准（默认） | `clip-vit-l14-vision-quant.onnx` | `clip-prompts-l14.json` | 91.7% |

旧版 ID：`accuracy_light` → `accuracy_fast`，`accuracy_balanced` → `accuracy_max`。

> `efficientnet-b4.onnx` / `mobilenetv2-7.onnx` 等 ImageNet 模型**不再是分类必需项**。
> 5 折交叉验证表明，把 ImageNet 1000 类粗映射到 9 类后与 CLIP 融合会**降低**准确率，
> 最优权重为 0，因此两个预设均不再加载辅助模型。

### CLIP 文本嵌入（关键）

`clip-prompts.json` / `clip-prompts-l14.json` 必须是**真实 CLIP 文本编码器**产出的向量，
文件内 `embeddingsSource = "clip-text-model"`。运行时会校验该标记，
若为占位伪嵌入（`PLACEHOLDER`）会直接拒绝推理，避免"自信地随机猜"。

生成方式（开发期一次性，需联网；结果随仓库提供，运行时完全离线）：

```bash
cd scripts/_clip_text_gen
npm install
node generate-prompts.mjs --model all       # 等价于根目录 npm run gen:clip-prompts
```

脚本默认走 `https://hf-mirror.com/`（HF 直连在本环境不可达），可用 `CLIP_HF_ENDPOINT` 覆盖。
模型文件缓存于 `scripts/_clip_text_gen/.cache/`，已加入 `.gitignore`。
prompt 规则见 `scripts/_clip_text_gen/prompts-data.mjs`：仅英文、仅肯定句、每类 9~12 条。

## 标定配置

| 文件 | 说明 |
|------|------|
| `classification-calibration.json` | 温度、类别偏置、prompt 聚合、弃判阈值、置信度逻辑回归系数；由 `npm run calib:classify` 生成 |
| `similarity-calibration.json` | 相似检测的权重、综合分阈值、pHash/颜色硬门控、CLIP 语义阈值；由 `npm run calib:similarity` 生成 |
| `EVAL_BASELINE.md` | 分类评估方法、基线与实测结果 |
| `SIMILARITY_EVAL.md` | 相似检测评估方法、与旧 aHash 的对比、三档隔离说明 |

标定由 144 张标注图 + 5 折分层交叉验证得出，**不要手改阈值**；重新标定请用脚本。
相似检测复用同一批 144 张原图，通过程序化变换生成 1728 张正样本，
`semanticThreshold` 用 CLIP B/32 视觉模型单独标定（scene 档才需要该模型）。

## ONNX 文件名

| 模型 ID | 文件名 |
|---------|--------|
| clip_vit_b32_quant | clip-vit-b32-vision-quant.onnx |
| clip_vit_l14_quant | clip-vit-l14-vision-quant.onnx |
| efficientnet_b4（可选） | efficientnet-b4.onnx |

在应用内选择预设并下载，或执行 `npm run download:models`。
环境变量 `FILEDEAL_HF_ENDPOINT` 可改为其他 Hugging Face 镜像根地址。

## 评估与标定流水线

```bash
npm run fixtures:classify     # 从 Wikimedia Commons 下载 144 张带标签图片
npm run features:classify     # 提取模型中间特征（约 8 分钟，结果缓存）
npm run calib:classify        # 5 折交叉验证网格搜索 + 写回 calibration.json
npm run eval:classify-run     # 端到端真实管线评估（含 ECE 置信度校准误差）
```

`tests/fixtures/manifest.json` 是标签来源（相对路径，随仓库提供）；
图片、`features.json`、`candidates.json`、`eval-results.json` 均可重建，已忽略入库。
