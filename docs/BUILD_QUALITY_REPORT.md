# 打包与构建质量报告

**生成日期：** 2026-05-27  
**项目：** file-organizer v1.0.0  
**平台：** Windows 10 x64  
**执行命令：** `npm run build` → `npm run pack`

---

## 1. 结论摘要

| 项 | 结果 |
|----|------|
| 生产构建 (`electron-vite build`) | ✅ 通过 |
| 桌面打包 (`electron-builder`) | ✅ 通过（exit 0） |
| 产物路径 | `release/win-unpacked/` |
| 阻塞性错误 | **无** |
| 需立即修复项 | **无**（见下文建议项） |

打包流程可正常产出可运行的 Windows 目录版安装包；未发现导致构建/打包失败的错误。

---

## 2. 构建产物

### 2.1 主进程 / 预加载

| 文件 | 约大小 |
|------|--------|
| `dist-electron/main/main.js` | 843 KB |
| `dist-electron/preload/preload.mjs` | 12 KB |

主进程 SSR 包构建约 8.9s，含分类管线相关模块（`classification/*`）已打入 bundle。

### 2.2 渲染进程

| 文件 | 约大小 |
|------|--------|
| `dist/assets/index-*.js` | ~6.9 MB |
| `dist/assets/index-*.css` | ~245 KB |

渲染包体积偏大，主要为 React + Ant Design + ECharts 等依赖；属预期范围，后续可考虑路由级 code-split 或按需加载图表库以优化首屏。

### 2.3 打包输出

| 项 | 值 |
|----|-----|
| 可执行文件 | `release/win-unpacked/FileOrganizer.exe` |
| exe 大小 | ~169 MB |
| `win-unpacked` 目录总大小 | ~1.13 GB（含 Electron 运行时、原生模块、asar） |
| asar | `resources/app.asar` 已生成 |
| exiftool 解包 | `resources/app.asar.unpacked/node_modules/exiftool-vendored.exe/` |

---

## 3. 构建/打包告警（非阻塞）

### 3.1 Vite 构建

```
useAuthStore.ts 被 operationLog.ts 动态导入，同时被 stores/index.ts 静态导入；
动态 import 不会将该模块拆到独立 chunk。
```

**影响：** 仅影响 chunk 拆分策略，不影响运行。  
**建议：** 统一为静态导入，或让 `operationLog` 通过 store 注入避免循环依赖式动态 import。

### 3.2 electron-builder

| 告警 | 说明 | 建议 |
|------|------|------|
| `cannot find path for dependency name=undefined` | electron-builder 26.4.0 已知类告警，复打包后仍可能出现 | 不影响产物；可忽略或待 electron-builder 升级后复验 |
| `default Electron icon is used` | `build/icon.ico` 不存在或未生效 | 补充 `build/icon.ico` 并在 `build.win.icon` 中引用 |
| 代码签名 | 使用 signtool 签名 exiftool 子进程 | 开发环境正常；发布需配置正式证书 |

---

## 4. TypeScript 静态检查（`tsc --noEmit`）

| 指标 | 值 |
|------|-----|
| 错误总数 | **约 150** |
| 与本次构建关系 | **不阻塞** — `electron-vite` 使用 esbuild 转译，未将 `tsc` 作为构建门禁 |

**主要类别：**

1. **新增分类模块**（`electron/main/classification/calibration.ts`）：`deepMerge` 泛型与 `ClipScoringConfig` 等接口的 `Record<string, unknown>` 约束不匹配（约 8 处）。
2. **IPC 处理器**（`main.ts`）：`(...args: unknown[])` 与具名参数类型不兼容（历史遗留）。
3. **前端**：未使用变量（`TS6133`）、Ant Design Slider 扩展属性、部分 `window.electronAPI` 可能为 `undefined` 等。

**建议：** 在 CI 中分阶段启用 `tsc --noEmit`；优先修复 `classification/` 与 `ImageClassification` 相关类型，再逐步清理 `main.ts` IPC 类型。

---

## 5. 图片分类能力（与打包相关）

| 项 | 状态 |
|----|------|
| 分类管线代码 | 已编入 `dist-electron/main/main.js` |
| `models/classification-calibration.json` | 存在于源码树；**未**打入 asar（按设计在运行时从项目根 / 工作目录读取） |
| ONNX / CLIP 权重 | 需用户通过 `npm run download:models` 或应用内下载至 `models/` |
| 评估 fixtures | `tests/fixtures/images/` 仅有 README，**尚无样本图** |
| 评估基线 | `models/EVAL_BASELINE.md` 中 Top-1 尚未填写 |

打包后首次使用「精准度较高」等预设时，需确保 `models/` 下对应 ONNX 已下载，否则分类功能会降级或提示缺模型（属运行时行为，非打包错误）。

---

## 6. 依赖与安全

- **原生模块：** `sharp`、`onnxruntime-node` 等在 `@electron/rebuild` 阶段已成功重装。
- **Electron 版本：** 28.3.3（与 package.json `^28.1.0` 一致）。
- **打包包含范围：** 仅 `dist/**/*` 与 `dist-electron/**/*`；`backend/`、测试、脚本未进入安装包（符合桌面端定位）。

---

## 7. 建议后续行动（按优先级）

1. **P1 — 应用图标：** 添加 `build/icon.ico`，消除默认 Electron 图标。
2. **P2 — 类型债：** 修复 `calibration.ts` 的 `deepMerge` 类型；为 IPC 注册封装类型安全的 wrapper。
3. **P3 — 体积优化：** 渲染 bundle code-split；评估 ECharts 按需引入。
4. **P4 — 分类验收：** 运行 `npm run bootstrap:fixtures` 填充 fixtures 后执行 `npm run eval:classify-run`，将结果写入 `EVAL_BASELINE.md`。
5. **P5 — CI：** 增加 `npm run build` 门禁；可选增加 `npm run pack` 冒烟（headless 或 artifact 存在性检查）。

---

## 8. 体积优化记录（2026-05-27）

| 指标 | 优化前 | 优化后 | 变化 |
|------|--------|--------|------|
| `win-unpacked` 总大小 | ~1134 MB | **~378 MB** | **约 −67%** |
| `app.asar` | ~583 MB | **~14 MB** | 移除重复打入的 UI / TF 依赖 |
| `app.asar.unpacked` | ~300 MB | **~113 MB** | ONNX 仅保留 win32/x64 |
| 主进程 bundle `main.js` | ~843 KB | **~121 KB** | 移除 TensorFlow 外链 |

**措施摘要：**

1. 仅主进程运行时依赖保留在 `dependencies`（`sharp`、`onnxruntime-node`、`exiftool-vendored` 等）；React / Ant Design / ECharts 等移至 `devDependencies`（已由 Vite 打入 `dist/`）。
2. 删除已废弃的 `@tensorflow/*` 与 `cognivisionTfClassifier`。
3. `afterPack` 脚本 `scripts/prune-packaged-onnx.mjs` 裁剪 ONNX 非当前平台二进制。
4. 渲染进程 `manualChunks` 拆分 `antd` / `echarts`；用户中心图表懒加载。

---

## 9. 复现命令

```bash
npm run build
npm run pack
# 或一步：npm run dist
```

产物验证：启动 `release\win-unpacked\FileOrganizer.exe`，检查文件浏览、图片分类入口与模型下载提示是否正常。

---

*本报告由自动化构建检查生成，反映 2026-05-27 当次构建环境。*
