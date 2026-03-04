import { app, BrowserWindow, shell } from "electron";
import { join } from "path";
import { getPort } from "get-port-please";

let mainWindow: BrowserWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Open all external links in OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    // In production, spawn the standalone Next.js server
    const port = await getPort({ portRange: [30011, 50000] });

    const { startServer } = await import(
      join(app.getAppPath(), "app", "node_modules", "next", "dist", "server", "lib", "start-server.js")
      );

    await startServer({
      dir: join(app.getAppPath(), "app"),
      isDev: false,
      hostname: "localhost",
      port,
      allowRetry: false,
    });

    mainWindow.loadURL(`http://localhost:${port}`);
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
