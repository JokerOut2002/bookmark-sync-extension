import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Save, TestTube, CheckCircle, XCircle } from "lucide-react";
import { testConnection, type WebDAVConfig } from "../lib/webdav";
import { cn } from "../lib/utils";
import "../index.css";

function Options() {
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [autoSync, setAutoSync] = useState(false);
  const [syncInterval, setSyncInterval] = useState(30);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const result = await chrome.storage.sync.get([
      "webdavConfig",
      "autoSync",
      "syncInterval",
    ]);

    if (result.webdavConfig) {
      setUrl(result.webdavConfig.url || "");
      setUsername(result.webdavConfig.username || "");
      setPassword(result.webdavConfig.password || "");
    }

    setAutoSync(result.autoSync || false);
    setSyncInterval(result.syncInterval || 30);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);

    const config: WebDAVConfig = { url, username, password };
    const result = await testConnection(config);

    setTestResult(result);
    setTesting(false);
  }

  async function handleSave() {
    setSaving(true);

    const config: WebDAVConfig = { url, username, password };

    await chrome.storage.sync.set({
      webdavConfig: config,
      autoSync,
      syncInterval,
    });

    setSaved(true);
    setSaving(false);

    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">书签同步设置</h1>
          <p className="text-slate-600">配置 WebDAV 服务器和同步选项</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">WebDAV 配置</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                服务器地址
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-webdav-server.com"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleTest}
              disabled={testing || !url || !username || !password}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-slate-200 hover:bg-slate-300 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <TestTube className="w-4 h-4" />
              {testing ? "测试中..." : "测试连接"}
            </button>

            {testResult !== null && (
              <div
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg",
                  testResult
                    ? "bg-green-50 border border-green-200 text-green-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                )}
              >
                {testResult ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>连接成功!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>连接失败,请检查配置</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">自动备份设置</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-slate-900">定时自动备份</h3>
                <p className="text-sm text-slate-500">自动将本地书签备份到云端</p>
              </div>
              <button
                onClick={() => setAutoSync(!autoSync)}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors",
                  autoSync ? "bg-blue-500" : "bg-slate-300"
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                    autoSync ? "left-7" : "left-1"
                  )}
                />
              </button>
            </div>

            {autoSync && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  备份间隔 (分钟)
                </label>
                <input
                  type="number"
                  min="1"
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(Number(e.target.value) || 30)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg",
              "bg-blue-500 text-white hover:bg-blue-600 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <Save className="w-5 h-5" />
            {saving ? "保存中..." : saved ? "已保存!" : "保存设置"}
          </button>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">使用说明</h3>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>• <strong>备份到云端</strong>：将本地书签上传到 WebDAV 服务器</li>
            <li>• <strong>从云端恢复</strong>：从服务器下载书签并添加到本地</li>
            <li>• 每次备份都会生成带时间戳的文件，可随时恢复历史版本</li>
            <li>• 支持 Nextcloud、坚果云等 WebDAV 服务</li>
            <li>• 建议使用 HTTPS 连接保证安全</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Options />
  </StrictMode>
);
