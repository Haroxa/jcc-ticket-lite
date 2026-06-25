# 10 Cloudflare 部署操作说明

## 1. 文档来源

本说明参考：

- `P:\CODE\Test\JCC\JCC-Web-MVP\local-secrets\Cloudflare操作说明指南.md`
- Cloudflare Workers Static Assets 文档
- Cloudflare D1 Migrations 文档
- Cloudflare Pages Functions Bindings 文档

注意：

- 本文档不记录 Token、Account ID、数据库 ID 等敏感信息。
- 本项目正式创建资源后，只记录资源名称和绑定名称。
- 密钥仍应放在本机用户环境变量、Cloudflare Dashboard Secret 或被 Git 忽略的 `local-secrets/` 中。

## 2. 推荐部署形态

优先方案：

```text
Cloudflare Workers Static Assets + Worker API + D1
```

原因：

- 前端静态资源和 API 由同一个 Worker 项目提供。
- Cookie 同域处理简单。
- 项目比 JCC Web 更轻，不需要拆成复杂部署形态。
- Cloudflare 当前支持 Worker 同时托管静态资源和 API。

备选方案：

```text
Cloudflare Pages + Pages Functions + D1
```

适用情况：

- 希望完全复用 JCC Web 的 Pages 自动部署习惯。
- 希望通过 Pages 后台连接 Git 分支自动构建。

## 3. 建议 Cloudflare 资源命名

Worker 项目：

```text
jcc-ticket-lite
```

D1 数据库：

```text
jcc_ticket_lite
```

D1 绑定：

```text
DB
```

生产 Secret：

```text
SESSION_SECRET
ADMIN_INIT_TOKEN
```

可选环境变量：

```text
APP_NAME=JCC 存票管理
PUBLIC_BOARD_ENABLED=true
```

## 4. 本机环境变量检查

JCC Web 项目已经使用过这些用户级环境变量：

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
http_proxy
https_proxy
```

检查方式：

```powershell
[Environment]::GetEnvironmentVariable("CLOUDFLARE_API_TOKEN", "User")
[Environment]::GetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", "User")
[Environment]::GetEnvironmentVariable("http_proxy", "User")
[Environment]::GetEnvironmentVariable("https_proxy", "User")
```

如果当前终端没有读取到，可临时设置：

```powershell
$env:CLOUDFLARE_API_TOKEN = [Environment]::GetEnvironmentVariable("CLOUDFLARE_API_TOKEN", "User")
$env:CLOUDFLARE_ACCOUNT_ID = [Environment]::GetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", "User")
$env:http_proxy = [Environment]::GetEnvironmentVariable("http_proxy", "User")
$env:https_proxy = [Environment]::GetEnvironmentVariable("https_proxy", "User")
```

JCC Web 当前记录的代理端口是：

```text
127.0.0.1:7897
```

如果 Wrangler 网络失败，优先检查代理端口是否被改回旧值。

## 5. Token 权限建议

最小权限建议：

```text
Account -> D1 -> Edit
Account -> Workers Scripts -> Edit
Account -> Account Settings -> Read
```

如果使用 Pages 备选方案，再增加：

```text
Account -> Cloudflare Pages -> Edit
```

验证 Token：

```powershell
$token = [Environment]::GetEnvironmentVariable("CLOUDFLARE_API_TOKEN", "User")
Invoke-RestMethod `
  -Uri "https://api.cloudflare.com/client/v4/user/tokens/verify" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Method Get
```

成功时应返回 `success = True`。

## 6. 正式项目初始化命令

进入正式项目目录：

```powershell
cd "P:\CODE\Test\JCC\JCC Table\JCC-Ticket-Cloudflare-Lite\app"
```

安装依赖：

```powershell
npm install
```

本地开发：

```powershell
npm run dev
```

构建：

```powershell
npm run build
```

Worker 本地预览：

```powershell
npm run preview
```

## 7. 创建 D1 数据库

创建远程 D1：

```powershell
npx wrangler d1 create jcc_ticket_lite
```

