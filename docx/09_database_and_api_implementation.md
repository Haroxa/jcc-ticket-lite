# 09 数据库与接口实现方案

## 1. 数据库选择

正式项目使用 Cloudflare D1。

选择原因：

- 存票管理是结构化数据，适合 SQL。
- 需要按人、日期、状态、类型筛选。
- 需要分页、排行、汇总。
- 所有流水需要永久保存。
- D1 可通过 Wrangler 迁移文件管理结构变化。

## 2. 状态值约定

为避免正式代码中混用中文状态，数据库建议使用英文枚举，前端显示时再转中文。

### 账号角色

```text
admin    管理员
operator 操作员
viewer   只读成员
```

### 账号状态

```text
active   启用
disabled 停用
```

### 存票人状态

```text
normal   正常
disabled 停用
blocked  拉黑
```

### 流水类型

```text
deposit  存入
withdraw 取用
```

### 流水状态

```text
normal 正常
voided 作废
```

## 3. 建表草案

### accounts

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### sessions

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);
```

### ticket_people

```sql
CREATE TABLE ticket_people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  alias TEXT,
  status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'disabled', 'blocked')),
  cached_balance INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_ticket_people_status ON ticket_people(status);
CREATE INDEX idx_ticket_people_name ON ticket_people(name);
```

### ticket_records

```sql
CREATE TABLE ticket_records (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdraw')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  balance_delta INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'voided')),
  note TEXT,
  void_reason TEXT,
  voided_by TEXT,
  voided_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (person_id) REFERENCES ticket_people(id),
  FOREIGN KEY (created_by) REFERENCES accounts(id)
);

CREATE INDEX idx_ticket_records_person ON ticket_records(person_id);
CREATE INDEX idx_ticket_records_recorded_at ON ticket_records(recorded_at);
CREATE INDEX idx_ticket_records_status ON ticket_records(status);
CREATE INDEX idx_ticket_records_type ON ticket_records(type);
```

### audit_logs

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_account_id TEXT,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  summary TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (actor_account_id) REFERENCES accounts(id)
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_account_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

### app_settings

```sql
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## 4. 余额计算策略

正式余额以 `ticket_records` 为准：

```sql
SELECT COALESCE(SUM(balance_delta), 0)
FROM ticket_records
WHERE person_id = ?
  AND status = 'normal';
```

`ticket_people.cached_balance` 是缓存余额。

每次发生这些操作后，需要重新计算并更新缓存：

- 新增存入。
- 新增取用。
- 作废流水。
- 恢复流水。
- 导入历史数据。

## 5. 后端事务规则

写入流水时必须放在同一个事务思路中处理：

1. 查询存票人。
2. 校验存票人状态必须为 `normal`。
3. 校验金额为正整数。
4. 如果是取用，校验余额足够。
5. 写入 `ticket_records`。
6. 更新 `ticket_people.cached_balance`。
7. 写入 `audit_logs`。

作废流水：

1. 查询流水。
2. 校验流水不是已作废。
3. 更新流水为 `voided`，保存作废原因。
4. 重新计算存票人余额。
5. 写操作日志。

恢复流水：

1. 查询流水。
2. 校验流水是已作废。
3. 校验恢复后余额不会低于 0。
4. 更新流水为 `normal`。
5. 重新计算存票人余额。
6. 写操作日志。

## 6. API 列表

### 认证

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### 工作台

```text
GET /api/dashboard
```

返回：

- 当前总存票。
- 存票人数量。
- 今日存入。
- 今日取用。
- 内部余额排行。
- 最近记录。

### 存票人

```text
GET   /api/people
POST  /api/people
PATCH /api/people/:id
PATCH /api/people/:id/status
GET   /api/people/:id/history
```

说明：

- `GET /api/people` 默认返回全部状态。
- `PATCH /api/people/:id/status` 仅管理员可用。
- 拉黑人仍可在存票人页和个人历史查询，但不进入录入、内部排行、公开榜。

### 存取记录

```text
GET   /api/records
POST  /api/records
PATCH /api/records/:id/void
PATCH /api/records/:id/restore
```

### 操作日志

```text
GET /api/audit-logs
```

权限规则：

- 管理员查看全部。
- 操作员查看自己的操作。
- 只读成员不可查看。

### 公开存票榜

```text
GET /api/public/board
```

后端过滤：

```sql
WHERE status = 'normal'
  AND cached_balance > 0
ORDER BY cached_balance DESC
```

## 7. 前端调用约定

所有接口统一返回：

```json
{
  "ok": true,
  "data": {}
}
```

错误返回：

```json
{
  "ok": false,
  "message": "错误说明"
}
```

分页返回：

```json
{
  "ok": true,
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

## 8. 后续实现注意

- 数据库状态值使用英文，页面展示中文。
- 关键校验必须在后端做，前端提示只作为体验优化。
- 公开接口不能返回内部备注、操作人、日志、流水细节。
- 所有时间保存到分钟即可，建议使用 `YYYY-MM-DDTHH:mm` 或 ISO 字符串。
- 导出功能可以放到第二阶段，但数据库结构要提前支持。
