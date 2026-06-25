# JCC Ticket Cloudflare Lite App

正式项目第一阶段骨架。

## 当前已完成

- React + TypeScript + Vite 前端入口。
- Cloudflare Worker 入口。
- `/api/health` 健康检查接口。
- 真实登录、退出、当前用户接口。
- 本地管理员初始化接口。
- 存票人列表、新增、状态修改接口。
- 存取流水新增、查询、作废、恢复接口。
- 工作台汇总接口。
- 操作日志接口。
- 公开存票榜接口。
- Workers Static Assets 配置草案。
- D1 初始迁移文件。
- 后台页面、公开榜页面和多端基础布局。

## 常用命令

```powershell
npm install
npm run typecheck
npm run build
npm run dev
npm run preview
```

本地全栈预览优先使用：

```powershell
npm run build
npm run preview
```

当前本地 Worker 预览地址：

```text
http://127.0.0.1:8787
```

## 本地开发账号

本地 `.dev.vars` 已提供开发初始化令牌：

```text
ADMIN_INIT_TOKEN=dev-init-token
```

已在本地 D1 初始化过管理员：

```text
username: admin
password: admin123456
```

正式部署时必须重新设置 Cloudflare Secret，不要沿用开发令牌。

## 下一步

1. 使用 Wrangler 创建远程 D1 数据库。
2. 将生成的 `database_id` 写入 `wrangler.jsonc`。
3. 执行远程 D1 迁移。
4. 设置生产 `SESSION_SECRET` 和 `ADMIN_INIT_TOKEN`。
5. 继续完善导入导出、计算工具正式组件和页面细节。

## Cloudflare 状态

已完成：

- 远程 D1 数据库 `jcc_ticket_lite` 已创建。
- `wrangler.jsonc` 已写入远程 `database_id`。
- 远程 D1 已执行 `0001_init.sql` 迁移。
- Worker Secret 已设置。
- Worker 已部署到 `workers.dev`。
- 生产管理员已初始化，账号信息保存在本地 `local-secrets/production-admin-account.md`。

待处理：

- 绑定自定义域名。
- 完善前端权限隐藏、计算工具正式接入和导入导出。

## 注意

当前 `wrangler.jsonc` 中的 `database_id` 仍是占位值：

```text
TODO_CREATE_WITH_WRANGLER_D1
```

创建 D1 后需要替换。
