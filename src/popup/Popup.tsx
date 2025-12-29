import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Upload, Download, Settings, CheckCircle, XCircle, Archive, ChevronDown, ChevronUp, Trash2, BookOpen } from "lucide-react";
import { getAllBookmarks } from "../lib/bookmarks";
import type { RestoreMode } from "../lib/bookmarks";
import { backupToCloud, restoreFromCloud } from "../lib/sync";
import { type WebDAVConfig, getBackupList, type BackupInfo, deleteBackup } from "../lib/webdav";
import { cn } from "../lib/utils";
import "../index.css";

function Popup() {
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("incremental");
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [config, setConfig] = useState<WebDAVConfig | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [showBackups, setShowBackups] = useState(false);
  const [loadingBackups, setLoadingBackups] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const bookmarks = await getAllBookmarks();
    setBookmarkCount(bookmarks.length);

    const result = await chrome.storage.sync.get(["webdavConfig", "lastSync"]);
    setConfig(result.webdavConfig || null);
    setLastSync(result.lastSync || null);
  }

  async function loadBackups() {
    if (!config) return;

    setLoadingBackups(true);
    try {
      const list = await getBackupList(config);
      setBackups(list);
    } catch (err) {
      console.error("Failed to load backups:", err);
    } finally {
      setLoadingBackups(false);
    }
  }

  async function toggleBackups() {
    const willShow = !showBackups;
    setShowBackups(willShow);
    // 每次展开时都从远端刷新列表
    if (willShow) {
      await loadBackups();
    }
  }

  async function handleBackup() {
    if (!config) {
      setError("请先配置 WebDAV 服务器");
      return;
    }

    setSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      const fileName = await backupToCloud(config);
      const now = Date.now();
      await chrome.storage.sync.set({ lastSync: now });
      setLastSync(now);
      setSuccess(`备份成功: ${fileName}`);
      // 刷新备份列表
      if (showBackups) {
        await loadBackups();
      }
    } catch (err) {
      console.error("Backup error:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
    } finally {
      setSyncing(false);
    }
  }

  async function handleRestore(fileName?: string) {
    if (!config) {
      setError("请先配置 WebDAV 服务器");
      return;
    }

    // 全量覆盖模式需要二次确认
    if (restoreMode === "overwrite") {
      if (!confirm("全量覆盖将删除所有现有书签，确定继续吗？")) {
        return;
      }
    }

    setRestoring(true);
    setError(null);
    setSuccess(null);

    try {
      const addedCount = await restoreFromCloud(config, fileName, restoreMode);
      await loadData(); // 刷新本地书签数量
      const modeText = restoreMode === "overwrite" ? "全量覆盖" : "增量";
      setSuccess(`${modeText}恢复成功，新增 ${addedCount} 个书签`);
    } catch (err) {
      console.error("Restore error:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
    } finally {
      setRestoring(false);
    }
  }

  async function handleDelete(fileName: string) {
    if (!config) return;

    if (!confirm(`确定要删除备份 ${fileName} 吗？`)) {
      return;
    }

    setDeleting(fileName);
    setError(null);
    setSuccess(null);

    try {
      await deleteBackup(config, fileName);
      setSuccess("删除成功");
      await loadBackups();
    } catch (err) {
      console.error("Delete error:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
    } finally {
      setDeleting(null);
    }
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  function openManager() {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/manager/index.html") });
  }

  return (
    <div className="w-80 p-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900 mb-1">书签同步工具</h1>
        <p className="text-sm text-slate-600">跨浏览器书签同步</p>
      </div>

      <div className="bg-white rounded-lg p-4 mb-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-600">本地书签</span>
          <span className="text-lg font-semibold text-slate-900">{bookmarkCount}</span>
        </div>
        {lastSync && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <CheckCircle className="w-3 h-3" />
            <span>上次同步: {new Date(lastSync).toLocaleString()}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <XCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>{success}</span>
          </div>
        </div>
      )}

      {!config && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-amber-800">请先配置 WebDAV 服务器</p>
        </div>
      )}

      <div className="flex gap-2 mb-2">
        <button
          onClick={handleBackup}
          disabled={syncing || restoring || !config}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg",
            "bg-blue-500 text-white hover:bg-blue-600 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Upload className={cn("w-4 h-4", syncing && "animate-pulse")} />
          {syncing ? "备份中..." : "备份到云端"}
        </button>
        <button
          onClick={openOptions}
          className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 transition-colors"
          title="设置"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={openManager}
          className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 transition-colors"
          title="书签管理"
        >
          <BookOpen className="w-4 h-4" />
        </button>
      </div>

      {/* 恢复模式选择 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-slate-600">恢复模式:</span>
        <div className="flex-1 flex gap-1">
          <button
            onClick={() => setRestoreMode("incremental")}
            disabled={restoring}
            className={cn(
              "flex-1 px-2 py-1 text-xs rounded transition-colors",
              restoreMode === "incremental"
                ? "bg-green-500 text-white"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300",
              "disabled:opacity-50"
            )}
          >
            增量恢复
          </button>
          <button
            onClick={() => setRestoreMode("overwrite")}
            disabled={restoring}
            className={cn(
              "flex-1 px-2 py-1 text-xs rounded transition-colors",
              restoreMode === "overwrite"
                ? "bg-red-500 text-white"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300",
              "disabled:opacity-50"
            )}
          >
            全量覆盖
          </button>
        </div>
      </div>

      <button
        onClick={() => handleRestore()}
        disabled={syncing || restoring || !config}
        className={cn(
          "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg",
          "bg-green-500 text-white hover:bg-green-600 transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <Download className={cn("w-4 h-4", restoring && "animate-pulse")} />
        {restoring ? "恢复中..." : "从云端恢复"}
      </button>

      {/* 备份列表 */}
      {config && (
        <div className="mt-3">
          <button
            onClick={toggleBackups}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors w-full"
          >
            <Archive className="w-4 h-4" />
            <span>备份列表</span>
            {showBackups ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
          </button>

          {showBackups && (
            <div className="mt-2 bg-white rounded-lg shadow-sm max-h-48 overflow-y-auto">
              {loadingBackups ? (
                <div className="p-3 text-center text-sm text-slate-500">加载中...</div>
              ) : backups.length === 0 ? (
                <div className="p-3 text-center text-sm text-slate-500">暂无备份</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {backups.map((backup) => (
                    <li key={backup.fileName} className="p-2 hover:bg-slate-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-900 truncate">{backup.fileName}</div>
                          <div className="flex gap-3 text-xs text-slate-500 mt-1">
                            <span>{backup.lastModified.toLocaleString()}</span>
                            <span>{(backup.size / 1024).toFixed(1)} KB</span>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => handleRestore(backup.fileName)}
                            disabled={restoring || deleting !== null}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                          >
                            恢复
                          </button>
                          <button
                            onClick={() => handleDelete(backup.fileName)}
                            disabled={restoring || deleting !== null}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
                          >
                            {deleting === backup.fileName ? <Trash2 className="w-3 h-3 animate-pulse" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>
);
