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

每类至少放置 **20 张** 代表性 JPG/PNG/WebP，文件名任意。

## 快速填充样例（可选）

```bash
npm run bootstrap:fixtures
```

从 Wikimedia Commons 下载少量公开领域图片；正式评估建议自行补充更多易混淆样本。

## 运行评估

```bash
npm run eval:classify
npm run eval:classify-run
npm run eval:classify-run -- --preset accuracy_max
```

基线记录见 `models/EVAL_BASELINE.md`。

`run-classification-eval.mjs` 需在已安装 `onnxruntime-node` 的项目根目录执行，并确保对应 preset 的模型与 `clip-prompts*.json` 已就绪。
