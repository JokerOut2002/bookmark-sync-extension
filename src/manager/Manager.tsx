import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  FolderOpen,
  Folder,
  FileText,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  X,
  Save,
  ArrowLeft,
  CheckSquare,
  Square,
} from "lucide-react";
import { cn } from "../lib/utils";
import "../index.css";

interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  parentId?: string;
  index?: number;
  children?: BookmarkNode[];
}

interface EditingBookmark {
  id?: string;
  parentId: string;
  title: string;
  url: string;
  isFolder: boolean;
  isNew: boolean;
}

function Manager() {
  const [bookmarkTree, setBookmarkTree] = useState<BookmarkNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["1", "2"]));
  const [editing, setEditing] = useState<EditingBookmark | null>(null);
  const [selectedFolder] = useState<string>("1");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  useEffect(() => {
    loadBookmarks();
  }, []);

  async function loadBookmarks() {
    setLoading(true);
    try {
      const tree = await chrome.bookmarks.getTree();
      if (tree[0]?.children) {
        setBookmarkTree(tree[0].children as BookmarkNode[]);
      }
    } catch (err) {
      console.error("Failed to load bookmarks:", err);
      showMessage("error", "加载书签失败");
    } finally {
      setLoading(false);
    }
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  function toggleFolder(id: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function startAddBookmark(parentId: string, isFolder: boolean) {
    setEditing({
      parentId,
      title: "",
      url: "",
      isFolder,
      isNew: true,
    });
  }

  function startEditBookmark(node: BookmarkNode) {
    setEditing({
      id: node.id,
      parentId: node.parentId || "1",
      title: node.title,
      url: node.url || "",
      isFolder: !node.url,
      isNew: false,
    });
  }

  async function saveBookmark() {
    if (!editing) return;

    if (!editing.title.trim()) {
      showMessage("error", "标题不能为空");
      return;
    }

    if (!editing.isFolder && !editing.url.trim()) {
      showMessage("error", "URL 不能为空");
      return;
    }

    try {
      if (editing.isNew) {
        // 新增
        if (editing.isFolder) {
          await chrome.bookmarks.create({
            parentId: editing.parentId,
            title: editing.title.trim(),
          });
        } else {
          await chrome.bookmarks.create({
            parentId: editing.parentId,
            title: editing.title.trim(),
            url: editing.url.trim(),
          });
        }
        showMessage("success", editing.isFolder ? "文件夹创建成功" : "书签创建成功");
      } else if (editing.id) {
        // 修改
        await chrome.bookmarks.update(editing.id, {
          title: editing.title.trim(),
          url: editing.isFolder ? undefined : editing.url.trim(),
        });
        showMessage("success", "修改成功");
      }

      setEditing(null);
      await loadBookmarks();
    } catch (err) {
      console.error("Save bookmark failed:", err);
      showMessage("error", `保存失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function deleteBookmark(node: BookmarkNode) {
    const isFolder = !node.url;
    const confirmMsg = isFolder
      ? `确定要删除文件夹「${node.title}」及其所有内容吗？`
      : `确定要删除书签「${node.title}」吗？`;

    if (!confirm(confirmMsg)) return;

    try {
      if (isFolder) {
        await chrome.bookmarks.removeTree(node.id);
      } else {
        await chrome.bookmarks.remove(node.id);
      }
      showMessage("success", "删除成功");
      await loadBookmarks();
    } catch (err) {
      console.error("Delete bookmark failed:", err);
      showMessage("error", `删除失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function batchDelete() {
    if (selectedIds.size === 0) {
      showMessage("error", "请先选择要删除的书签");
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个书签/文件夹吗？`)) return;

    try {
      for (const id of selectedIds) {
        try {
          await chrome.bookmarks.removeTree(id);
        } catch {
          await chrome.bookmarks.remove(id);
        }
      }
      showMessage("success", `成功删除 ${selectedIds.size} 个项目`);
      setSelectedIds(new Set());
      setSelectMode(false);
      await loadBookmarks();
    } catch (err) {
      console.error("Batch delete failed:", err);
      showMessage("error", `批量删除失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function renderBookmarkNode(node: BookmarkNode, depth: number = 0): React.ReactNode {
    const isFolder = !node.url;
    const isExpanded = expandedFolders.has(node.id);
    const isSystemFolder = node.id === "0" || node.id === "1" || node.id === "2";
    const isSelected = selectedIds.has(node.id);

    return (
      <div key={node.id} className="select-none">
        <div
          className={cn(
            "flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-100 transition-colors group",
            depth > 0 && "ml-4",
            isSelected && "bg-blue-50"
          )}
        >
          {/* 选择模式下的复选框 */}
          {selectMode && !isSystemFolder && (
            <button
              onClick={() => toggleSelect(node.id)}
              className="p-0.5"
            >
              {isSelected ? (
                <CheckSquare className="w-5 h-5 text-blue-500" />
              ) : (
                <Square className="w-5 h-5 text-slate-400" />
              )}
            </button>
          )}

          {isFolder ? (
            <button
              onClick={() => toggleFolder(node.id)}
              className="flex items-center gap-2 flex-1 text-left"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-5 h-5 text-yellow-500" />
              ) : (
                <Folder className="w-5 h-5 text-yellow-500" />
              )}
              <span className="text-slate-900 font-medium truncate">{node.title || "(无标题)"}</span>
              {node.children && (
                <span className="text-xs text-slate-400">({node.children.length})</span>
              )}
            </button>
          ) : (
            <a
              href={node.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 flex-1 text-left"
            >
              <span className="w-4 h-4" />
              <FileText className="w-5 h-5 text-blue-500" />
              <span className="text-slate-700 truncate">{node.title || "(无标题)"}</span>
            </a>
          )}

          {/* 操作按钮 - 非选择模式下显示 */}
          {!selectMode && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isFolder && (
                <>
                  <button
                    onClick={() => startAddBookmark(node.id, false)}
                    className="p-1.5 rounded hover:bg-blue-100 text-blue-600"
                    title="新增书签"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => startAddBookmark(node.id, true)}
                    className="p-1.5 rounded hover:bg-yellow-100 text-yellow-600"
                    title="新增文件夹"
                  >
                    <Folder className="w-4 h-4" />
                  </button>
                </>
              )}
              {!isSystemFolder && (
                <>
                  <button
                    onClick={() => startEditBookmark(node)}
                    className="p-1.5 rounded hover:bg-green-100 text-green-600"
                    title="编辑"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteBookmark(node)}
                    className="p-1.5 rounded hover:bg-red-100 text-red-600"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 子节点 */}
        {isFolder && isExpanded && node.children && (
          <div className="border-l border-slate-200 ml-5">
            {node.children.map((child) => renderBookmarkNode(child as BookmarkNode, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.close()}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-xl font-bold text-slate-900">书签管理</h1>
          </div>
          <div className="flex gap-2">
            {selectMode ? (
              <>
                <button
                  onClick={batchDelete}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  删除选中 ({selectedIds.size})
                </button>
                <button
                  onClick={exitSelectMode}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                  取消
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelectMode(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  批量删除
                </button>
                <button
                  onClick={() => startAddBookmark(selectedFolder, false)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  新增书签
                </button>
                <button
                  onClick={() => startAddBookmark(selectedFolder, true)}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  <Folder className="w-4 h-4" />
                  新增文件夹
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 消息提示 */}
      {message && (
        <div
          className={cn(
            "fixed top-20 right-6 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2",
            message.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
          )}
        >
          {message.text}
        </div>
      )}

      {/* 主内容 */}
      <main className="max-w-5xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-slate-500">加载中...</div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-4">
            {bookmarkTree.map((node) => renderBookmarkNode(node as BookmarkNode))}
          </div>
        )}
      </main>

      {/* 编辑弹窗 */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editing.isNew
                  ? editing.isFolder
                    ? "新增文件夹"
                    : "新增书签"
                  : editing.isFolder
                    ? "编辑文件夹"
                    : "编辑书签"}
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">标题</label>
                <input
                  type="text"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="输入标题"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              {!editing.isFolder && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
                  <input
                    type="url"
                    value={editing.url}
                    onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                    placeholder="https://example.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveBookmark}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Manager />
  </StrictMode>
);
