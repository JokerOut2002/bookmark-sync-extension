# 书签同步浏览器插件

一个支持 WebDAV 云端同步的跨浏览器书签同步插件，适用于 Chrome 和 Edge。

## 功能特性

- 使用 Chrome Extension API 直接访问书签
- 支持 WebDAV 云端同步 (Nextcloud、坚果云等)
- 跨浏览器同步 (Chrome ↔ Edge)，自动映射不同浏览器的书签栏名称
- 支持增量恢复和全量覆盖两种恢复模式
- 备份文件管理（查看、恢复指定版本、删除）
- Popup 快速操作界面
- Options 详细设置页面

## 技术栈

- **前端**: React 19 + TypeScript
- **构建**: Vite + CRXJS
- **样式**: Tailwind CSS 4
- **WebDAV**: webdav npm 包
- **状态管理**: Zustand

## 开发

### 环境要求

- Node.js 22.16.0+
- npm 10+

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录。

## 安装插件

### 方式一：从 Release 下载

1. 前往 [Releases](https://github.com/caigq99/bookmark-sync-extension/releases) 页面
2. 下载最新版本的 `bookmark-sync-extension.zip`
3. 解压到本地目录
4. 按照下方"加载扩展程序"步骤操作

### 方式二：本地构建

1. 克隆仓库并构建
2. 按照下方"加载扩展程序"步骤操作

### 加载扩展程序

#### Chrome

1. 打开 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `dist` 目录（或解压后的目录）

#### Edge

1. 打开 `edge://extensions/`
2. 开启"开发人员模式"
3. 点击"加载解压缩的扩展"
4. 选择 `dist` 目录（或解压后的目录）

## 使用说明

### 1. 配置 WebDAV 服务器

1. 点击插件图标，点击"设置"按钮
2. 填写 WebDAV 服务器信息：
   - 服务器地址：`https://dav.jianguoyun.com/dav/` (坚果云示例)
   - 用户名
   - 密码（坚果云需使用应用密码）
3. 点击"测试连接"确认配置正确
4. 点击"保存设置"

### 2. 备份书签

点击插件图标，点击"备份到云端"按钮。备份文件会自动带上时间戳，格式如 `bookmarks_2025-01-15_143052.json`。

### 3. 恢复书签

1. 选择恢复模式：
   - **增量恢复**：只添加本地不存在的书签（推荐）
   - **全量覆盖**：删除所有现有书签后完整恢复（需二次确认）
2. 点击"从云端恢复"恢复最新备份
3. 或展开"备份列表"选择特定版本恢复

### 4. 跨浏览器同步

1. 在 Chrome 中配置 WebDAV 并备份书签
2. 在 Edge 中安装相同插件
3. 使用相同的 WebDAV 配置
4. 点击"从云端恢复"即可同步书签

插件会自动处理不同浏览器的书签栏名称差异（如 Chrome 的"书签栏"和 Edge 的"收藏夹栏"）。

## WebDAV 服务器推荐

- **坚果云**：国内云存储服务，提供 WebDAV 接口，免费版可用
- **Nextcloud**：开源自建云盘，支持 WebDAV
- **ownCloud**：开源云存储解决方案
- **Synology NAS**：群晖 NAS 自带 WebDAV 服务

## 安全说明

- WebDAV 密码存储在浏览器本地 (chrome.storage.sync)
- 建议使用 HTTPS 连接
- 数据完全由用户掌控，不经过第三方服务器
- 坚果云建议使用应用专用密码

## 项目结构

```
src/
├── background/          # Service Worker
│   └── index.ts        # 后台脚本
├── popup/              # Popup UI
│   ├── index.html
│   └── Popup.tsx       # 快速同步界面
├── options/            # Options Page
│   ├── index.html
│   └── Options.tsx     # 详细设置页面
├── manager/            # 书签管理页面
│   ├── index.html
│   └── Manager.tsx     # 书签浏览和管理
├── lib/
│   ├── bookmarks.ts    # Chrome Bookmarks API 封装
│   ├── webdav.ts       # WebDAV 客户端
│   ├── sync.ts         # 同步逻辑
│   └── utils.ts        # 工具函数
└── types/
    └── index.ts        # TypeScript 类型定义
```

## 许可证

MIT
