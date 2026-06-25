# 04 接口设计

## 1. 设计原则

- 前端只负责展示和基础提示。
- 所有关键校验必须在后端执行。
- 所有写操作必须检查登录状态和权限。
- 所有重要写操作必须写操作日志。
- 返回信息使用中文，方便直接给用户显示。

## 2. 认证接口

### POST /api/auth/login

登录。

请求：

```json
{
  "username": "admin",
  "password": "password"
}
```

返回：

```json
{
  "ok": true,
  "account": {
    "id": "acc_xxx",
    "displayName": "管理员",
    "role": "admin"
  }
}
```

### POST /api/auth/logout

退出登录。

### GET /api/auth/me

获取当前登录用户。

## 3. 存票人接口

### GET /api/people

获取存票人列表。

查询参数：

- `keyword`
- `status`

### POST /api/people

新增存票人。

### PATCH /api/people/:id

编辑存票人。

### GET /api/people/:id/history

获取个人历史与汇总。

## 4. 存取记录接口

### GET /api/tickets

获取存取记录列表。

查询参数：

- `personId`
- `type`
- `status`
- `dateFrom`
- `dateTo`
- `keyword`
- `page`
- `pageSize`

### POST /api/tickets

新增存取记录。

请求：

```json
{
  "personId": "person_xxx",
  "businessDate": "2026-06-24",
  "type": "deposit",
  "amount": 100,
  "note": "手工录入"
}
```

后端规则：

- 校验登录。
- 校验存票人存在且未停用。
- 校验票数为正整数。
- 如果是取用，校验余额足够。
- 写入流水。
- 刷新存票人缓存余额。
- 写操作日志。

### POST /api/tickets/:id/void

作废记录。

请求：

```json
{
  "reason": "误录入"
}
```

### POST /api/tickets/:id/restore

恢复作废记录。

恢复前需要校验恢复后余额不会低于 0。

## 5. 汇总接口

### GET /api/dashboard

首页汇总。

返回：

- 当前总存票
- 存票人数量
- 今日存入
- 今日取用
- 最近记录
- 余额排行

## 6. 导入导出接口

### POST /api/import/preview

上传或提交 CSV 内容，返回预览和错误列表。

### POST /api/import/commit

确认导入。

### GET /api/export/tickets

导出存取记录 CSV。

### GET /api/export/balances

导出余额 CSV。

## 7. 设置接口

### GET /api/settings

获取系统设置。

### PATCH /api/settings

更新系统设置。

仅管理员可用。

