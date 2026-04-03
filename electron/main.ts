import { app, BrowserWindow, shell, Menu, Tray, nativeImage, Notification, ipcMain, screen } from "electron";
import { join } from "path";
import { spawn, ChildProcess } from "child_process";
import { getPort } from "get-port-please";
import { lookup } from "dns";

Menu.setApplicationMenu(null);

let mainWindow: BrowserWindow;
let tray: Tray | null = null;
let nextServer: ChildProcess | null = null;
let isQuitting = false;
let minimizeToTray = true;

// Window control IPC handlers
ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:maximize", () => {
  if (mainWindow?.isMaximized())
    mainWindow.unmaximize();
  else
    mainWindow?.maximize();
});

ipcMain.on("window:close", () => {
  if (minimizeToTray) {
    mainWindow?.hide();
  } else {
    isQuitting = true;
    app.quit();
  }
});

ipcMain.on("tray:setMinimizeToTray", (_, value: boolean) => {
  minimizeToTray = value;
});

ipcMain.on("notification:send", (_, title: string, body: string, channelId: string, messageId: string) => {
  if (!Notification.isSupported() || mainWindow?.isFocused())
    return;

  const notification = new Notification({
    title,
    body,
    icon: getIconPath(),
  });

  notification.on("click", () => {
    showWindow();
    mainWindow.webContents.send("notification:clicked", { channelId, messageId });
  });

  notification.show();
});

ipcMain.on("become-sentient", () => {
  console.log("[become-sentient] IPC received");

  const win = mainWindow;
  if (!win) {
    console.error("[become-sentient] No mainWindow — aborting");
    return;
  }

  const display = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = display.workAreaSize;
  const [ww, wh] = win.getSize();
  let [x, y] = win.getPosition();

  console.log(`[become-sentient] Screen: ${sw}x${sh}, Window: ${ww}x${wh}, Position: (${x}, ${y})`);

  let dx: number = 8, dy: number = 6;
  const duration = 10000;
  const start: number = Date.now();
  let ticks = 0;

  const interval = setInterval(() => {
    const elapsed = Date.now() - start;
    if (elapsed >= duration) {
      console.log(`[become-sentient] Done after ${ticks} ticks`);
      clearInterval(interval);
      return;
    }

    // Apply velocity to movement
    x += dx;
    y += dy;

    // Bounce off of screen edges
    if (x <= 0 || x + ww >= sw) {
      dx = -dx;
      x = Math.max(0, Math.min(x, sw - ww));
    }
    if (y <= 0 || y + wh >= sh) {
      dy = -dy;
      y = Math.max(0, Math.min(y, sh - wh));
    }

    if (ticks < 5 || ticks % 60 === 0) {
      console.log(`[become-sentient] tick=${ticks} elapsed=${elapsed}ms pos=(${Math.round(x)}, ${Math.round(y)}) vel=(${dx}, ${dy})`);
    }

    // Move window
    win.setPosition(Math.round(x), Math.round(y));
    ticks++;
  }, 16); // ~60 FPS
});

// Connectivity check: DNS lookup is lightweight and works without a full HTTP
// round-trip. Resolves true if we can reach the internet, false otherwise.
ipcMain.handle("net:isOnline", () =>
  new Promise<boolean>((resolve) => {
    lookup("supabase.com", (err) => resolve(!err));
  })
);

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
        HOSTNAME: "127.0.0.1",
        ELECTRON_RUN_AS_NODE: "1",
        // Disable Next.js telemetry. without this, Next.js attempts outbound
        // network requests on startup that cause a 30s timeout when offline.
        NEXT_TELEMETRY_DISABLED: "1",
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
        await fetch(`http://127.0.0.1:${port}`);
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

  // Open DevTools in development
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  // Open external links in OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Intercept the close button: hide to tray instead of quitting,
  // unless we're doing a real quit (e.g. from the tray menu or app.quit() or if close to tray setting is off).
  mainWindow.on("close", (event) => {
    if (!isQuitting && minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
    } else if (!isQuitting) {
      isQuitting = true;
      app.quit();
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
