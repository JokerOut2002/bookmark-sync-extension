import type { Bookmark, BookmarkTreeNode } from "../types";

/**
 * 跨浏览器顶级文件夹名称映射
 * 不同浏览器的顶级文件夹名称不同，需要互相映射
 */
const FOLDER_NAME_ALIASES: Record<string, string[]> = {
  // Chrome 中文
  书签栏: ["收藏夹栏", "Bookmarks bar", "Favorites bar", "书签栏"],
  其他书签: ["其他收藏夹", "Other bookmarks", "Other favorites", "其他书签"],
  移动设备书签: ["移动设备收藏夹", "Mobile bookmarks", "Mobile favorites", "移动设备书签"],
  // Edge 中文
  收藏夹栏: ["书签栏", "Bookmarks bar", "Favorites bar", "收藏夹栏"],
  其他收藏夹: ["其他书签", "Other bookmarks", "Other favorites", "其他收藏夹"],
  移动设备收藏夹: ["移动设备书签", "Mobile bookmarks", "Mobile favorites", "移动设备收藏夹"],
  // 英文 Chrome
  "Bookmarks bar": ["Favorites bar", "书签栏", "收藏夹栏", "Bookmarks bar"],
  "Other bookmarks": ["Other favorites", "其他书签", "其他收藏夹", "Other bookmarks"],
  "Mobile bookmarks": ["Mobile favorites", "移动设备书签", "移动设备收藏夹", "Mobile bookmarks"],
  // 英文 Edge
  "Favorites bar": ["Bookmarks bar", "书签栏", "收藏夹栏", "Favorites bar"],
  "Other favorites": ["Other bookmarks", "其他书签", "其他收藏夹", "Other favorites"],
  "Mobile favorites": ["Mobile bookmarks", "移动设备书签", "移动设备收藏夹", "Mobile favorites"],
};

/**
 * 根据备份中的文件夹名称，找到当前浏览器中匹配的顶级文件夹
 */
function findMatchingTopFolder(
  backupFolderName: string,
  topLevelMap: Map<string, chrome.bookmarks.BookmarkTreeNode>
): chrome.bookmarks.BookmarkTreeNode | undefined {
  // 直接匹配
  if (topLevelMap.has(backupFolderName)) {
    return topLevelMap.get(backupFolderName);
  }

  // 通过别名匹配
  const aliases = FOLDER_NAME_ALIASES[backupFolderName];
  if (aliases) {
    for (const alias of aliases) {
      if (topLevelMap.has(alias)) {
        return topLevelMap.get(alias);
      }
    }
  }

  // 反向查找：遍历当前浏览器的文件夹，看它的别名是否包含备份的名称
  for (const [localName, folder] of topLevelMap) {
    const localAliases = FOLDER_NAME_ALIASES[localName];
    if (localAliases && localAliases.includes(backupFolderName)) {
      return folder;
    }
  }

  return undefined;
}

/**
 * 获取所有书签（扁平化，用于统计）
 */
export async function getAllBookmarks(): Promise<Bookmark[]> {
  const tree = await chrome.bookmarks.getTree();
  const bookmarks: Bookmark[] = [];

  function traverse(nodes: chrome.bookmarks.BookmarkTreeNode[], folderPath = "") {
    for (const node of nodes) {
      if (node.url) {
        bookmarks.push({
          id: node.id,
          guid: node.id,
          title: node.title || "",
          url: node.url,
          folderPath,
          dateAdded: node.dateAdded || Date.now(),
          dateModified: node.dateGroupModified || node.dateAdded || Date.now(),
          isFolder: false,
          index: node.index,
        });
      } else if (node.children) {
        const newPath = folderPath ? `${folderPath}/${node.title}` : node.title || "";
        traverse(node.children, newPath);
      }
    }
  }

  traverse(tree);
  return bookmarks;
}

/**
 * 获取完整的书签树结构（用于备份）
 * 保留完整的层级和顺序信息
 */
export async function getBookmarkTree(): Promise<BookmarkTreeNode[]> {
  const tree = await chrome.bookmarks.getTree();

  function convertNode(node: chrome.bookmarks.BookmarkTreeNode): BookmarkTreeNode {
    const result: BookmarkTreeNode = {
      id: node.id,
      title: node.title || "",
      dateAdded: node.dateAdded || Date.now(),
      dateModified: node.dateGroupModified || node.dateAdded || Date.now(),
      index: node.index ?? 0,
    };

    if (node.url) {
      result.url = node.url;
    }

    if (node.children && node.children.length > 0) {
      result.children = node.children.map(convertNode);
    }

    return result;
  }

  // 返回根节点的 children（跳过虚拟根节点）
  if (tree[0]?.children) {
    return tree[0].children.map(convertNode);
  }
  return [];
}

/**
 * 恢复模式
 * - incremental: 增量恢复，只添加本地不存在的书签
 * - overwrite: 全量覆盖，先清空再恢复
 */
export type RestoreMode = "incremental" | "overwrite";

/**
 * 清空指定文件夹下的所有书签（用于全量覆盖模式）
 */
