import { watchBookmarkChanges } from "../lib/bookmarks";
import { backupToCloud } from "../lib/sync";
import type { WebDAVConfig } from "../lib/webdav";

console.log("Background service worker started");

// 监听书签变化
watchBookmarkChanges(() => {
  console.log("Bookmark changed, triggering auto backup...");
  handleAutoBackup();
});

// 定时备份
chrome.alarms.create("autoBackup", { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "autoBackup") {
    handleAutoBackup();
  }
});

// 监听设置变化,更新定时器
chrome.storage.onChanged.addListener((changes) => {
  if (changes.autoSync || changes.syncInterval) {
    updateBackupAlarm();
  }
});

async function handleAutoBackup() {
  const result = await chrome.storage.sync.get(["webdavConfig", "autoSync"]);

  if (!result.autoSync || !result.webdavConfig) {
    return;
  }

  try {
    await backupToCloud(result.webdavConfig as WebDAVConfig);
    await chrome.storage.sync.set({ lastSync: Date.now() });
    console.log("Auto backup completed");
  } catch (error) {
    console.error("Auto backup failed:", error);
  }
}

async function updateBackupAlarm() {
  const result = await chrome.storage.sync.get(["autoSync", "syncInterval"]);

  chrome.alarms.clear("autoBackup");

  if (result.autoSync) {
    const interval = result.syncInterval || 30;
    chrome.alarms.create("autoBackup", { periodInMinutes: interval });
    console.log(`Auto backup enabled with interval: ${interval} minutes`);
  }
}

// 初始化时更新定时器
updateBackupAlarm();
