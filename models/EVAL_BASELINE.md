# 图片分类评估基线

用于记录 `npm run eval:classify-run` 的 Top-1 准确率，便于重构前后对比。

## 准备 fixtures

```bash
node scripts/bootstrap-classification-fixtures.mjs
# 或手动在 tests/fixtures/images/{9类}/ 每类放入 ≥20 张 JPG/PNG
```

## 运行评估

```bash
npm run eval:classify
npx tsx scripts/run-classification-eval.mjs
npx tsx scripts/run-classification-eval.mjs --preset accuracy_max
```

## 基线记录（重构前 / 后）

| 预设 | Top-1 | 样本数 | 日期 | 备注 |
|------|-------|--------|------|------|
| accuracy_fast | — | — | — | CLIP B/32，无 ImageNet |
| accuracy_max | — | — | — | CLIP L/14 + 条件 ImageNet |
| accuracy_light（旧） | — | — | — | 已映射到 accuracy_fast |
| accuracy_balanced（旧） | — | — | — | 已映射到 accuracy_max |

**验收目标（有充足 fixtures 后）：** `accuracy_max` Top-1 相对旧管线提升 ≥10 个百分点；人物/动物、风景/城市建筑混淆率明显下降。

## 重构后管线要点

- CLIP 为主；仅当 top1 概率或 margin 不足时以约 20% 权重融合 ImageNet Top-K
- 成对消歧一层；置信度门控产出 `classificationStatus: ok | uncertain | failed`
- 参数见 `models/classification-calibration.json`
