# 图片分类评估基线与实测结果

日期：2026-11-11 · 评估集：Wikimedia Commons 公开图片 144 张，9 类各 15~18 张
标签来源：`tests/fixtures/manifest.json`（相对路径，已随仓库提供）

## 结论速览

| 管线 | accuracy_fast (CLIP B/32) | accuracy_max (CLIP L/14) |
|------|--------------------------|--------------------------|
| 重构前（占位伪嵌入 + 旧参数） | **12.5%** | **13.2%** |
| 仅替换为真实文本嵌入 + 旧参数 | 87.5% | 90.3% |
| 5 折交叉验证（标定参数） | 88.2% | 91.0% |
| **端到端真实管线实测** | **88.2%** (127/144) | **91.7%** (132/144) |

随机猜测基线为 11.1%（1/9）。置信度校准误差 ECE：fast 0.0786、max 0.0121。

### 待复核队列

标定同时拟合了 `confidence.reviewBelow`（fast 0.8 / max 0.85）：判对可信度低于该值的结果
标记 `classificationStatus: uncertain`，在分类页「待人工复核」筛选里集中处理。
在 144 张评估集上约标记 20 张（14%），其中判错 4~5 张，覆盖约 1/3 的判错样本；
队列内错误率约 20~24%，是全量错误率（8~12%）的 2 倍多，便于把人工精力集中在最可能出错的图片上。

### 根因

1. `models/clip-prompts*.json` 原本是 FNV 哈希 + sin/cos 造的**伪嵌入**（文件内标注 `PLACEHOLDER`），
   类内 prompt 余弦仅 0.04（真实 CLIP 应为 0.7~0.9）。零样本分类等价于随机猜。
2. 预处理按 3 通道解析 `ensureAlpha()` 产出的 4 通道 RGBA，B 平面几乎没写入；
   且使用 letterbox 黑边，与 CLIP 官方 Resize + CenterCrop 不一致。
3. `temperature=0.058` 放大噪声，`top>=0.24` 即判 `ok`，页面置信度虚高。
4. 评估体系空转：0 张 fixture、基线全为 `—`、脚本 `import('.ts')` 失败后仍 `exit(0)`。

### 修复

- 用 `Xenova/clip-vit-base-patch32`、`Xenova/clip-vit-large-patch14` 的
  `CLIPTextModelWithProjection` 生成真实文本嵌入（HF 镜像预下载 + 本地加载），
  类内余弦提升到 0.90 / 0.79；prompt 全部改为英文肯定句，去掉否定式与中文。
- 预处理改为 EXIF 转正 → 短边等比缩放 → 中心裁剪 → 强制 3 通道 → CLIP 官方 mean/std。
- 打分改为「类别原型余弦 + 最相似 prompt 余弦」的加权、加**数据拟合的类别偏置**，
  softmax 温度/融合权重/弃判阈值全部由 5 折交叉验证搜索，不再手拍。
- 置信度改为在标注样本上拟合的逻辑回归，输出"判对概率"而非 softmax 相对概率。
- 运行时校验 `embeddingsSource` 与视觉/文本向量维度，防止模型错配或伪嵌入回退。

## 各类召回（端到端，accuracy_max）

| 类别 | 召回 | 主要误判 |
|------|------|----------|
| person | 100.0% | — |
| animal | 94.4% | landscape 1 |
| landscape | 93.3% | urban 1 |
| urban | 86.7% | indoor 1、vehicle 1 |
| indoor | 100.0% | — |
| food | 100.0% | — |
| vehicle | 88.9% | indoor 1、document 1 |
| document | 83.3% | indoor 1、person 1、other 1 |
| other | 80.0% | person 2、landscape 1 |

`other` 是兜底类，本身语义边界最模糊（产品图、抽象纹理），召回偏低属预期。

## 复现方法

```bash
npm run fixtures:classify                 # 下载评估图片（已缓存候选，可重复执行）
npm run features:classify                 # 提取 CLIP 嵌入 / ImageNet 九类概率
npm run calib:classify                    # 网格搜索 + 写回 models/classification-calibration.json
npm run eval:classify-run -- --json       # 端到端评估，明细写入 eval-results.json
npm run eval:classify-run -- --preset accuracy_max --limit 20
```

说明：

- 图片与 `features.json` 可重建，已加入 `.gitignore`；`manifest.json` 保留。
- `models/*.placeholder.json` 是本地留存的旧伪嵌入副本，仅用于重算重构前基线，已忽略入库。
- 交叉验证与端到端结果接近（88.2%/88.2%、91.0%/91.7%），说明参数没有明显过拟合。
- 若更换 prompt、模型或评估集，请重新跑完整流水线，不要直接复制本页数字。
