import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  // 文件系统操作
  openDirectory: () => ipcRenderer.invoke("dialog:openDirectory"),
  readDirectory: (path) => ipcRenderer.invoke("fs:readDirectory", path),
  organizeFiles: (config) => ipcRenderer.invoke("fs:organize", config),
  // 应用功能
  getAppVersion: () => ipcRenderer.invoke("app:getVersion"),
  getPlatform: () => ipcRenderer.invoke("app:getPlatform"),
  // 窗口控制
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  maximizeWindow: () => ipcRenderer.send("window:maximize"),
  closeWindow: () => ipcRenderer.send("window:close")
});
