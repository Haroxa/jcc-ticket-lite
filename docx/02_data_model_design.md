# 02 数据模型设计

## 1. 存储选择

推荐使用 Cloudflare D1。

原因：

- 存票管理是典型结构化数据。
- 需要按人、日期、状态查询。
- 需要汇总余额。
- 需要事务式写入和审计记录。
- D1 使用 SQL 思路，后续维护成本低。

## 2. 核心表

### accounts

账号表。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 主键 |
| username | text | 登录名，唯一 |
| password_hash | text | 密码哈希 |
| display_name | text | 显示名称 |
| role | text | admin/operator/viewer |
| status | text | active/disabled |
| created_at | text | 创建时间 |
| updated_at | text | 更新时间 |

### sessions

登录会话表。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 主键 |
| account_id | text | 账号 ID |
| token_hash | text | 登录令牌哈希 |
| created_at | text | 创建时间 |
| expires_at | text | 过期时间 |
| revoked_at | text | 注销时间 |

### ticket_people

存票人表。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 主键 |
| name | text | 存票人名称 |
| alias | text | 别名，可选 |
| status | text | active/disabled |
| cached_balance | integer | 当前缓存余额 |
| note | text | 备注 |
| created_at | text | 创建时间 |
| updated_at | text | 更新时间 |

建议索引：

- `name`
- `status`

### ticket_records

存取流水表。系统最核心的数据表。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 主键 |
| person_id | text | 存票人 ID |
| business_date | text | 业务日期 |
| type | text | deposit/withdraw/adjustment |
| amount | integer | 票数，正整数 |
| balance_delta | integer | 库存变化，存入为正，取用为负 |
| status | text | normal/voided |
| note | text | 备注 |
| void_reason | text | 作废原因 |
| voided_by | text | 作废人 |
| voided_at | text | 作废时间 |
| created_by | text | 创建人 |
| created_at | text | 创建时间 |
| updated_at | text | 更新时间 |

建议索引：

- `person_id`
- `business_date`
- `status`
- `created_at`

### audit_logs

操作日志表。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 主键 |
| actor_account_id | text | 操作人 |
| action | text | 操作类型 |
| target_type | text | 目标类型 |
| target_id | text | 目标 ID |
| before_json | text | 操作前数据 |
| after_json | text | 操作后数据 |
| note | text | 备注 |
| created_at | text | 创建时间 |

### app_settings

系统设置表。

| 字段 | 类型 | 说明 |
|---|---|---|
| key | text | 主键 |
| value_json | text | JSON 配置 |
| updated_at | text | 更新时间 |

可保存：

- 常用价格
- 默认取整规则
- 系统名称
- 导出字段配置

## 3. 余额计算规则

正式余额：

```text
正常记录的 balance_delta 合计
```

存入：

```text
type = deposit
amount = 100
balance_delta = 100
```

取用：

```text
type = withdraw
amount = 60
balance_delta = -60
```

作废：

```text
status = voided
不参与余额汇总
```

## 4. 缓存余额策略

`ticket_people.cached_balance` 可作为当前余额缓存。

每次新增、作废、恢复记录后，重新计算该存票人的余额并更新缓存。

这样首页和存票人列表可以快速展示余额，同时正式依据仍然是 `ticket_records`。

## 5. 数据完整性规则

- `ticket_people.name` 不建议重复。
- `ticket_records.person_id` 必须存在。
- `amount` 必须为正整数。
- `withdraw` 写入前必须校验余额足够。
- `voided` 记录恢复前也必须校验恢复后余额不会低于 0。

