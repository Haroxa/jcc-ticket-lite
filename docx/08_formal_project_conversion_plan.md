# 08 正式项目转换实施方案

## 1. 转换目标

将 `page-prototype` 中的静态可点击原型，转换为可部署、可多人使用、可永久保存数据的 Cloudflare 轻量 Web 项目。

正式项目需要保留当前原型已经确认的核心能力：

- 登录后使用后台管理功能。
- 工作台查看汇总、今日存取、余额排行和最近记录。
- 快速录入存入/取用记录。
- 计算工具辅助填入票数，并保留计算链核对。
- 存票人管理，支持正常、停用、拉黑状态。
- 存取记录查询、分页、作废、恢复。
- 个人历史按人查询完整流水。
- 操作日志记录关键动作。
- 独立公开存票榜，无需登录，只展示可公开余额。

## 2. 推荐正式目录结构

建议将正式代码放入 `app/`，保留原型目录作为设计参照。

```text
JCC-Ticket-Cloudflare-Lite/
  docx/
    01_project_requirements.md
    ...
    08_formal_project_conversion_plan.md
    09_database_and_api_implementation.md
    10_cloudflare_deployment_runbook.md
    11_progress_checklist.md

  page-design/
    页面设计文档

  page-prototype/
    静态可点击原型

  app/
    public/
      favicon.svg
    src/
      frontend/
        main.tsx
        App.tsx
        pages/
          LoginPage.tsx
          DashboardPage.tsx
          EntryPage.tsx
          PeoplePage.tsx
          RecordsPage.tsx
          HistoryPage.tsx
          AuditLogsPage.tsx
          PublicBoardPage.tsx
          SettingsPage.tsx
        components/
          AppLayout/
          Table/
          Pagination/
          PersonPicker/
          Modal/
          Calculator/
          StatusBadge/
        styles/
          globals.css
      worker/
        index.ts
        routes/
          auth.ts
          dashboard.ts
          people.ts
          records.ts
          auditLogs.ts
          publicBoard.ts
        services/
          authService.ts
          peopleService.ts
          recordsService.ts
          auditService.ts
        utils/
          response.ts
          validation.ts
          password.ts
    migrations/
      0001_init.sql
      0002_seed_admin.sql
    package.json
    vite.config.ts
    tsconfig.json
    wrangler.jsonc
```

## 3. 技术路线

推荐路线：

- 前端：React + TypeScript + Vite。
- 后端：Cloudflare Worker API。
- 数据库：Cloudflare D1。
- 部署：优先使用 Workers Static Assets + Worker API 一体部署。

说明：

- Cloudflare 当前推荐 Workers Static Assets 承载静态资源和 Worker API，适合本项目这种轻量全栈应用。
- JCC Web 当前使用 Pages + Pages Functions + D1，该模式也可复用，但本项目更简单，优先选择一体化 Worker 项目可以减少配置面。
- 如果后续希望沿用 JCC Web 的 Pages 后台自动部署方式，也可以切换为 Pages + Functions + D1。

## 4. 原型到正式页面的映射

| 原型页面 | 正式页面 | 迁移重点 |
|---|---|---|
| 登录页 | `LoginPage` | 登录接口、公开榜入口 |
| 工作台 | `DashboardPage` | 汇总接口、最近记录、内部排行 |
| 快速录入 | `EntryPage` | 后端校验、正常状态存票人候选、余额预览 |
| 计算工具 | `Calculator` | 前端计算即可，保存后只提交最终票数 |
| 存票人 | `PeoplePage` | 全部状态显示、状态修改、分页筛选 |
| 存取记录 | `RecordsPage` | 查询、分页、作废、恢复 |
| 个人历史 | `HistoryPage` | 可搜索全部状态人员，包含拉黑人员 |
| 操作日志 | `AuditLogsPage` | 按权限查看日志 |
| 公开存票榜 | `PublicBoardPage` | 无登录、无后台入口、只展示正常且余额大于 0 |
| 系统信息 | `SettingsPage` | 版本、部署目标、权限说明 |

## 5. 关键业务规则

### 存票人状态

| 状态 | 内部存票人页 | 快速录入 | 内部排行 | 公开榜 | 个人历史 |
|---|---|---|---|---|---|
| 正常 | 显示 | 可录入 | 余额大于 0 时显示 | 余额大于 0 时显示 | 可查 |
| 停用 | 显示 | 不可录入 | 不显示 | 不显示 | 可查 |
| 拉黑 | 显示并特殊标记 | 不可录入 | 不显示 | 不显示 | 可查 |

### 流水状态

- 正常流水参与余额计算。
- 作废流水永久保留，但不参与余额计算。
- 恢复流水后重新参与余额计算。
- 作废和恢复都必须写操作日志。

### 公开榜规则

- 不需要登录。
- 不显示返回登录入口。
- 不显示操作人、备注、流水、个人历史。
- 只展示 `status = normal` 且 `cached_balance > 0` 的存票人。

## 6. 转换顺序

1. 创建 `app/` 正式项目骨架。
2. 迁移全局样式和布局组件。
3. 建立 D1 数据库迁移。
4. 实现认证、会话和权限中间件。
5. 实现存票人、流水、工作台、公开榜 API。
6. 页面逐个接入 API。
7. 补齐操作日志。
8. 完成本地 D1 迁移和联调。
9. 完成 Cloudflare 远程 D1 迁移和部署。
10. 使用电脑、手机、平板检查响应式体验。

## 7. 不建议第一版加入的内容

为了保持项目简单，第一版暂不做：

- 复杂组织架构。
- 多租户。
- R2 截图或附件存储。
- 复杂审批流。
- 实时 WebSocket 同步。
- 财务级报表系统。

这些可以作为后续版本增强，不影响 MVP 正式上线。
