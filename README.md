# 文件整理工具

跨平台桌面文件整理工具，使用 Electron + React + TypeScript + Vite 构建。

## 功能特性

- 📁 智能文件分类整理
- 🎨 现代化 UI 界面（Ant Design 5）
- ⚡ 高性能文件处理
- 🔄 实时预览整理结果
- 🎯 多种分类规则支持
  - 按文件类型（扩展名）
  - 按修改日期（年/月/日）
  - 按文件大小（大/中/小）
  - 自定义正则表达式规则

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

这将启动 Electron 应用和 Vite 开发服务器。

#### Windows 用户

在 Windows 系统上，您可以双击运行 `dev.bat` 文件，或在命令提示符/PowerShell 中执行：

```bash
dev.bat
```

或

```powershell
.\dev.bat
```

这将执行相同的开发启动命令。

### 构建应用

```bash
# 构建生产版本
npm run build

# 打包为可执行文件
npm run dist
```

## 项目结构

```
file-organizer/
├── electron/           # Electron 主进程代码
│   ├── main/          # 主进程入口和 IPC 处理器
│   └── preload/       # 预加载脚本
├── src/               # React 渲染进程
│   ├── components/    # React 组件
│   ├── hooks/         # 自定义 Hooks
│   ├── stores/        # 状态管理（Zustand）
│   ├── utils/         # 工具函数
│   └── types/         # TypeScript 类型定义
└── public/            # 静态资源
```

## 技术栈

- **Electron 28+** - 跨平台桌面应用框架
- **React 18+** - UI 框架
- **TypeScript 5+** - 类型安全
- **Vite 5+** - 构建工具
- **Ant Design 5+** - UI 组件库
- **Zustand** - 轻量级状态管理
- **fs-extra** - 文件系统操作
- **chokidar** - 文件监视

## 使用说明

1. **选择目录**：点击"选择目录"按钮，选择要整理的文件夹
2. **选择分类方式**：在控制面板中选择分类规则
3. **预览结果**：点击"预览整理结果"查看文件移动预览
4. **开始整理**：确认无误后点击"开始整理"执行文件整理

## 注意事项

- 整理操作会移动文件，请确保重要文件已备份
- 建议先使用预览功能确认整理结果
- 支持冲突处理：跳过、覆盖或重命名

## 开发计划

- [ ] 支持拖拽选择目录
- [ ] 文件操作历史记录
- [ ] 撤销功能
- [ ] 深色/浅色主题切换
- [ ] 批量重命名功能
- [ ] 设置页面

