import { app, BrowserWindow, shell, Menu } from "electron";
import { join } from "path";
import { spawn, ChildProcess } from "child_process";
import { getPort } from "get-port-please";

Menu.setApplicationMenu(null);

let mainWindow: BrowserWindow;
let nextServer: ChildProcess | null = null;

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

  // Open external links in OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
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

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  nextServer?.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  nextServer?.kill();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0)
    createWindow();
});
