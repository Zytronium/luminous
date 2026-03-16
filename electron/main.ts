import { app, BrowserWindow, shell, Menu, Tray, nativeImage, ipcMain } from "electron";
import { join } from "path";
import { spawn, ChildProcess } from "child_process";
import { getPort } from "get-port-please";

Menu.setApplicationMenu(null);

let mainWindow: BrowserWindow;
let tray: Tray | null = null;
let nextServer: ChildProcess | null = null;
let isQuitting = false;

// Window control IPC handlers
ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:maximize", () => {
  if (mainWindow?.isMaximized())
    mainWindow.unmaximize();
  else
    mainWindow?.maximize();
});
ipcMain.on("window:close", () => mainWindow?.hide());

async function startNextServer(): Promise<number> {
  const port = await getPort({ portRange: [30011, 50000] });
  const appDir = join(process.resourcesPath, "app");
  const serverScript = join(appDir, "server.js");

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Next.js server timed out")), 30000);

    nextServer = spawn(process.execPath, [serverScript], {
      cwd: appDir,
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: "production",
        HOSTNAME: "localhost",
        ELECTRON_RUN_AS_NODE: "1",
      },
      stdio: "pipe",
    });

    nextServer.stdout?.on("data", (data: Buffer) => {
      console.log("[next]", data.toString());
    });

    nextServer.stderr?.on("data", (data: Buffer) => {
      console.error("[next error]", data.toString());
    });

    nextServer.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    // Poll until the server is accepting connections
    const interval = setInterval(async () => {
      try {
        await fetch(`http://localhost:${port}`);
        clearTimeout(timeout);
        clearInterval(interval);
        resolve(port);
      } catch {
        // Not ready yet, keep polling
      }
    }, 250);
  });
}

function getIconPath(): string {
  if (process.env.NODE_ENV === "development") {
    return join(__dirname, "../resources/icon.png");
  }
  return join(process.resourcesPath, "icon.png");
}

function getTrayIconPath(): string {
  if (process.env.NODE_ENV === "development") {
    return join(__dirname, "../resources/tray-icon.png");
  }
  return join(process.resourcesPath, "tray-icon.png");
}

function showWindow() {
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const icon = nativeImage.createFromPath(getTrayIconPath()).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("Luminous");

  // Context menu is the primary interaction on Linux (click events are unreliable).
  // It also serves as the right-click menu on Windows.
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Luminous",
      click: () => showWindow(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // On Windows, a single click on the tray icon should toggle the window.
  // On Linux this event may not fire depending on the desktop environment,
  // which is why the context menu above is the reliable fallback.
  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
    }
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: "hidden", // remove native app title bar
    icon: getIconPath(),
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Open external links in OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Intercept the close button: hide to tray instead of quitting,
  // unless we're doing a real quit (e.g. from the tray menu or app.quit()).
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    try {
      const port = await startNextServer();
      mainWindow.loadURL(`http://localhost:${port}`);
    } catch (err) {
      console.error("Failed to start Next.js server:", err);
      app.quit();
    }
  }
}

app.whenReady().then(async () => {
  await createWindow();
  createTray();
});

app.on("window-all-closed", () => {
  // Don't quit when all windows are closed; we're a tray app.
  // The user quits explicitly via the tray menu.
  // Exception: quit normally on platforms that don't have a tray convention (none currently).
  if (process.platform !== "darwin") {
    // Intentionally do nothing, keep running in tray.
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  nextServer?.kill();
});

app.on("activate", () => {
  // macOS: re-create window if dock icon is clicked and no windows are open
  if (BrowserWindow.getAllWindows().length === 0)
    createWindow();
});
