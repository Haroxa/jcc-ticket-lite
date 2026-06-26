import { useEffect, useState } from "react";
import {
  changeAccountStatus,
  createAccount,
  listAccounts,
  resetAccountPassword,
  updateAccount,
  type Account,
  type ManagedAccount
} from "../api";
import { formatDateTime } from "../utils/time";

const roleLabel: Record<Account["role"], string> = {
  admin: "管理员",
  operator: "操作员",
  viewer: "只读成员"
};

const statusLabel: Record<ManagedAccount["status"], string> = {
  active: "启用",
  disabled: "停用"
};

type AccountsPageProps = {
  account: Account;
};

export function AccountsPage({ account }: AccountsPageProps) {
  const [keyword, setKeyword] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: ManagedAccount[]; total: number; totalPages: number }>({ items: [], total: 0, totalPages: 1 });
  const [notice, setNotice] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Account["role"]>("operator");

  async function loadAccounts(nextPage = page) {
    const result = await listAccounts({ keyword, role, status, page: nextPage, pageSize: 10 });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setData({ items: result.data.items, total: result.data.total, totalPages: result.data.totalPages });
    setPage(result.data.page);
    setNotice("");
  }

  useEffect(() => {
    void loadAccounts(1);
  }, []);

  async function handleCreate() {
    if (!newUsername.trim() || !newDisplayName.trim() || !newPassword) {
      setNotice("请输入用户名、显示名称和初始密码。");
      return;
    }
    const result = await createAccount({
      username: newUsername,
      displayName: newDisplayName,
      password: newPassword,
      role: newRole
    });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setNewUsername("");
    setNewDisplayName("");
    setNewPassword("");
    setNewRole("operator");
    await loadAccounts(1);
  }

  async function handleEdit(item: ManagedAccount) {
    const displayName = window.prompt("显示名称", item.displayName);
    if (!displayName) return;
    const nextRole = window.prompt("角色：admin / operator / viewer", item.role);
    if (!nextRole || !["admin", "operator", "viewer"].includes(nextRole)) return;
    const result = await updateAccount(item.id, { displayName, role: nextRole as Account["role"] });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    await loadAccounts(page);
  }

  async function handleStatus(item: ManagedAccount) {
    const nextStatus = item.status === "active" ? "disabled" : "active";
    const reason = window.prompt(`${nextStatus === "active" ? "启用" : "停用"} ${item.displayName} 的原因`);
    if (!reason) return;
    const result = await changeAccountStatus(item.id, nextStatus, reason);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    await loadAccounts(page);
  }

  async function handlePassword(item: ManagedAccount) {
    const password = window.prompt(`请输入 ${item.displayName} 的新密码，至少 8 位`);
    if (!password) return;
    const reason = window.prompt("请输入重置原因");
    if (!reason) return;
    const result = await resetAccountPassword(item.id, password, reason);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setNotice("密码已重置，该账号需要重新登录。");
  }

  return (
    <section className="panel">
      <div className="filter-panel">
        <label>关键词<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索用户名或显示名称" /></label>
        <label>角色<select value={role} onChange={(event) => setRole(event.target.value)}><option value="">全部角色</option><option value="admin">管理员</option><option value="operator">操作员</option><option value="viewer">只读成员</option></select></label>
        <label>状态<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">全部状态</option><option value="active">启用</option><option value="disabled">停用</option></select></label>
        <div className="filter-actions">
          <button className="primary-button" type="button" onClick={() => loadAccounts(1)}>查询</button>
        </div>
      </div>

      <div className="inline-create account-create">
        <label>用户名<input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} placeholder="用于登录，例如 zhangsan" /></label>
        <label>显示名称<input value={newDisplayName} onChange={(event) => setNewDisplayName(event.target.value)} placeholder="页面展示名称" /></label>
        <label>初始密码<input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" placeholder="至少 8 位" /></label>
        <label>角色<select value={newRole} onChange={(event) => setNewRole(event.target.value as Account["role"])}><option value="operator">操作员</option><option value="viewer">只读成员</option><option value="admin">管理员</option></select></label>
        <button className="secondary-button" type="button" onClick={handleCreate}>新增账号</button>
      </div>

      <p className="filter-summary">管理员可新增成员、调整角色、停用账号和重置密码；停用账号会立即退出已登录会话。</p>
      {notice && <p className="notice-text">{notice}</p>}

      <div className="responsive-table accounts-table">
        <div className="table-row header"><span>序号</span><span>账号</span><span>角色</span><span>状态</span><span>最近登录</span><span>更新时间</span><span>操作</span></div>
        {data.items.map((item, index) => (
          <div className={`table-row account-status-${item.status}`} key={item.id}>
            <span className="row-no">{(page - 1) * 10 + index + 1}</span>
            <strong>{item.displayName}<small>{item.username}</small></strong>
            <span>{roleLabel[item.role]}</span>
            <span className="status-pill">{statusLabel[item.status]}</span>
            <span>{item.lastLoginAt ? formatDateTime(item.lastLoginAt) : "未登录"}</span>
            <span>{formatDateTime(item.updatedAt)}</span>
            <div className="row-actions">
              <button className="secondary-button row-action" type="button" onClick={() => handleEdit(item)}>编辑</button>
              <button className="secondary-button row-action" disabled={item.id === account.id} type="button" onClick={() => handleStatus(item)}>{item.status === "active" ? "停用" : "启用"}</button>
              <button className="secondary-button row-action" type="button" onClick={() => handlePassword(item)}>重置密码</button>
            </div>
          </div>
        ))}
      </div>

      <div className="pagination-bar">
        <button type="button" disabled={page <= 1} onClick={() => loadAccounts(page - 1)}>上一页</button>
        <span>第 {page} / {data.totalPages} 页，共 {data.total} 个账号</span>
        <button type="button" disabled={page >= data.totalPages} onClick={() => loadAccounts(page + 1)}>下一页</button>
      </div>
    </section>
  );
}
