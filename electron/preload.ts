import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
  setMinimizeToTray: (value: boolean) => ipcRenderer.send("tray:setMinimizeToTray", value),
  notify: (title: string, body: string, channelId: string, messageId: string) =>
      ipcRenderer.send("notification:send", title, body, channelId, messageId),
  onNotificationClick: (callback: (channelId: string, messageId: string) => void) =>
      ipcRenderer.on("notification:clicked", (_, data) => callback(data.channelId, data.messageId)),
  checkOnline: (): Promise<boolean> => ipcRenderer.invoke("net:isOnline"),
});
