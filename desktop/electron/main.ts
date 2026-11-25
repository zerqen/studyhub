import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, shell, Tray } from "electron";
import path from "node:path";
import { QUICK_ADD_SHORTCUT } from "./constants";
import { NotificationScheduler } from "./notifications";
import { DesktopRepository } from "./repository";
import { DesktopStore } from "./store";
import type { DesktopPrefs } from "./types";

let mainWindow: BrowserWindow | null = null;
let quickAddWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let store: DesktopStore;
let repo: DesktopRepository;
let notifier: NotificationScheduler;

function appIconPath(): string {
  return path.join(__dirname, "icon.png");
}

function loadRenderer(win: BrowserWindow, hash?: string): void {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void win.loadURL(hash ? `${devUrl}#${hash}` : devUrl);
  } else {
    void win.loadFile(path.join(__dirname, "../dist/index.html"), hash ? { hash } : undefined);
  }
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 920,
    minHeight: 620,
    title: "StudyHub",
    icon: appIconPath(),
    autoHideMenuBar: true,
    backgroundColor: "#f3f1ec",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    const isLocalFile = url.startsWith("file://");
    const isDev = devUrl && url.startsWith(devUrl);
    if (!isLocalFile && !isDev) {
      event.preventDefault();
    }
  });

  win.on("close", (event) => {
    if (!isQuitting && repo.getState().prefs.minimizeToTray) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on("closed", () => {
    mainWindow = null;
  });

  loadRenderer(win);
  return win;
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createQuickAddWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 560,
    height: 220,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    icon: appIconPath(),
    backgroundColor: "#fffefb",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.on("blur", () => {
    if (win.isVisible()) win.hide();
  });

  win.on("closed", () => {
    quickAddWindow = null;
  });

  loadRenderer(win, "quick-add");
  return win;
}

function toggleQuickAdd(): void {
  if (!repo.getState().session.isLoggedIn) {
    showMainWindow();
    return;
  }
  if (!quickAddWindow || quickAddWindow.isDestroyed()) {
    quickAddWindow = createQuickAddWindow();
    quickAddWindow.once("ready-to-show", () => {
      quickAddWindow?.center();
      quickAddWindow?.show();
      quickAddWindow?.focus();
    });
    return;
  }
  if (quickAddWindow.isVisible()) {
    quickAddWindow.hide();
  } else {
    quickAddWindow.center();
    quickAddWindow.show();
    quickAddWindow.focus();
  }
}

function setupTray(): void {
  const icon = nativeImage.createFromPath(appIconPath());
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("StudyHub Desktop");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Открыть StudyHub", click: () => showMainWindow() },
      { label: "Быстрая задача (Ctrl+Shift+Space)", click: () => toggleQuickAdd() },
      { label: "Синхронизировать сейчас", click: () => void repo.syncNow() },
      { type: "separator" },
      {
        label: "Выйти полностью",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => showMainWindow());
}

function registerIpc(): void {
  ipcMain.handle("state:get", () => repo.getState());
  ipcMain.handle("auth:login", (_e, email: string, password: string) => repo.login(email, password));
  ipcMain.handle("auth:logout", () => repo.logout());
  ipcMain.handle("sync:now", () => repo.syncNow());

  ipcMain.handle("task:toggle", (_e, id: string) => repo.toggleTaskDone(id));
  ipcMain.handle("task:postpone", (_e, id: string) => repo.postponeTaskToTomorrow(id));
  ipcMain.handle("task:create", (_e, input) => repo.createTask(input));
  ipcMain.handle("task:update", (_e, id: string, patch) => repo.updateTask(id, patch));
  ipcMain.handle("task:delete", (_e, id: string) => repo.deleteTask(id));

  ipcMain.handle("subtask:add", (_e, taskId: string, title: string) => repo.addSubtask(taskId, title));
  ipcMain.handle("subtask:toggle", (_e, taskId: string, subId: string) => repo.toggleSubtaskDone(taskId, subId));
  ipcMain.handle("subtask:delete", (_e, subId: string) => repo.deleteSubtask(subId));

  ipcMain.handle("question:review", (_e, id: string, grade: number) => repo.reviewQuestion(id, grade));

  ipcMain.handle("note:create", (_e, input) => repo.createNote(input));
  ipcMain.handle("note:update", (_e, id: string, input) => repo.updateNote(id, input));
  ipcMain.handle("note:delete", (_e, id: string) => repo.deleteNote(id));

  ipcMain.handle("lecture:create", (_e, input) => repo.createLecture(input));
  ipcMain.handle("lecture:update", (_e, id: string, input) => repo.updateLecture(id, input));
  ipcMain.handle("lecture:delete", (_e, id: string) => repo.deleteLecture(id));
  ipcMain.handle("lecture:transcribe", (_e, lectureId: string, attId: string) =>
    repo.transcribeLectureAudio(lectureId, attId),
  );

  ipcMain.handle("file:pickUpload", (_e, parentType: string | null, parentId: string | null, mode?: "all" | "audio") =>
    repo.pickAndUploadAttachment(parentType, parentId, mode ?? "all"),
  );
  ipcMain.handle("file:uploadPath", (_e, parentType: string | null, parentId: string | null, filePath: string) =>
    repo.uploadAttachmentFromPath(parentType, parentId, filePath),
  );
  ipcMain.handle("file:open", (_e, id: string) => repo.openAttachment(id));
  ipcMain.handle("file:reveal", (_e, id: string) => repo.revealAttachment(id));
  ipcMain.handle("file:delete", (_e, id: string) => repo.deleteAttachment(id));
  ipcMain.handle("file:clearCache", () => repo.clearFileCache());

  ipcMain.handle("prefs:update", (_e, patch: Partial<DesktopPrefs>) => repo.updatePrefs(patch));
  ipcMain.handle("notif:test", () => notifier.sendTest());
  ipcMain.handle("window:hideQuickAdd", () => quickAddWindow?.hide());
  ipcMain.handle("window:focusMain", () => showMainWindow());
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.setAppUserModelId("ru.studyhub.desktop");
  app.on("second-instance", () => showMainWindow());

  void app.whenReady().then(() => {
    store = new DesktopStore();
    repo = new DesktopRepository(store);
    notifier = new NotificationScheduler(store, () => showMainWindow());

    repo.onChange((state) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send("state:changed", state);
        }
      }
    });

    registerIpc();
    mainWindow = createMainWindow();
    setupTray();
    notifier.start();
    globalShortcut.register(QUICK_ADD_SHORTCUT, toggleQuickAdd);

    if (repo.getState().session.isLoggedIn) {
      void repo.syncNow();
    }

    setInterval(() => {
      if (repo.getState().session.isLoggedIn) {
        void repo.syncNow();
      }
    }, 10 * 60_000);
  });

  app.on("before-quit", () => {
    isQuitting = true;
    notifier?.stop();
    globalShortcut.unregisterAll();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin" && isQuitting) {
      app.quit();
    }
  });
}
