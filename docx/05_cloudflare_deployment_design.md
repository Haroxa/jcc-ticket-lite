# 05 Cloudflare 部署与存储方案

## 1. 推荐技术栈

前端：

- React
- Vite
- TypeScript

后端：

- Cloudflare Worker
- Hono 或原生 Worker Router

数据库：

- Cloudflare D1

部署：

- Cloudflare Workers Static Assets，或 Cloudflare Pages + Pages Functions

## 2. 推荐目录结构

```text
JCC-Ticket-Cloudflare-Lite/
  docx/
  src/
    App.tsx
    main.tsx
    api/
    views/
    components/
    styles/
  worker/
    index.ts
    routes/
    lib/
  migrations/
    0000_initial.sql
  public/
  package.json
  vite.config.ts
  wrangler.toml
```

## 3. Cloudflare 资源

需要创建：

- 一个 Worker 或 Pages 项目
- 一个 D1 数据库
- 一个生产环境 D1 绑定
- 一个本地开发 D1 绑定

可选：

- 自定义域名
- Cloudflare Access 额外保护
- Turnstile 防暴力登录

## 4. D1 绑定建议

绑定名称：

```text
DB
```

数据库名称：

```text
jcc_ticket_lite
```

## 5. 环境变量

建议配置：

| 名称 | 用途 |
|---|---|
| APP_NAME | 应用名称 |
| SESSION_SECRET | 会话签名密钥 |
| ADMIN_INIT_TOKEN | 首次初始化管理员用 |

## 6. 本地开发命令建议

```bash
npm install
npm run dev
```

Worker 本地联调：

```bash
npm run worker:dev
```

D1 本地迁移：

```bash
npm run db:migrate:local
```

D1 远程迁移：

```bash
npm run db:migrate:remote
```

部署：

```bash
npm run deploy
```

## 7. 数据持久化策略

- 所有正式业务数据保存到 D1。
- 浏览器本地只保存登录状态和临时 UI 状态。
- 不使用 localStorage 保存正式流水。
- 定期支持导出 CSV 作为人工备份。

## 8. 备份与恢复

第一版：

- 提供 CSV 导出。
- 提供按日期导出全部流水。

后续增强：

- 定时导出到 R2。
- 提供管理员手动备份按钮。
- 使用 D1 自带恢复能力处理误操作。

