import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { join } from "path";
import { existsSync, readdir, stat, mkdir, move } from "fs-extra";
import __cjs_url__ from "node:url";
import __cjs_path__ from "node:path";
import __cjs_mod__ from "node:module";
const __filename = __cjs_url__.fileURLToPath(import.meta.url);
const __dirname = __cjs_path__.dirname(__filename);
const require2 = __cjs_mod__.createRequire(import.meta.url);
let mainWindow = null;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1e3,
    minHeight: 600,
    frame: true,
    titleBarStyle: "default",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, "../../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
ipcMain.handle("dialog:openDirectory", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "选择要整理的目录"
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});
ipcMain.handle("fs:readDirectory", async (_event, path) => {
  try {
    if (!existsSync(path)) {
      return [];
    }
    const items = await readdir(path);
    const fileInfos = [];
    for (const item of items) {
      const fullPath = join(path, item);
      const stats = await stat(fullPath);
      fileInfos.push({
        name: item,
        path: fullPath,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modifiedTime: stats.mtime.getTime(),
        createdTime: stats.birthtime.getTime()
      });
    }
    return fileInfos.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error("读取目录失败:", error);
    throw error;
  }
});
ipcMain.handle("fs:organize", async (_event, config) => {
  try {
    const { sourcePath, rules, options } = config;
    const results = [];
    const items = await readdir(sourcePath);
    for (const item of items) {
      const sourceFile = join(sourcePath, item);
      const stats = await stat(sourceFile);
      if (stats.isDirectory() && !options.includeSubdirectories) {
        continue;
      }
      if (stats.isDirectory()) {
        continue;
      }
      let targetDir = sourcePath;
      if (rules.type === "extension") {
        const ext = item.split(".").pop()?.toLowerCase() || "other";
        targetDir = join(sourcePath, ext);
      } else if (rules.type === "date") {
        const date = new Date(stats.mtime);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        if (rules.dateFormat === "year") {
          targetDir = join(sourcePath, String(year));
        } else if (rules.dateFormat === "month") {
          targetDir = join(sourcePath, String(year), String(month));
        } else {
          targetDir = join(sourcePath, String(year), String(month), String(day));
        }
      } else if (rules.type === "size") {
        const sizeMB = stats.size / (1024 * 1024);
        let sizeCategory = "small";
        if (sizeMB > 100) sizeCategory = "large";
        else if (sizeMB > 10) sizeCategory = "medium";
        targetDir = join(sourcePath, sizeCategory);
      } else if (rules.type === "custom" && rules.pattern) {
        const match = item.match(new RegExp(rules.pattern));
        if (match && match[1]) {
          targetDir = join(sourcePath, match[1]);
        }
      }
      await mkdir(targetDir, { recursive: true });
      const targetFile = join(targetDir, item);
      let finalTargetFile = targetFile;
      if (existsSync(finalTargetFile) && options.conflictAction === "rename") {
        let counter = 1;
        const ext = item.split(".").pop();
        const nameWithoutExt = item.substring(0, item.lastIndexOf("."));
        while (existsSync(finalTargetFile)) {
          finalTargetFile = join(targetDir, `${nameWithoutExt}_${counter}.${ext}`);
          counter++;
        }
      }
      try {
        await move(sourceFile, finalTargetFile, { overwrite: options.conflictAction === "overwrite" });
        results.push({
          from: sourceFile,
          to: finalTargetFile,
          success: true
        });
      } catch (error) {
        results.push({
          from: sourceFile,
          to: finalTargetFile,
          success: false,
          error: error.message
        });
      }
    }
    return results;
  } catch (error) {
    console.error("整理文件失败:", error);
    throw error;
  }
});
ipcMain.handle("app:getVersion", () => {
  return app.getVersion();
});
ipcMain.handle("app:getPlatform", () => {
  return process.platform;
});
ipcMain.on("window:minimize", () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});
ipcMain.on("window:maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});
ipcMain.on("window:close", () => {
  if (mainWindow) {
    mainWindow.close();
  }
});