命令执行后会返回 `database_id`，将其写入 `wrangler.jsonc`。

示例：

```jsonc
{
  "name": "jcc-ticket-lite",
  "main": "src/worker/index.ts",
  "compatibility_date": "2026-06-25",
  "assets": {
    "directory": "./dist"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "jcc_ticket_lite",
      "database_id": "填写实际生成的 database_id"
    }
  ]
}
```

## 8. D1 迁移

创建迁移文件：

```powershell
npx wrangler d1 migrations create jcc_ticket_lite init
```

本地执行迁移：

```powershell
npm run db:migrate:local
```

远程执行迁移：

```powershell
npm run db:migrate:remote
```

查看远程迁移状态：

```powershell
npx wrangler d1 migrations list jcc_ticket_lite --remote
```

注意：

- 本地迁移成功不代表线上数据库已更新。
- 只要线上接口依赖新表或新字段，就必须执行远程迁移。
- 远程迁移前先确认 `npm run build` 通过。

## 9. 建议 package scripts

```json
{
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "preview": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:migrate:local": "wrangler d1 migrations apply jcc_ticket_lite --local",
    "db:migrate:remote": "wrangler d1 migrations apply jcc_ticket_lite --remote",
    "db:list:remote": "wrangler d1 migrations list jcc_ticket_lite --remote"
  }
}
```

## 10. 部署步骤

推荐顺序：

1. 检查环境变量。
2. 安装依赖。
3. 执行类型检查。
4. 执行构建。
5. 执行本地 D1 迁移。
6. 本地预览 API 和页面。
7. 执行远程 D1 迁移。
8. 设置生产 Secret。
9. 执行部署。
10. 检查线上登录、录入、公开榜。

命令：

```powershell
npm run build
npm run db:migrate:local
npm run preview
npm run db:migrate:remote
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_INIT_TOKEN
npm run deploy
```

## 11. 上线后检查清单

- 登录页可以打开。
- 管理员可以登录。
- 工作台汇总正常。
- 快速录入只能选择正常存票人。
- 取用超过余额会被拒绝。
- 存票人页面显示正常、停用、拉黑全部状态。
- 停用和拉黑不进入内部排行。
- 公开榜无需登录。
- 公开榜只显示正常且余额大于 0。
- 作废记录不计入余额。
- 恢复记录重新计入余额。
- 操作日志能看到关键动作。
- 手机、平板、电脑布局都可用。

## 12. 常见问题

### Wrangler 提示缺少 Token

处理：

```powershell
$env:CLOUDFLARE_API_TOKEN = [Environment]::GetEnvironmentVariable("CLOUDFLARE_API_TOKEN", "User")
```

### Wrangler 无法识别 Account ID

处理：

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = [Environment]::GetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", "User")
```

如果用户环境变量不存在，需要到 Cloudflare Dashboard 复制 Account ID。

### fetch failed 或代理错误

检查：

```powershell
Get-ChildItem Env: | Where-Object { $_.Name -match "proxy" }
```

如果端口不对，临时修正：

```powershell
$env:http_proxy = "http://127.0.0.1:7897"
$env:https_proxy = "http://127.0.0.1:7897"
```

### 线上 API 报数据库表不存在

原因通常是远程 D1 没有迁移。

处理：

```powershell
npm run db:migrate:remote
```

### 页面正常但 API 返回 401

检查：

- Cookie 是否写入。
- `SESSION_SECRET` 是否配置。
- session 是否过期。
- 线上和本地是否访问同一域名。

### 公开榜显示了不该显示的人

检查 `/api/public/board` 后端过滤条件：

```text
status = normal
cached_balance > 0
```

不要只在前端过滤，公开接口必须后端过滤。

## 13. 安全原则

- 不提交 Token。
- 不提交 `database_id` 以外的密钥。
- 不把 `SESSION_SECRET` 写进源码。
- 不使用明文密码。
- 操作日志不记录密码、Token、Session 原文。
- 公开接口只返回公开字段。