async function clearBookmarksInFolder(folderId: string): Promise<number> {
  let removedCount = 0;
  const children = await chrome.bookmarks.getChildren(folderId);

  for (const child of children) {
    try {
      if (child.url) {
        await chrome.bookmarks.remove(child.id);
        removedCount++;
      } else {
        // 文件夹：递归删除
        await chrome.bookmarks.removeTree(child.id);
        removedCount++;
      }
    } catch (err) {
      console.error(`[Restore] 删除失败: ${child.title}`, err);
    }
  }

  return removedCount;
}

/**
 * 从书签树恢复完整结构
 * 顶层节点会自动匹配 Chrome 的书签栏、其他书签等系统文件夹
 * @param treeNodes 备份的书签树
 * @param mode 恢复模式：incremental（增量）或 overwrite（全量覆盖）
 */
export async function restoreBookmarkTree(
  treeNodes: BookmarkTreeNode[],
  mode: RestoreMode = "incremental"
): Promise<number> {
  let addedCount = 0;

  // 获取 Chrome 书签的顶层结构（书签栏、其他书签等）
  const rootTree = await chrome.bookmarks.getTree();
  const rootChildren = rootTree[0]?.children || [];

  // 建立顶级文件夹的映射（如 "书签栏" -> id "1"）
  const topLevelMap = new Map<string, chrome.bookmarks.BookmarkTreeNode>();
  for (const child of rootChildren) {
    topLevelMap.set(child.title, child);
  }

  console.log("[Restore] 顶级文件夹:", Array.from(topLevelMap.keys()));
  console.log("[Restore] 恢复模式:", mode);

  // 遍历备份的顶层节点
  for (const node of treeNodes) {
    // 尝试匹配已有的顶级文件夹（支持跨浏览器名称映射）
    const existingFolder = findMatchingTopFolder(node.title, topLevelMap);

    if (existingFolder) {
      console.log(`[Restore] 匹配到顶级文件夹: ${node.title} -> ${existingFolder.title} (${existingFolder.id})`);

      // 全量覆盖模式：先清空该文件夹
      if (mode === "overwrite") {
        const removedCount = await clearBookmarksInFolder(existingFolder.id);
        console.log(`[Restore] 已清空文件夹 ${existingFolder.title}，删除 ${removedCount} 项`);
      }

      // 递归恢复该文件夹下的内容
      if (node.children && node.children.length > 0) {
        addedCount += await restoreBookmarkTreeRecursive(node.children, existingFolder.id);
      }
    } else {
      // 顶级文件夹不存在（理论上不会发生，因为书签栏等是系统文件夹）
      console.log(`[Restore] 顶级文件夹不存在: ${node.title}，跳过`);
    }
  }

  return addedCount;
}

/**
 * 递归恢复书签树结构
 */
async function restoreBookmarkTreeRecursive(
  treeNodes: BookmarkTreeNode[],
  parentId: string
): Promise<number> {
  let addedCount = 0;

  // 获取当前父节点下的所有子节点
  const existingChildren = await chrome.bookmarks.getChildren(parentId);
  const existingMap = new Map<string, chrome.bookmarks.BookmarkTreeNode>();

  for (const child of existingChildren) {
    // 用 title + url 或 title（文件夹）作为 key
    const key = child.url ? `${child.title}|${child.url}` : `folder:${child.title}`;
    existingMap.set(key, child);
  }

  // 按 index 排序处理
  const sortedNodes = [...treeNodes].sort((a, b) => a.index - b.index);

  for (const node of sortedNodes) {
    const key = node.url ? `${node.title}|${node.url}` : `folder:${node.title}`;
    const existing = existingMap.get(key);

    if (existing) {
      // 已存在，如果是文件夹则递归处理子节点
      if (node.children && node.children.length > 0) {
        addedCount += await restoreBookmarkTreeRecursive(node.children, existing.id);
      }
    } else {
      // 不存在，创建新节点
      if (node.url) {
        // 创建书签
        await chrome.bookmarks.create({
          parentId,
          title: node.title,
          url: node.url,
        });
        addedCount++;
        console.log(`[Restore] 创建书签: ${node.title}`);
      } else {
        // 创建文件夹
        const newFolder = await chrome.bookmarks.create({
          parentId,
          title: node.title,
        });
        console.log(`[Restore] 创建文件夹: ${node.title} -> ${newFolder.id}`);

        // 递归创建子节点
        if (node.children && node.children.length > 0) {
          addedCount += await restoreBookmarkTreeRecursive(node.children, newFolder.id);
        }
      }
    }
  }

  return addedCount;
}

/**
 * 创建书签
 */
export async function createBookmark(bookmark: Partial<Bookmark>, parentId = "1"): Promise<void> {
  await chrome.bookmarks.create({
    parentId,
    title: bookmark.title,
    url: bookmark.url,
  });
}

/**
 * 更新书签
 */
export async function updateBookmark(id: string, changes: Partial<Bookmark>): Promise<void> {
  await chrome.bookmarks.update(id, {
    title: changes.title,
    url: changes.url,
  });
}

/**
 * 删除书签
 */
export async function removeBookmark(id: string): Promise<void> {
  await chrome.bookmarks.remove(id);
}

/**
 * 监听书签变化
 */
export function watchBookmarkChanges(callback: () => void): void {
  chrome.bookmarks.onCreated.addListener(callback);
  chrome.bookmarks.onRemoved.addListener(callback);
  chrome.bookmarks.onChanged.addListener(callback);
  chrome.bookmarks.onMoved.addListener(callback);
}
