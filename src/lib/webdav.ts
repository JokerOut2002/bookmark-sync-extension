import { createClient, WebDAVClient } from "webdav";
import type { BookmarkTreeNode } from "../types";

export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
}

const SYNC_DIR = "bookmark-sync";

/**
 * 生成带时间戳的文件名
 * 格式: bookmarks_2025-01-15_143052.json
 */
function generateBackupFileName(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // 2025-01-15
  const time = now.toTimeString().slice(0, 8).replace(/:/g, ""); // 143052
  return `bookmarks_${date}_${time}.json`;
}

let client: WebDAVClient | null = null;

/**
 * 连接 WebDAV 服务器
 */
export function connectWebDAV(config: WebDAVConfig): WebDAVClient {
  client = createClient(config.url, {
    username: config.username,
    password: config.password,
  });
  return client;
}

/**
 * 测试连接
 */
export async function testConnection(config: WebDAVConfig): Promise<boolean> {
  try {
    const testClient = connectWebDAV(config);
    await testClient.getDirectoryContents("/");
    return true;
  } catch {
    return false;
  }
}

/**
 * 确保同步目录存在，不存在则创建
 * 坚果云: 201 Created 表示创建成功，405 Method Not Allowed 表示目录已存在
 */
async function ensureSyncDirectory(client: WebDAVClient): Promise<void> {
  try {
    console.log("[WebDAV] 尝试创建目录:", SYNC_DIR);
    await client.createDirectory(SYNC_DIR);
    console.log("[WebDAV] 目录创建成功 (201)");
  } catch (error) {
    // 405 表示目录已存在，可以忽略
    if (error instanceof Error && (error.message.includes("405") || error.message.includes("Method Not Allowed"))) {
      console.log("[WebDAV] 目录已存在 (405)，继续");
    } else {
      console.error("[WebDAV] 创建目录失败:", error);
      throw error;
    }
  }
}

/**
 * 上传书签到 WebDAV
 * 用户提供基础路径如 https://dav.jianguoyun.com/dav/
 * 自动在后面拼接 bookmark-sync 目录
 * 文件名带时间戳，如 bookmarks_2025-01-15_143052.json
 */
export async function uploadBookmarks(bookmarkTree: BookmarkTreeNode[], config: WebDAVConfig): Promise<string> {
  console.log("[WebDAV] 开始上传书签树");

  const webdavClient = createClient(config.url, {
    username: config.username,
    password: config.password,
  });

  const fileName = generateBackupFileName();
  const data = JSON.stringify({
    version: 2, // 版本号，标识新格式
    bookmarkTree,
    lastSync: Date.now(),
    fileName,
  });

  try {
    // 先创建 bookmark-sync 目录（201 成功，405 已存在）
    await ensureSyncDirectory(webdavClient);

    // 上传文件到 bookmark-sync/bookmarks_时间戳.json
    const filePath = `${SYNC_DIR}/${fileName}`;
    console.log("[WebDAV] 上传路径:", filePath);
    await webdavClient.putFileContents(filePath, data, {
      overwrite: true,
    });
    console.log("[WebDAV] 上传成功");
    return fileName;
  } catch (error) {
    console.error("[WebDAV] 上传失败:", error);
    throw new Error(`上传失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 备份文件信息
 */
export interface BackupInfo {
  fileName: string;
  filePath: string;
  lastModified: Date;
  size: number;
}

/**
 * 获取所有备份文件列表
 */
export async function getBackupList(config: WebDAVConfig): Promise<BackupInfo[]> {
  console.log("[WebDAV] 获取备份列表");

  const webdavClient = createClient(config.url, {
    username: config.username,
    password: config.password,
  });

  try {
    const contents = await webdavClient.getDirectoryContents(SYNC_DIR);
    const files = (Array.isArray(contents) ? contents : contents.data) as Array<{
      basename: string;
      filename: string;
      lastmod: string;
      size: number;
      type: string;
    }>;

    // 过滤出 bookmarks_*.json 文件并按时间倒序排列
    const backups = files
      .filter((file) => file.type === "file" && file.basename.startsWith("bookmarks_") && file.basename.endsWith(".json"))
      .map((file) => ({
        fileName: file.basename,
        filePath: file.filename,
        lastModified: new Date(file.lastmod),
        size: file.size,
      }))
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

    console.log("[WebDAV] 找到备份文件:", backups.length);
    return backups;
  } catch (error) {
    console.error("[WebDAV] 获取备份列表失败:", error);
    if (error instanceof Error && error.message.includes("404")) {
      return [];
    }
    throw error;
  }
}

/**
 * 从 WebDAV 下载书签树
 * 默认下载最新的备份文件
 */
export async function downloadBookmarks(config: WebDAVConfig, fileName?: string): Promise<BookmarkTreeNode[]> {
  console.log("[WebDAV] 开始下载书签", { url: config.url, fileName });

  const webdavClient = createClient(config.url, {
    username: config.username,
    password: config.password,
  });

  try {
    let targetFile = fileName;

    // 如果没有指定文件名，获取最新的备份
    if (!targetFile) {
      const backups = await getBackupList(config);
      if (backups.length === 0) {
        console.log("[WebDAV] 没有找到备份文件");
        return [];
      }
      targetFile = backups[0].fileName;
    }

    const filePath = `${SYNC_DIR}/${targetFile}`;
    console.log("[WebDAV] 下载路径:", filePath);
    const content = await webdavClient.getFileContents(filePath, { format: "text" });
    const data = JSON.parse(content as string);

    // 兼容新旧格式
    if (data.version === 2 && data.bookmarkTree) {
      console.log("[WebDAV] 下载成功（v2 树形格式）");
      return data.bookmarkTree;
    } else if (data.bookmarks) {
      // 旧格式：扁平化书签，需要转换（简单处理：返回空，提示用户重新备份）
      console.log("[WebDAV] 检测到旧版本格式，建议重新备份");
      return [];
    }

    return [];
  } catch (error) {
    console.error("[WebDAV] 下载失败:", error);
    if (error instanceof Error && error.message.includes("404")) {
      console.log("[WebDAV] 文件不存在，返回空数组");
    }
    return [];
  }
}

/**
 * 检查是否存在备份文件
 */
export async function fileExists(config: WebDAVConfig): Promise<boolean> {
  try {
    const backups = await getBackupList(config);
    return backups.length > 0;
  } catch {
    return false;
  }
}

/**
 * 删除备份文件
 */
export async function deleteBackup(config: WebDAVConfig, fileName: string): Promise<void> {
  console.log("[WebDAV] 删除备份:", fileName);

  const webdavClient = createClient(config.url, {
    username: config.username,
    password: config.password,
  });

  try {
    const filePath = `${SYNC_DIR}/${fileName}`;
    await webdavClient.deleteFile(filePath);
    console.log("[WebDAV] 删除成功");
  } catch (error) {
    console.error("[WebDAV] 删除失败:", error);
    throw new Error(`删除失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}
