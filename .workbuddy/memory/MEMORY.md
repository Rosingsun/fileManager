# 项目长期笔记

## 结构约定（2026-11-11 确立）

- 统一导出规则由 `npm run check:imports` 校验：跨层导入必须走 `src/{utils,hooks,stores,components}/index.ts`，禁止直连具体模块。
- 三类豁免：同一顶层目录内的兄弟模块引用、`src/components/ui/` shadcn 内部引用与 `@/lib/utils`、`src/utils/operationLog.ts` 对 `../stores/useAuthStore` 的动态 import（用于打断 utils ↔ stores 循环依赖）。
- `.env.development`、`models/clip-prompts*.json` 是仓库有意提交的文件，勿当误追踪产物清理；`out/` 下两个残留文件已取消追踪但本地保留。
- 根目录统一 npm（`package-lock.json`）；`backend/` 与 `scripts/_clip_text_gen/` 各自保留独立锁文件。
- 构建链现状（本轮未改）：electron-forge 与 electron-builder 并存；`vite.config.ts` 未被任何脚本引用，实际走 `electron.vite.config.ts`；`dev` 脚本的 `NODE_OPTIONS` 只对 `chcp` 生效。若后续收敛需完整打包验证。
- 类型检查存在约 140 个历史错误（IPC 回调类型、antd Slider、未使用变量、`src/types` 缺 ExifData/ColorInfo 等），与结构优化无关；修复需单独排期。

## 图片分类约定（2026-11-11 确立）

- `models/clip-prompts*.json` 必须是真实 CLIP 文本嵌入（`embeddingsSource=clip-text-model`）。
  伪嵌入会让 Top-1 退化到 12~13%（≈随机猜）；运行时会校验并拒绝加载。
- 本环境 HF 直连不通，CLIP 文本模型走 `https://hf-mirror.com/` + curl 预下载到
  `scripts/_clip_text_gen/.cache/`；生成脚本 `npm run gen:clip-prompts`。
- 分类器参数全部由 `npm run calib:classify`（144 张标注图 + 5 折 CV）写回
  `models/classification-calibration.json`，**禁止手改阈值**。
  离线打分公式与运行时 `scoreClipWithConfig` 必须严格一致。
- 完整流水线：`fixtures:classify` → `features:classify` → `calib:classify` → `eval:classify-run`；
  轻量体检 `npm run eval:classify`。评估标签来源 `tests/fixtures/manifest.json`（相对路径）。
- 交叉验证结论：ImageNet 1000→9 类融合会降准确率，最优权重 0，两个预设均不再加载辅助模型。
  当前端到端 Top-1：快速预览 88.2%、最高精准 91.7%。
- 判对可信度由逻辑回归校准，与 Top3「九类相对分布」语义不同，UI 需分别标注。
