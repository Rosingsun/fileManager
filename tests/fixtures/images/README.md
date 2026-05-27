# 图片分类 fixtures

用于 `scripts/run-classification-eval.mjs` 自动化 Top-1 评估。

## 目录结构

```
tests/fixtures/images/
├── person/
├── animal/
├── landscape/
├── urban/
├── indoor/
├── food/
├── vehicle/
├── document/
└── other/
```

每类至少放置 **10 张** 代表性 JPG/PNG/WebP，文件名任意。

## 运行评估

```bash
node scripts/eval-classification.mjs
node scripts/run-classification-eval.mjs
node scripts/run-classification-eval.mjs --preset accuracy_balanced
```

`run-classification-eval.mjs` 需在已安装 `onnxruntime-node` 的项目根目录执行，并确保对应 preset 的模型与 `clip-prompts*.json` 已就绪。
