// 浏览器类型
export type BrowserType = 'Chrome' | 'Edge' | 'Custom';

// 浏览器信息
export interface BrowserInfo {
  id: string;
  name: string;
  browserType: BrowserType;
  profile: string;
  bookmarksPath: string;
  isRunning: boolean;
  bookmarkCount: number;
  lastSyncTime?: number;
}

// 书签数据（扁平化存储，包含文件夹）
export interface Bookmark {
  id: string;
  guid: string;
  title: string;
  url?: string;
  folderPath: string;
  dateAdded: number;
  dateModified: number;
  icon?: string;
  isFolder: boolean;
  index?: number; // 在父文件夹中的顺序
}

// 书签树节点（用于导出完整结构）
export interface BookmarkTreeNode {
  id: string;
  title: string;
  url?: string;
  dateAdded: number;
  dateModified: number;
  index: number;
  children?: BookmarkTreeNode[];
}

// 同步类型
export type SyncType = 'manual' | 'scheduled' | 'realtime';

// 同步状态
export type SyncStatus = 'success' | 'failed' | 'partial';

// 同步记录
export interface SyncRecord {
  id: number;
  sourceBrowser: string;
  targetBrowser: string;
  syncType: SyncType;
  syncTime: number;
  status: SyncStatus;
  addedCount: number;
  updatedCount: number;
  deletedCount: number;
  errorMessage?: string;
}

// 同步结果
export interface SyncResult {
  success: boolean;
  addedCount: number;
  updatedCount: number;
  deletedCount: number;
  errorMessage?: string;
}

// 同步进度
export interface SyncProgress {
  current: number;
  total: number;
  message: string;
}

// 冲突策略
export type ConflictStrategy = 'timestampWins' | 'sourceWins' | 'targetWins' | 'askUser';

// 同步配置
export interface SyncConfig {
  autoBackup: boolean;
  backupCount: number;
  realtimeEnabled: boolean;
  scheduleEnabled: boolean;
  scheduleCron: string;
  conflictStrategy: ConflictStrategy;
  debounceMs: number;
}
