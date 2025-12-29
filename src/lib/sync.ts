import { getBookmarkTree, restoreBookmarkTree, type RestoreMode } from "./bookmarks";
import { uploadBookmarks, downloadBookmarks, type WebDAVConfig } from "./webdav";

/**
 * 备份书签到云端
 * 保存完整的树形结构，包括文件夹层级和顺序
 */
export async function backupToCloud(config: WebDAVConfig): Promise<string> {
  console.log("[Sync] 开始备份到云端");
  const bookmarkTree = await getBookmarkTree();
  console.log("[Sync] 书签树根节点数:", bookmarkTree.length);

  const fileName = await uploadBookmarks(bookmarkTree, config);
  console.log("[Sync] 备份完成:", fileName);
  return fileName;
}

/**
 * 从云端恢复书签
 * 恢复完整的树形结构，保持文件夹层级和顺序
 * @param config WebDAV 配置
 * @param fileName 可选，指定恢复的备份文件名，不指定则使用最新备份
 * @param mode 恢复模式：incremental（增量，默认）或 overwrite（全量覆盖）
 */
export async function restoreFromCloud(
  config: WebDAVConfig,
  fileName?: string,
  mode: RestoreMode = "incremental"
): Promise<number> {
  console.log("[Sync] 开始从云端恢复", fileName ? `文件: ${fileName}` : "最新备份", `模式: ${mode}`);

  const remoteTree = await downloadBookmarks(config, fileName);

  if (remoteTree.length === 0) {
    console.log("[Sync] 没有可恢复的书签（可能是旧版本格式，请先重新备份）");
    return 0;
  }

  console.log("[Sync] 远程书签树根节点数:", remoteTree.length);

  // 恢复书签树结构
  const addedCount = await restoreBookmarkTree(remoteTree, mode);

  console.log("[Sync] 恢复完成，新增书签:", addedCount);
  return addedCount;
}
